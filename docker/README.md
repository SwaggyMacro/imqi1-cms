# Docker 部署（两种版本）

本目录提供两套**独立的 Docker 部署文件**，按是否需要 Redis 二选一使用。两套的 `../` 相对路径均指向项目根目录，且都从根目录的 `.env` 读取变量（运行命令统一带 `--env-file .env`）。

| 版本 | 文件 | 服务 | 说明 |
| --- | --- | --- | --- |
| **带 Redis** | `docker-compose.yml` + `Dockerfile` | 应用 + PostgreSQL 16 + Redis 7 | 构建期烘焙 `redis:6379`（compose 服务名）并启动 redis 容器，ISR 增量缓存与搜索缓存共用；redis 数据存于 `redis-data` 卷 |
| **不带 Redis** | `docker-compose.noredis.yml` + `Dockerfile.noredis` | 应用 + PostgreSQL 16 | 构建期显式关闭 Redis：ISR 走文件系统缓存、搜索缓存关闭，无 redis 容器/卷 |

> 注意：**是否启用 Redis 只由「选哪套 compose 文件」决定**，与 `.env` 无关，也**不需要任何 `COMPOSE_PROFILES`**。两套 Dockerfile 里各自烘焙了开关（带 Redis 的 `REDIS_ENABLED=true` / `REDIS_HOST=redis`，不带 Redis 的 `REDIS_ENABLED=false`），`.env` 里不需要也不应该再写 Redis 变量。

## 指定 Redis 参数（可选）

默认连的就是 compose 里的 redis 服务（`redis:6379`、无密码、DB 0），**通常不用改**。要改的话在**构建命令里用 `--build-arg` 覆盖**，不要改 `site.config.ts`，也不需要动 `.env`：

```bash
# 连外部 Redis
docker compose --env-file .env -f docker/docker-compose.yml build \
  --build-arg REDIS_HOST=10.0.0.5 --build-arg REDIS_PORT=6379 --build-arg REDIS_DB=1

# 带密码：同时作用于应用与 redis 服务（compose 两处读同一个变量），改完重新 up
REDIS_PASSWORD="你的密码" docker compose --env-file .env -f docker/docker-compose.yml up -d --build
```

可用变量：`REDIS_ENABLED` / `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_DB`，优先级为「构建命令 > compose 文件默认值 > `site.config.ts` 的 `build.redis`」。改完**必须重新 build** 才生效（值在打包时烘焙进产物，运行时不再读环境变量）。

> `REDIS_PASSWORD` 是唯一需要同时被应用和 redis 服务读到的变量，compose 已把它同时接到两边，用 shell 环境变量或 `--env-file` 传即可；单独用 `--build-arg REDIS_PASSWORD=xxx` 只会改应用、redis 服务仍无密码，两边会对不上。

## .env 关键变量

运行命令统一从项目根目录的 `.env` 读变量（`--env-file .env`）。至少需设置以下四项：

| 变量 | 说明 |
| --- | --- |
| `DB_PASSWORD` | PostgreSQL 应用用户密码（compose 用它建库并传给 `POSTGRES_PASSWORD`）。PG 不像 MySQL 分 root/普通用户，单用户即超级用户 |
| `DB_NAME` | 库名，compose 建库与导入 `init-db.sql` 都用它 |
| `DB_USER` | 应用连接的用户。**PG 没有 root/普通用户分权**，应用用户与库所有者是同一个；设 `DB_USER=root` 是字面值能跑，但建议沿用普通用户名（如 `nodejs`、`imqi1`）保持与 MySQL 时代同样的命名习惯 |
| `DEPLOY_PORT` | 宿主对外端口（默认 `3000`） |
| `UPLOADS_DIR` | 本地上传目录的**宿主路径**（bind mount）。默认 `../uploads`（即项目根 `uploads/`，本地文件系统直接可见）；容器内挂载点固定为 `/app/.output/public/uploads`。裸机部署则指应用直接写入的目录。不设置即用默认 |

`DB_HOST` 会被 compose 自动覆盖为服务名 `postgres`，无需填写。

## 带 Redis 版本

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
```

- 构建期烘焙 `REDIS_ENABLED=true` + `REDIS_HOST=redis`（compose 服务名）→ 把 `redis:6379`（无密码、DB 0）烘焙进镜像并启动 redis 容器；
- 想连别处的 Redis 或改密码：见上文「指定 Redis 参数」，用 `--build-arg` / 环境变量覆盖，改完重新 build。

## 不带 Redis 版本

```bash
docker compose --env-file .env -f docker/docker-compose.noredis.yml up -d --build
```

- 构建期烘焙 `REDIS_ENABLED=false` → `getRedisConfig()` 返回 null，ISR 走文件系统缓存、搜索缓存关闭；
- 不创建 redis 容器、不创建 `redis-data` 卷。
- 这个开关不能省：`site.config.ts` 的 `build.redis.enabled` 默认为 `true`，不显式关掉的话容器会去连 `host` 默认值 `127.0.0.1`（即容器自己），一直连不上。

## 验证

```bash
docker compose --env-file .env -f docker/docker-compose.yml config          # 查看解析后的完整配置
docker compose --env-file .env -f docker/docker-compose.yml config --services
docker compose --env-file .env -f docker/docker-compose.noredis.yml config --services
```

## 常用运维命令

```bash
# 查看状态 / 日志（以带 Redis 版本为例，不带 Redis 把文件名换掉即可）
docker compose --env-file .env -f docker/docker-compose.yml ps
docker compose --env-file .env -f docker/docker-compose.yml logs -f app

# 重启 / 停止
docker compose --env-file .env -f docker/docker-compose.yml restart app
docker compose --env-file .env -f docker/docker-compose.yml down   # 数据卷保留

# 进入 PostgreSQL 命令行（库名以 .env 中的 $DB_NAME 为准；PG 单用户即超级用户，无 root/普通分权）
docker compose --env-file .env -f docker/docker-compose.yml exec postgres psql -U "$DB_USER" -d "$DB_NAME"
```

> ⚠️ `docker compose ... down -v` 会**删除数据卷、清空所有数据**，请谨慎使用。

## 镜像加速

如服务器在国内拉 `postgres:16-alpine` / `oven/bun:1.3.10` / `node:22-slim` 慢，可在 `~/.docker/daemon.json` 加 `registry-mirrors`（按就近原则挑选实际可达的源，本仓库验证 `https://docker.m.daocloud.io` 可用）。镜像列表见各 `Dockerfile` 的 `FROM` 行。