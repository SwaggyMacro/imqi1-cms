---
name: trusted-proxy-cidr-and-docker-ip-collapse
description: TRUSTED_PROXY 支持 CIDR（匹配逻辑抽到 server/utils/ip-match.ts）；Docker 端口映射下容器看到的对端是网桥网关而非 loopback，不配白名单则访客 IP 全塌缩（评论 IP/足迹去重/限流键）
metadata:
  node_type: memory
  type: security
---

`TRUSTED_PROXY`（`server/utils/client-ip.ts` 的受信代理白名单）**原先只做精确字符串匹配**（`allow.includes(peer)`），填网段无效——2026-09-14 改为支持单个 IP 或 CIDR。匹配逻辑抽到 `server/utils/ip-match.ts` 的 `matchIpPattern`；`expandIpv6` 从 `urlGuard.ts` 搬到同一模块共用（避免两份 IPv6 展开各写各的）。全程按字节比对，并把 `::ffff:a.b.c.d` 及 Node 规范化出的 hex 写法（`::ffff:a9fe:a9fe`）归一成 4 字节——**否则 IPv6 socket 下的对端永远匹配不上 IPv4 网段**（同类坑见 [[ssrf-ipv6-urlguard]]）。

**为什么必须支持网段**：Docker 端口映射下，宿主 nginx 回源到容器时，容器看到的对端是 **docker 网桥网关，不是 loopback**（实测：默认 bridge `172.17.0.1`，compose 的自定义网桥 `172.26.0.1`/`172.26.0.0/16`）。对端既非 loopback 又不在白名单 → 转发头被丢弃 → 所有访客 IP 塌缩成那个网关地址：评论入库 IP 全一样、足迹去重把所有访客当同一人、**限流键全塌缩成一个**（一个人狂试密码能把全站登录一起锁死）。而且网段由 docker **动态分配**，写死单个 IP 换个环境/换台机器就失效，且**静默失效**（不报错，只是 IP 一直在塌缩）。故 Docker/云 LB/远程 nginx 场景直接填网段，如 `TRUSTED_PROXY=172.16.0.0/12`（覆盖 docker 默认私有段）。

裸机宝塔（本机 nginx）对端是 `127.0.0.1`，走 `isLoopback` 分支，**免配**。

**别跟 [[redis-build-baked-docker-ondemand]] 之外的另一个同名物混**：`DEPLOY_TRUSTED_PROXY` 是喂给 nginx `set_real_ip_from` 的，一直是支持 CIDR 的；`TRUSTED_PROXY` 才是应用侧那个。两个名字像、语义不同。

**验证方式**（本仓库无测试框架）：`bun -e` 直接跑 util。注意 `getClientIp` 依赖 Nitro 自动导入的 `getHeader`，在 Nitro 外调用要先挂 `globalThis.getHeader = (e, n) => e.node.req.headers[n.toLowerCase()]`，再用 `{ context: { clientAddress: peer }, node: { req: { socket: { remoteAddress: peer }, headers } } }` 造事件、改 `process.env.TRUSTED_PROXY` 逐条断言。

呼应：Docker 部署里 `.sessions`（后台 `sessionStoreType=file` 时的会话落盘处）**已挂具名卷 `sessions-data`**（2026-09-14 补）——之前没挂，`up -d --build` 重建容器会掉登录态。**该卷的属主继承自 Dockerfile 预建并 `chown node:node` 的 `/app/.sessions`**，所以那行 chown 不能删（实测：去掉后卷是 root 属主，非 root 的 node 用户写 `Permission denied`）。两套 compose 项目名同为 `imqi1-cms`，故卷名相同、两套之间切换共享数据。ISR 的文件系统缓存（非 Redis 时 `./.nitro/cache`）**故意不挂**——它是缓存、重建后重新生成才对。
