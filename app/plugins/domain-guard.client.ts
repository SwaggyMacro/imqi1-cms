import { siteConfig } from "~~/site.config";

/**
 * 防止反向代理插件
 * 仅在生产环境且配置了 rootDomain 时启用
 * 如果当前访问域名与 rootDomain 不匹配，则强制跳转
 */
export default defineNuxtPlugin(() => {
  // 只在生产环境启用
  if (import.meta.dev) {
    return;
  }

  // 跳转目标固定取构建期配置，不跟随后台设置：这里是唯一会主动跳转的地方，
  // 一旦后台把站点地址填错，跟着走就是全站访客被弹去错误域名；留在构建期常量上，
  // 填错最坏只是 canonical 等标签指错域名，站点本身仍可访问。
  const rootDomain = siteConfig.site.rootDomain;

  // 如果未配置 rootDomain，则不启用防护
  if (!rootDomain) {
    return;
  }

  // 在客户端执行域名检查
  if (import.meta.client) {
    // 检查当前域名
    const currentHost = window.location.hostname;

    // 如果当前域名与 rootDomain 不匹配，则强制跳转
    if (currentHost !== rootDomain) {
      // 构建目标 URL
      const currentPath = window.location.pathname;
      const currentSearch = window.location.search;
      const currentHash = window.location.hash;

      const targetUrl = `https://${rootDomain}${currentPath}${currentSearch}${currentHash}`;

      // 强制跳转到目标域名
      window.location.href = targetUrl;
    }
  }
});
