import { toast } from 'vue-sonner'

import type { PromiseToastOptions, ToastProps } from '~/types/composables/toast'

// toast 描述最大字符数：按 vue-sonner 默认描述宽度 ~360px、字号 ~14px、
// 中文 ~25 字/行估算 2 行 ≈ 80 字符，超出加 … 截断
const TOAST_DESC_MAX_CHARS = 80

function truncateForToast(msg: string): string {
  if (msg.length <= TOAST_DESC_MAX_CHARS) return msg
  return msg.slice(0, TOAST_DESC_MAX_CHARS - 1) + '…'
}

// 从 $fetch / Nuxt 错误对象抽取后端 message
function extractApiError(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const err = error as { data?: { message?: unknown }; message?: unknown }
  const raw = err.data?.message ?? err.message
  return typeof raw === 'string' && raw ? raw : undefined
}

// 构造 vue-sonner 的 { description, duration }：
// - 传了 error 时，自动从错误对象提取并截断；提取失败回退到 description
// - 没传 error 时，description 原样透传（向后兼容旧调用）
const baseOptions = (props: ToastProps) => {
  let description = props.description
  if (props.error !== undefined) {
    const extracted = extractApiError(props.error)
    description = truncateForToast(extracted ?? props.description ?? '')
  }
  return {
    description,
    duration: props.duration ?? 4000,
  }
}

export const useToast = () => {
  const success = (props: ToastProps) =>
    toast.success(props.message, baseOptions(props))

  const error = (props: ToastProps) =>
    toast.error(props.message, baseOptions(props))

  const info = (props: ToastProps) =>
    toast.info(props.message, baseOptions(props))

  const warning = (props: ToastProps) =>
    toast.warning(props.message, baseOptions(props))

  const promise = <T,>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: PromiseToastOptions<T>
  ) => {
    return toast.promise(promise, {
      loading,
      success,
      error,
    })
  }

  return {
    success,
    error,
    info,
    warning,
    promise,
  }
}