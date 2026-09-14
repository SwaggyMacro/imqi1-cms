---
name: nuxt-page-key-route-path
description: "分类/标签 [slug].vue 顶层 await useFetch → 异步 setup → NuxtPage Suspense 每次导航**重挂载**(非复用!)。渐出靠 Suspense 挂住旧页等新页 await;勿加 :key;重挂载页里任何"同实例响应 route.params"的 watch 都该删(apiSlug 只初始化)→否则 data 清空致 menu 图标居中到屏幕中央 + 文章页 404 误请求;文章列表下跳=重放 translate-y-8,当前实例级 hasPlayedEntryFade 仍重播"
metadata:
  node_type: memory
  type: project
  originSessionId: 3787c776-cd5a-4075-9d4a-2c8bc2bba7b4
---

**关键纠正(2026-07-24 实测,推翻本条早先"复用"判断)**:`pages/category/[slug].vue` 切 `/category/A → /category/B` **不是 Vue Router 复用,而是重挂载**。证据:`onMounted` 每次切换都触发(`window.__mountLog` 累积 ['note','tech','note','tech']);旧 `.articles-grid` 元素 `isConnected=false`(被移除而非 patch)。原因:该页 setup 顶层有 `await useFetch(...)` → 异步 setup → `<NuxtPage>` 的 **Suspense 在每次导航都重挂载该异步页**(重跑 setup+await),与 Vue Router"同组件不同参数复用"的默认行为叠加,Suspense 的重挂载占主导。`onBeforeRouteUpdate` 因此**不触发**(每次是新实例)。

**渐出/渐入真正机制(重挂载下):** `page:start` 把 `#main` opacity 置 0(渐出当前可见的旧页,此时旧页仍被 Suspense 挂住)→ 新页 setup 的 `await useFetch` resolve → Suspense 换上新页 → `page:finish` 触发 → `#main` opacity 0→1 渐入。旧页在 await 期间全程在场随 opacity 渐出,内容切换发生在 opacity≈0 不可见处。

**❌ 仍勿加 `<NuxtPage :key>` / `definePageMeta({key})`:** 会破坏 Suspense 边界,旧页不再被挂住→无渐出。保持现状(无 key)即可。

**⚠️ Option A(pageDataReady provide/inject + viewData/stableData + onBeforeRouteUpdate/Leave,app.vue page:finish 两段式等数据)是冗余的:** 因重挂载,`onBeforeRouteUpdate` 不触发→`pageDataReady` 恒 true→app.vue 的 `waitForDataThenFinish` 直接 finish 不等;`viewData` 在重挂载下就等于 `data`(pending 在 await 后已 false)。渐出全靠 Suspense。该机制对"复用"场景才需要,当前无害但死代码;未来若确认无复用路径可清掉。**勿据此再建类似等数据信号。**

## apiSlug 必须"只初始化、不 watch"（2026-07-24 改，原 usefetch-route-param-spa-refetch-trap）

`category/[slug].vue` / `tag/[slug].vue` 的 `slug = computed(() => route.params.slug)`，useFetch URL getter 写成 `() => /api/category/${slug.value}/contents`。Nuxt useFetch **自动追踪 URL getter 里读到的响应式依赖**（slug），`watch: [page, slug]` 更是显式声明。

**陷阱**：SPA 从列表页 `/category/note` → 文章页 `/content/note/1012` 时，`route.params.slug` 变成文章 slug（Typecho 迁移的老文章常为纯数字 cid），而**旧列表页组件在页面过渡卸载前仍存活**，useFetch 自动用文章 slug 重新请求 `/api/category/1012/contents` → 后端找不到 type=category 的 meta → 404 噪音（线上表现：控制台 `GET /api/category/1018/contents 404`）。标签页同理。

**Why：** useFetch 的响应式追踪不区分"我还在这个页面"和"路由已离开"，只要被追踪的 route.params 变了就 refetch；列表页组件在 SPA 过渡期未卸载就是触发窗口。

**How to apply：** 因这类页实为**重挂载**（见上），新实例 setup 自会用新 slug 初始化 apiSlug 并请求 —— 故 `apiSlug` 改为**只 `ref(slug.value)` 初始化、删 `watch(slug)`**，并**删 `watch(() => route.params.slug)`**（原"切分类重触发动画"在重挂载下靠新实例 `onMounted→triggerEntryFadeIn`，无需旧实例响应）。useFetch 的 `watch:[page, apiSlug]` 可保留（apiSlug 永不变，等价 `[page]`）。

