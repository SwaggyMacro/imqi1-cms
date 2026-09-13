#!/usr/bin/env bash
# 从已构建的 imqi1-cms 镜像导出 .output/public 到 ./dist/<hash>/，
# 用户拿到整个目录直接上传到 CDN 的 static/<hash>/ 即可。
# 适用：docker compose ... up -d --build 完成后立即跑。
# hash 与运行时一致；不影响运行中的 imqi1-app（create + cp + rm）。

set -euo pipefail

IMAGE="${IMAGE_NAME:-imqi1-cms:latest}"
DEST_ROOT="${DEST_ROOT:-./dist}"
CONTAINER="imqi1-export-tmp"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "✗ 镜像 $IMAGE 不存在，请先运行：docker compose --env-file .env -f docker/docker-compose.yml up -d --build"
  exit 1
fi

mkdir -p "$DEST_ROOT"

# 1) 拷到临时目录
TMP="$(mktemp -d)"
docker create --name "$CONTAINER" "$IMAGE" >/dev/null
docker cp "$CONTAINER":/app/.output/public "$TMP/public"
docker cp "$CONTAINER":/app/.output/build-hash.json "$TMP/build-hash.json"

# 2) 读 hash
HASH=$(grep -oE '"hash":\s*"[^"]+"' "$TMP/build-hash.json" | sed -E 's/.*"([^"]+)"$/\1/')

# 3) 重命名为 ./dist/static/<hash>/
TARGET="$DEST_ROOT/$HASH"
rm -rf "$TARGET"
mv "$TMP" "$TARGET"

echo "✓ 已导出到 $TARGET"
echo "  buildHash: $HASH"
echo "  用法：上传整个 $TARGET 目录到 CDN 的 static/ 下（最终路径 static/<hash>/）"