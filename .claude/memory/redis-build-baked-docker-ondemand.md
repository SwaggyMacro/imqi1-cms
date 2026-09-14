---
name: redis-build-baked-docker-ondemand
description: Redis 配置源头是 site.config.ts 的 build.redis（不再是 .env 的 REDIS_*_PROD），构建期烘焙进 runtimeConfig+nitro（ISR/搜索共用）；Docker 拆两套显式 compose，启用与否由选哪套决定，参数用 --build-arg 覆盖
metadata: 
  node_type: memory
  type: project
  originSessionId: 53ba7575-f6e0-467c-ae59-2592a57a813c
---

Redis 配置的**默认值写在 `site.config.ts` 的 `build.redis`**（`enabled` / `host` / `port` / `password` / `db`），**不再有任何 `REDIS_*_DEV` / `REDIS_*_PROD` 环境变量**（.env 与 .env.example 里的那两段已删）。`shared/redis-config.ts` 的 `getRedisConfig()` 取值为「构建期环境变量（`REDIS_ENABLED`/`REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`/`REDIS_DB`，非空才算覆盖）> site.config.ts」，结果烘焙进两处——nitro storage/routeRules（ISR 增量缓存）+ `runtimeConfig.redis`（搜索缓存，server/utils/redis.ts 读 useRuntimeConfig，不读 process.env）。**开发环境恒返回 null**（不再支持 dev 用 Redis）。生产运行时**零** Redis 环境变量；未启用时 ISR 退文件系统、搜索缓存关（都 null 不报错）。改配置必须重新打包。

**`enabled` 这个显式开关是必需的**：以前靠「host 为空即关闭」，现在 host 在 site.config.ts 里恒有值（默认 `127.0.0.1`），必须另有关断位。空字符串环境变量一律按「未覆盖」处理（`Number("") === 0`，数值项要显式排除空串）。

**Docker 拆成两套显式版本**，**是否启用 Redis 只由选哪套 compose 文件决定**（与 .env 无关，**不需要任何 COMPOSE_PROFILES / profiles**）：
- `docker/docker-compose.yml` + `docker/Dockerfile` = 带 Redis（app+postgres+redis 服务+redis-data 卷）。Dockerfile 里 `ARG REDIS_ENABLED=true` / `ARG REDIS_HOST=redis`（compose 服务名）+ `ENV` 落到构建期 process.env；compose 的 `build.args` 用 `${REDIS_*:-默认值}` 列出同一组变量，便于 shell env 或 `--build-arg` 覆盖（CLI 优先级最高）。
- `docker/docker-compose.noredis.yml` + `docker/Dockerfile.noredis` = 不带 Redis，**builder stage 里必须有 `ENV REDIS_ENABLED=false`**——省掉这行的话 site.config.ts 的 `enabled: true` 默认值会生效，容器会去连 host 默认值 `127.0.0.1`（即容器自己）并一直失败。noredis 的 compose 不带任何 REDIS 变量。
- `REDIS_PASSWORD` 是唯一需要应用与 redis 服务两边一致的值：compose 已把它同时接到 `build.args` 和 redis 服务的 `--requirepass`，用 shell env / `--env-file` 传；只用 `--build-arg REDIS_PASSWORD=x` 会两边对不上。redis 服务 `--requirepass ""` 等价于无密码（原有行为，沿用）。
- 改完必须重新 build；`docker/Dockerfile` / `Dockerfile.noredis` 的 ENV 只在 builder stage，最终 runner stage 无 REDIS_* 环境变量。
- 运行命令统一带 `--env-file .env`：compose 挪进 docker/ 子目录后 project dir 变了，`.env` 插值不再从根目录自动读（实测 `docker compose -f docker/... config` 会 warning "variable is not set"）；从根目录 `docker compose --env-file .env -f docker/docker-compose.yml up -d --build`。相对路径 `../` 指项目根（context: .. / env_file: ../.env / ../scripts/init-db.sql，compose 以自身文件目录为基准解析）。
- `.dockerignore` 里 Dockerfile/docker-compose*.yml 模式**必须锚定根目录**（`/Dockerfile`）：docker 的 patternmatcher 按 basename 匹配任意层级，裸模式会把 docker/Dockerfile 也排除出构建上下文导致构建失败。
- 关键理解：`.dockerignore` 排除 .env 只影响**构建上下文**（COPY . .），不影响 compose 的 `${VAR}` 插值和 `env_file` 运行时注入。所以 DB 走运行时注入（DB_* 单套变量、构建不连库），Redis 走构建期烘焙。
- 验证不用 build：`docker compose --env-file .env -f docker/... config`（纯客户端解析，daemon 未运行也可用）；想确认烘焙出来的值就直接 `NODE_ENV=production bun -e 'console.log((await import("./shared/redis-config.ts")).getRedisConfig())'`，配 `REDIS_HOST=...` 等变量即可看到覆盖效果。
- 相关：[[imqi1-cms-db-imqi1-cms]]（DB 运行时注入无分支）、[[lint-typecheck-no-root-script]]
