# syntax=docker/dockerfile:1

# 带 Redis 版本，与 docker-compose.yml 配套。构建期烘焙 Redis 连接（默认指向 compose 的
# redis 服务），ISR 增量缓存与搜索缓存共用。参数需要改动时在构建命令里覆盖，例如：
#   docker compose --env-file .env -f docker/docker-compose.yml build --build-arg REDIS_HOST=10.0.0.5
# 也可传 --build-arg REDIS_ENABLED=false 临时退回「不启用」（ISR 走文件系统、搜索缓存关闭）。
# 生产容器内运行时无 Redis 环境变量（值已烘焙进产物，运行时不读 env）。

# ---- Stage 1: 依赖安装 + 构建 ----
# 匹配 package.json packageManager="bun@1.4.0",与本地开发环境一致,
# 避免 bun 1.3 vs 1.4 解析 lockfile 不一致导致 --frozen-lockfile 失败。
FROM oven/bun:1.4 AS builder
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts
RUN bunx prisma generate

# Redis 构建期烘焙（覆盖 site.config.ts 的 build.redis，见 shared/redis-config.ts）
ARG REDIS_ENABLED=true
ARG REDIS_HOST=redis
ARG REDIS_PORT=6379
ARG REDIS_PASSWORD=
ARG REDIS_DB=0
ENV REDIS_ENABLED=${REDIS_ENABLED} \
    REDIS_HOST=${REDIS_HOST} \
    REDIS_PORT=${REDIS_PORT} \
    REDIS_PASSWORD=${REDIS_PASSWORD} \
    REDIS_DB=${REDIS_DB}

RUN bun run build

# ---- Stage 1.5: 纯导出（仅 buildkit --output 使用，不进最终镜像）----
# 调用方传 --target bundle --output type=local,dest=. 即可把 .output 落到宿主，
# 无需临时容器 / docker cp。两套 Dockerfile（带/不带 Redis）保持一致。
FROM scratch AS bundle
COPY --from=builder /app/.output /output

# ---- Stage 2: 运行时 ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NITRO_PRESET=node-server \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    PORT=3000

COPY --from=builder /app/.output ./.output

# 覆盖被裁剪的 undici：Nitro/nft 对 undici trace 不完整，缺 index.js 会导致
# isomorphic-dompurify 运行时 require("undici") 失败。勿删。
COPY --from=builder /app/node_modules/undici ./.output/server/node_modules/undici

# 预建运行时写入目录并交给非 root 的 node 用户（root 写入的内容 node 无法再写）。
# 上传目录固定为 /app/.output/public/uploads（compose bind mount 挂载点）。
RUN mkdir -p /app/.nitro/cache /app/.data/storage /app/.output/public/uploads /app/.sessions /app/logs/mail \
    && chown -R node:node /app/.nitro /app/.data /app/.output/public/uploads /app/.sessions /app/logs

USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
