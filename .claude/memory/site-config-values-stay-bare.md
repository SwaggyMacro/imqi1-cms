---
name: site-config-values-stay-bare
description: site.config.ts 里的值只写事实不做适配——静态资源一律裸路径、前缀归消费点，开关用短名；_assetPrefix/_isProduction 已删别加回，amap runtimeConfig 键名故意未跟着改
metadata:
  type: project
---

`site.config.ts` 里的值**只写事实、不做适配**。两条落地约定，2026-09-14 与用户逐个确认后落地：

**① 静态资源一律写裸路径**，CDN 前缀归消费点补。`site.avatarPath: "/imgs/avatar.webp"`、`seo.ogImage: "/imgs/imqi1.svg"`、`links.blogOrganizations[].icon` 都是裸的。补前缀的是两个 helper，各管一段：

- 运行期 `app/utils/asset.ts` 的 `publicAsset` —— 只认白名单目录 `/imgs|skills|icons|fonts|emojis|uploads/` 与 `/favicon.ico`、`/manifest.webmanifest`；`^https?:?//` 原样返回；仅 `import.meta.env.PROD && site.cdnUrl` 非空时才拼。
- 构建期 `nuxt.config.ts` 的 `publicCdnAsset` —— 只用于构建期就要定死的值（如 `og:image`）。

**② `features.amap` 是 `{ proxy, entry }`**（短名，`proxy` = 生产是否经服务端 `/_AMapService` 取密钥，`entry` = 是否展示地图入口胶囊）。名说的是「开关什么」而不是「怎么实现」。被替换掉的旧名：`useServerProxy` → `proxy`，`entryLinks: { development, production }` → `entry`（开发环境高德恒直连，`proxy` 只管生产，故没有分环境的必要）。`MapEntryLinks.vue` 的 `import.meta.dev` 三元也随之删掉。

**Why:** 先前 `site.config.ts` 自己拼前缀（`_assetPrefix` 常量 + `_isProduction`），导致「哪些字段已带前缀」没有统一答案，边界模糊；用户的原话是「不然原来的界限太模糊了」。裸路径让配置只回答「这个资源在哪」，前缀策略留给消费点，改 CDN 只需动一处。

**How to apply:**

- **不要加回 `_assetPrefix` / `_isProduction`** —— 两个都已在 2026-09-14 删除。加回去要么把前缀拼两次，要么让配置里的值与数据库站点信息（头像等）对不上。
- 往 `site.config.ts` 写新字段时，值写裸的，**并且不要在字段注释里写「由 `publicAsset` 补全」**（见 [[code-comments-should-be-concise]]）——字段注释只描述字段自身。
- ⚠️ **`nuxt.config.ts` 的 runtimeConfig 键名仍是 `amapUseServerProxy`，故意没跟着改短**。右值已改为 `isProduction && siteConfig.features.amap.proxy`，但键名被 `server/api/amap/config.ts` 与 `server/routes/_AMapService/[...path].ts` 消费；要改键名必须三处同改。客户端另在 `app/utils/amap-loader.ts` 用 `import.meta.env.PROD && siteConfig.features.amap.proxy` 等价判定（注释里那句 `shared/amap-runtime.ts` 是不存在的悬空引用，别去找）。
- 改完照例走 [[post-change-lint-chain]]。
