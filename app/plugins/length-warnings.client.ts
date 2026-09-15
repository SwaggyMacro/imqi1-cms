/**
 * 长度提示：服务端把超出建议长度的字段放在 X-Length-Warnings 响应头里（不拦截保存），
 * 这里挂在全局 $fetch 上统一弹 toast，各调用点不用各自处理。
 *
 * 走响应头而不塞响应体，是因为各接口返回结构不统一：有的是 { success, data }，有的直接返回整行。
 */
export default defineNuxtPlugin(() => {
  const toast = useToast();

  globalThis.$fetch = $fetch.create({
    onResponse({ response }) {
      const raw = response.headers.get("x-length-warnings");
      if (!raw) return;

      let warnings: { field: string; length: number; limit: number }[];
      try {
        warnings = JSON.parse(decodeURIComponent(raw));
      } catch {
        return;
      }
      if (!Array.isArray(warnings) || warnings.length === 0) return;

      toast.warning({
        message: "有字段超出建议长度",
        description: warnings.map(w => `${w.field} ${w.length}/${w.limit}`).join("、"),
      });
    },
  });
});
