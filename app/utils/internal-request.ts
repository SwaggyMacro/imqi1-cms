export function getInternalRequestHeaders(): Record<string, string> {
  if (!import.meta.server) {
    return {};
  }

  // 密钥由 server/plugins/ssr-internal-secret.ts 在进程启动时写入 process.env
  // （未配置 SSR_INTERNAL_REQUEST_SECRET 则为随机值），校验端 referer-check.ts 读同一份。
  // 应用层直接读 process.env，不经 Nuxt runtimeConfig 注入。
  // 取不到就不带这个头——不回落到源码里的公开常量（否则任何人都能伪造该头绕过 referer 门禁）。
  const secret = process.env.SSR_INTERNAL_REQUEST_SECRET;
  if (!secret) {
    return {};
  }

  return {
    "x-ssr-internal-request": secret,
  };
}
