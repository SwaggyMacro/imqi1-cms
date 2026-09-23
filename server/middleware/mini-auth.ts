import { getMiniApiSecret, verifyMiniSignature } from "#server/utils/mini-auth";

/**
 * 小程序 API 鉴权中间件。
 *
 * 覆盖 `/api/mini/*` 全部方法（GET/POST 等），校验 HMAC-SHA256 签名 + 时间戳。
 * 与 referer-check 的取舍一致：
 *   - 开发环境（NODE_ENV=development）跳过，方便本地调试；
 *   - 生产环境未配置 MINI_API_SECRET 时 fail-closed（拒绝 401），避免未鉴权放行公开接口。
 *
 * CORS 预检（OPTIONS）不带签名头且由 [...].options.ts 单独处理，此处显式放行。
 */
export default defineEventHandler(event => {
  const path = event.node.req.url;

  // 仅拦截小程序接口
  if (!path || (path !== "/api/mini" && !path.startsWith("/api/mini/"))) {
    return;
  }

  // 小程序 API 默认不缓存：避免 CDN / 浏览器在 5 分钟窗口里继续返回旧数据。
  // 主站后台改文章会触发 invalidateContentCaches 清掉主站页面 ISR，但**不**清
  // 客户端 / CDN 的 HTTP 缓存；把 Cache-Control 直接置 no-store 后，每次请求都
  // 回源到服务端拿到最新内容。POST 默认也不缓存，加这个头对它无副作用。
  setHeader(event, "Cache-Control", "no-store, max-age=0, must-revalidate");

  // 跳过开发环境
  if (process.env.NODE_ENV === "development") {
    return;
  }

  // CORS 预检放行（交给 [...].options.ts 设置响应头）
  if ((event.node.req.method || "").toUpperCase() === "OPTIONS") {
    return;
  }

  // 未配置密钥时 fail-closed：生产环境拒绝，避免 /api/mini/* 未鉴权放行
  const secret = getMiniApiSecret();
  if (!secret) {
    console.error("[mini-auth] 缺少 MINI_API_SECRET，已拒绝访问 /api/mini/*（生产环境必须配置）");
    setResponseStatus(event, 401);
    return "";
  }

  const result = verifyMiniSignature(event, secret);
  if (!result.ok) {
    console.warn("[mini-auth] 鉴权失败:", result.reason, path);
    setResponseStatus(event, 401);
    return "";
  }
});
