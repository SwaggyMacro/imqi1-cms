import { randomBytes } from "crypto";

/**
 * 服务启动时兜底生成 SSR 内部请求密钥。
 *
 * `x-ssr-internal-request` 头用于让服务端自己的 SSR 请求绕过 referer 门禁
 * （发起端 app/utils/internal-request.ts，校验端 server/middleware/referer-check.ts）。
 * 这两处分属 app / nitro 两个 bundle，模块级状态互不可见，故密钥必须落在进程级共享的
 * process.env 上：本插件在启动时写入，两侧随后读到的就是同一个值。
 *
 * 未配置 SSR_INTERNAL_REQUEST_SECRET 时生成随机值，**不再回落到源码里写死的常量**——本仓库公开，
 * 那个常量等于把门禁钥匙写在明处（谁都能发那个头绕过 referer 校验）。这与
 * server/utils/security-token.ts 对 LOGIN_SECRET 的兜底策略一致：宁可每次启动换密钥，也不留公开常量。
 *
 * 密钥随进程重启变化无副作用：校验端与发起端同进程，总是一起变，SSR 不会因此失败；
 * 要跨重启稳定（或与外部调用方约定）就显式配置 SSR_INTERNAL_REQUEST_SECRET。
 */
export default defineNitroPlugin(() => {
  if (process.env.SSR_INTERNAL_REQUEST_SECRET) {
    return;
  }

  process.env.SSR_INTERNAL_REQUEST_SECRET = randomBytes(32).toString("hex");

  // 开发环境 referer 门禁整段跳过（NODE_ENV=development），无需提示
  if (process.env.NODE_ENV === "production") {
    console.warn("[security] 未配置 SSR_INTERNAL_REQUEST_SECRET，已生成本次进程的随机密钥（重启会变，生产建议显式配置）");
  }
});
