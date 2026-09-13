export type ToastProps = {
  message: string
  description?: string
  duration?: number
  /**
   * 传入 API 错误对象时，自动从 error.data.message 提取作为 description，
   * 并按 2 行 toast 描述的字符密度截断；提取失败时回退到 description
   */
  error?: unknown
}

/** useToast().promise 的选项：loading 文案 + 成功/失败文案（可为函数，接收 resolved/rejected 值） */
export type PromiseToastOptions<T> = {
  loading: string
  success: string | ((data: T) => string)
  error: string | ((err: unknown) => string)
}