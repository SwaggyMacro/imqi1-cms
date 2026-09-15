# 安全策略

**ImQi1 CMS** 是一套面向公众、带鉴权的内容管理系统，也是个人站点 [imqi1.com](https://imqi1.com) 的完整源码——因此本仓库的代码本身就可能被攻击者研究。感谢你帮忙提高它的安全性。

## 报告漏洞

**请勿在公开 Issue / PR 中披露漏洞详情**，走私密渠道：

- **首选**：GitHub 私密安全报告（仓库 → Security → Report a vulnerability）。
- **备选**：直接发邮件给我（`SECURITY.md` 的维护者邮箱可从 GitHub 提交记录找到），请附上复现步骤、影响与建议修复，尽量脱敏（去掉真实 token / IP / 主机名 / 用户数据）。

我们会在评估后给予回复与修复，并在修复上线后再考虑是否公开致谢。下文「[已知局限](#已知局限)」与「[威胁模型与范围](#威胁模型与范围)」两节列了已知的开放口子与不在范围内的项目，报告前请先过一眼，避免重复报告。

## 安全不变式（贡献者须知）

项目在架构上坚持以下不变式，**改动涉及相关代码时请勿破坏**，评审会重点核对。

### 数据与接口

1. **公开接口字段白名单**：前台任何查询只返回必要字段（`select` 或逐字段构造），禁 `...row` 展开——隐私与内部审核字段都算泄露。
2. **Admin 写接口：认证与 CSRF 是两条独立检查**：`/api/admin/*` 的 POST/PUT/DELETE 必须**同时**带 `getUser`（未登录 401）与 `validateCsrfToken`（校验失败 403）。token 来源按方法取：POST/PUT 从 body `csrfToken`，DELETE 从 header `x-csrf-token`。
   项目**没有全局 admin 鉴权中间件**（`server/middleware/` 只有小程序鉴权与 referer 校验），所以每个 handler 都得自己写这两条。历史上出现过整批遗漏（含未登录可批量删评论），新增写接口建议扫一遍自查：`server/api/admin/**/*.{post,put,patch,delete}.ts` 里每个文件都应同时命中 `getUser` 与 `validateCsrfToken`。
3. **referer 门禁不是认证手段**：`server/middleware/referer-check.ts` 只做来源域名白名单，且**开发环境整段跳过**、生产按 Referer 域名判断（可被子域名 / 同源绕过）。它**不能替代**上面的登录鉴权与 CSRF。服务端自身的 SSR 请求走 `x-ssr-internal-request` 头豁免（见第 5 条）。
4. **输入校验的上限不得超过实际列长**：`validateXxxData` 的长度上限若超过 `schema.prisma` 里 `@db.VarChar(n)` 的 n，会「过校验 → 写库溢出 → 500」，应用层校验形同虚设。改校验器先查对应字段的列长。

### 会话与令牌

5. **强随机 + fail-closed**：`sessionId`、`authCode`、两步验证 challenge、信任设备 cookie 的 HMAC 密钥等一律 `crypto.randomBytes`（禁 `Math.random`）。**任何门禁密钥都不得回落到源码里的公开常量**——本仓库公开，那等于把钥匙摆在明处；未配置时应改为启动时随机生成并写入进程内共享处（如 `process.env`），取不到就不放行。此外：登录失败按 IP 限流（Redis 优先、内存兜底）；用户不存在时也跑一次 bcrypt 拉平时延，防用户名枚举（占位 hash 只算一次）；登录回跳只允许站内路径（正则白名单，防开放重定向与浏览器规范化差异绕过）。
6. **客户端可控值不得直接拼路径**：来自 cookie / query / body 的标识符在拼文件路径前必须净化（`path.basename` 或字符集白名单），否则 `../../` 一类输入就是任意文件读 / 删。

### 网络边界

7. **入站：客户端 IP 只信受信代理**：`X-Real-IP` / `X-Forwarded-For` 只在**直接对端**命中 `TRUSTED_PROXY` 白名单（支持单个 IP 或 CIDR）或为 loopback 时才采信，否则一律丢弃、改用 socket 地址。漏配会让所有访客 IP 塌缩成反代 IP——评论入库 IP、访客去重、**登录限流键**会全部合并（一个人就能把全站登录锁死）。Docker / 云 LB / 远程 nginx 场景要写网段（如 `172.16.0.0/12`）：网段由平台动态分配，写死单个网关 IP 会随环境失效，且是静默失效。
8. **出站：SSRF 防护**：任何取远程资源的入口（跳转 / 代理 / 友链可达性检查）都先过 `urlGuard`——解析后按主机名判定是否私网，IPv6 必须按 **CIDR** 展开判定（`fe80::/10`、`fc00::/7`，以及 IPv4 映射地址的十六进制写法），不能用字符串前缀或相等判断。残余风险见「[已知局限](#已知局限)」。

### 配置与数据

9. **敏感配置运行时化，凭据不进日志**：Redis / 高德 / COS / 小程序 / 登录密钥等一律 env 注入或构建期烘焙，不进仓库、不进前端 bundle。**签名产物与派生密钥也绝不落日志**（如 COS 的 `SignKey` / `q-signature` / `Authorization` / `StringToSign`）：读到日志的人可在签名有效窗口内伪造对对象存储的写 / 删请求，日志只记非敏感摘要（Bucket / Region / 文件名 / 状态码）。
10. **媒体 / 外部资源 HTTPS 化**：外链直链的 http → toHttps 升级，避免混合内容与 CSP 拦截。
11. **安全开关必须真的生效**：生产 cookie 必须带 `Secure` + `HttpOnly` + 合适的 `SameSite`；CSP 等开关要有「在打包产物里确实生效」的依据——构建期常量不保证被服务端产物替换（例：`import.meta.env.PROD` 在 Nitro 服务端产物里求值为 `process.env.PROD`，恒 `undefined`），判断生产环境请用项目既有的 `process.env.NODE_ENV === "production"`。
12. **DB 迁移**：禁用 `migrate dev/reset`，schema 变更走幂等脚本，避免数据丢失。

## 已知局限

以下是我们**已知且尚未**修掉的开放口子，不必当作新漏洞上报（有更好的修法欢迎提）：

- **DNS rebinding（TOCTOU）**：`urlGuard` 先解析并校验 URL，调用方 `fetch` 时会**重新解析**一次 DNS，理论上可在两次解析之间换掉目标 IP。彻底修复需要自定义 dispatcher，把已校验的 IP 钉到连接上。
- **CSP 的 script-src 需要放宽**：高德运行时 SDK 内部使用 `javascript:` URL，而 CSP3 下 nonce 在场会让 `'unsafe-inline'` 整体失效，因此本站 CSP 采用 `'unsafe-inline' 'unsafe-eval' 'self' https:` 而非 nonce + strict-dynamic——注入面比 nonce 方案大。评论 / 搜索等输出已转义 + DOMPurify 收敛，但这是有意的取舍。

## 威胁模型与范围

以下属于**本项目的既定设计**，请勿作为漏洞上报：

- **单人运营，没有多用户授权模型**：`db:init` 只种一个 `admin` 账号，`users` 表**没有 role 列**。因此接口里只校验「已登录」而不校验 role / 归属的地方，其「任意已登录用户」在事实上就是站主本人——不是提权漏洞。
- **有意公开的数据**：小程序接口 `/api/mini/links.get.ts` 返回站主的订阅列表，属**有意公开**的内容。
- **本机 / 部署环境相关**：通用浏览器与系统问题、第三方服务（腾讯云 COS、高德、宝塔面板等）自身的问题，以及你自己部署时的配置失误，请到对应上游反馈或自行排查。

## 支持版本

目前只有 `master` 分支作为持续开发的主线（本项目为主要维护者自用及开源，暂未做多版本维护）。安全修复会提交到 `master` 并发布 tag。若你依赖更早某次提交，请关注发布记录。
