import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'

interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: string | undefined
  reload: () => void
}

/**
 * Gọi hàm bất đồng bộ khi deps thay đổi; bỏ qua kết quả của request cũ
 * nếu đã có request mới (tránh race condition khi gõ filter).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): AsyncState<T> {
  const [data, setData] = useState<T | undefined>()
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | undefined>()
  const [tick, setTick] = useState(0)
  const callId = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const id = ++callId.current
    setLoading(true)
    setError(undefined)
    fn()
      .then((result) => {
        if (id === callId.current) setData(result)
      })
      .catch((err) => {
        if (id === callId.current) setError(errorMessage(err))
      })
      .finally(() => {
        if (id === callId.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}

/** Trì hoãn giá trị (dùng cho ô tìm kiếm để không gọi API mỗi lần gõ phím). */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(t)
  }, [value, delay])
  return debounced
}
