# isr 键在 node-server 预设是死键，页面缓存只认 routeRules.cache

2026-09-16 实锤（nitropack 2.13.4 实测 + 产物验证）：routeRules 的 `isr: N` 只有 Vercel/Netlify/Zeabur 等 serverless preset 消费，node-server（裸机与 Docker 同）不认——Nitro 运行时包装页面的唯一条件是 `routeRules.cache` 存在（`runtime/internal/app.mjs` 的 `if (routeRules.cache)`），`isr` 只是被原样烘焙进产物的死键。nuxt.config 曾写「未配 Redis 时 isr 退回文件系统缓存」，实际是**完全不缓存**（每次请求全量 SSR），且 `.nitro/cache` 从不生成。

修复（本次）：routeRules 的内容页规则改为 `...(redisConfig ? { <15 条路由, isr + cache.base:"redis"> } : {})`——配了 Redis 才写规则（缓存进 Redis），没配就不写规则。行为语义：**页面缓存是否启用真正可选**；未配 Redis 时站内恒存的文件缓存只剩 `/api/_nuxt_icon` 图标缓存（@nuxt/icon 的 defineCachedHandler 走默认 `base: "/cache"` → cache 挂载 → 未配 Redis 时 `./.nitro/cache` 文件缓存，实测落盘 `.nitro/cache/nuxt/icon/*.json`）。

若要真文件缓存降级：写 `cache: { maxAge }` 不带 base（defineCachedFunction 默认 `base: "/cache"`）或显式 `base: "cache"`，不要写裸 `isr`。`swr: N` 会被 normalizeRouteRules 转成 cache 对象，也可用。

验证法：`REDIS_ENABLED=false bun run build` 后查 `.output/server/chunks/_/nitro.mjs`——grep `"isr"` 应只剩 `/admin/**` 的 `"isr": false`，`storage.mount('cache', ...)` 应为 fs `./.nitro/cache`。

呼应：[[redis-build-baked-docker-ondemand]]（redisConfig 的构建期取值）、[[post-change-lint-chain]]。