**旧 `watch(slug)` 在重挂载下是死代码且有害（当时根因）:** 导航瞬间旧实例仍被 Suspense 挂住，watch 同步 apiSlug→新 slug 触发 useFetch 重请求→**data 被清空**→`contents=[]`→`articles-grid`（`v-if contents.length>0 && !showSkeleton`）与分页被**移除（不占位）**→根容器 `flex flex-col justify-center items-center` 把孤立的 `<header>`（含 `ri:menu-line`/`ri:hashtag` 图标）瞬间**居中到屏幕中央**，恰逢 mainOpacity 渐出→用户看到居中的 menu 图标淡出（chrome-devtools 8ms 采样：root.children.length 3→1、header.top 128→310 接近 vh/2=345）。`watch(route.params.slug)` 里 `page.value=1` 同样触发重请求，一并删。修复后采样：root 全程=3、header.top 全程 128-206 未跳中央、mainOpacity 1→0→1 正常。

**双重收益：** ①旧页不再 refetch、data 保留、grid 不移除、header 留顶部；②从根源断掉文章页 404 误请求（apiSlug 不再追 route，比旧"watch+route.path 守卫"更彻底）。

**结论：重挂载页里任何"同实例响应 route.params 变化"的 watch 都该删，新实例 onMounted 自会处理。**

**排查 SPA 导航类问题的方法：** 用 `document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$router.push('/category/x')` 触发**真 SPA 导航**（注：`history.pushState+dispatchEvent(popstate)` **不可靠**——Vue Router 不响应，只换 URL 不换组件）；再用 8ms `setInterval` 采样 `#main` opacity / root.children / header rect。

## 文章列表"瞬间下跳"根因+修复(2026-07-24)

每次重挂载,新实例 `hasPlayedEntryFade=false`→`onMounted→triggerEntryFadeIn` 重放 `translate-y-8→translate-y-0` 的 0.6s 上滑(transform transition)= 用户看到的下偏再滑回。实测 `.fade-in-element,.entry-fade-element { transition: opacity .6s, transform .6s }` + `.translate-y-8{transform:translateY(2rem)}`。修法(⚠️2026-08-23 核实:`useCategoryEntrySlide`/`revealFadeElementsInPlace` **代码里均不存在**,当前 category/[slug].vue:80、tag/[slug].vue 用**实例级** `hasPlayedEntryFade = ref(false)`,每次导航重挂载重置→切分类仍**重播**上滑;此"仅首播+原位"方案**未落地**,以下为若要去掉重播的改法):
- 模块级 `let entrySlidePlayedInSession=false`(模块只求值一次→跨重挂载留存,整页刷新才重置;仅客户端生命周期读写无 SSR 泄漏)。
- `triggerEntryFadeIn`:`nextTick(() => { if(entrySlidePlayedInSession) revealFadeElementsInPlace(); else { entrySlidePlayedInSession=true; hideFadeElements(true); triggerFadeIn(true); } })`。即仅整站首次加载播上滑;之后所有 SPA 到达分类页走 `revealFadeElementsInPlace`(给元素加 `style.transition='none'`+直接置 opacity-100/translate-y-0,下一帧 rAF 清掉 inline transition)→无 transform 动画→无下跳,外观渐入交给 `#main` opacity。
- **ClientOnly 时序坑**:内容包在 `<ClientOnly>` 内,SSR 水合后插槽要等下一帧才渲染进 DOM;`triggerEntryFadeIn` 必须包 `nextTick` 再查 `.fade-in-element`,否则首屏查不到→早返回→文章列表卡 opacity-0 不显现(原代码 `setTimeout(100)` 即为此;改 nextTick 更紧)。

**实测(chrome-devtools Edge,initScript 装 rAF 采样 `.articles-grid` 的 transform/opacity):** 首屏 ty 32→0、op 0→1 平滑上滑~570ms,reachedVisible;note→tech 切换 maxTy=0、visibleJumpFrames=0(全程 ty=0 op=1,新页元素从不绘制 translate-y-8)。vue-tsc/eslint 全绿。

**同构**:`tag/[slug]` 若报同样下跳,照搬会话开关 + revealFadeElementsInPlace。

相关:[[page-transition-pjax-origin]] [[frontend-soft404-setstatus]] [[hydration-mismatch-pending-immediate-watch]]
