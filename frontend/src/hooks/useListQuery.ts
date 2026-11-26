/**
 * useListQuery — danh sách phân trang phía server, bộ lọc đồng bộ với URL.
 *  - Bộ lọc, trang, số dòng/trang, sắp xếp nằm trên query string → chia sẻ link, nút Back hoạt động.
 *  - Đổi bộ lọc → tự về trang 1.
 *  - Bỏ qua kết quả của request cũ khi đã có request mới (tránh nhảy dữ liệu khi gõ nhanh).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Paged } from '../types/models'
import { errorMessage } from '../lib/errors'

export interface ListQueryOptions {
  pageSize?: number
  defaultSort?: string
}

export interface ListQuery<T, F extends string> {
  filters: Record<F, string>
  setFilter: (key: F, value: string) => void
  setFilters: (patch: Partial<Record<F, string>>) => void
  clearFilters: () => void
  activeFilterCount: number
  page: number
  pageSize: number
  sort: string
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setSort: (sort: string) => void
  /** Tham số hiện tại (bộ lọc + sort) — dùng cho xuất CSV toàn bộ. */
  params: Record<string, string>
  data: Paged<T> | undefined
  loading: boolean
  error: string | undefined
  reload: () => void
}

export function useListQuery<T, F extends string>(
  filterKeys: readonly F[],
  fetcher: (params: Record<string, string | number>) => Promise<Paged<T>>,
  options: ListQueryOptions = {},
): ListQuery<T, F> {
  const [search, setSearch] = useSearchParams()
  const defaultPageSize = options.pageSize ?? 20

  const filters = useMemo(() => {
    const out = {} as Record<F, string>
    for (const k of filterKeys) out[k] = search.get(k) ?? ''
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const page = Math.max(1, Number(search.get('page')) || 1)
  const pageSize = Number(search.get('pageSize')) || defaultPageSize
  const sort = search.get('sort') ?? options.defaultSort ?? ''

  const update = useCallback(
    (patch: Record<string, string>, resetPage: boolean) => {
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v)
            else next.delete(k)
          }
          if (resetPage) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setSearch],
  )

  const params = useMemo(() => {
    const p: Record<string, string> = {}
    for (const k of filterKeys) if (filters[k]) p[k] = filters[k]
    if (sort) p.sort = sort
    return p
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort])

  const [data, setData] = useState<Paged<T>>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [tick, setTick] = useState(0)
  const callId = useRef(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const paramsKey = JSON.stringify(params)
  useEffect(() => {
    const id = ++callId.current
    setLoading(true)
    setError(undefined)
    fetcherRef
      .current({ ...params, page, pageSize })
      .then((result) => {
        if (id !== callId.current) return
        // Trang vượt quá tổng số (vd. sau khi xóa) → lùi về trang cuối
        const lastPage = Math.max(1, Math.ceil(result.total / pageSize))
        if (page > lastPage && result.items.length === 0 && result.total > 0) {
          update({ page: String(lastPage) }, false)
          return
        }
        setData(result)
      })
      .catch((err) => {
        if (id === callId.current) setError(errorMessage(err))
      })
      .finally(() => {
        if (id === callId.current) setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, page, pageSize, tick])

  const activeFilterCount = filterKeys.filter((k) => filters[k]).length

  return {
    filters,
    setFilter: (key, value) => update({ [key]: value }, true),
    setFilters: (patch) => update(patch as Record<string, string>, true),
    clearFilters: () => update(Object.fromEntries(filterKeys.map((k) => [k, ''])), true),
    activeFilterCount,
    page,
    pageSize,
    sort,
    setPage: (p) => update({ page: p > 1 ? String(p) : '' }, false),
    setPageSize: (size) => update({ pageSize: size === defaultPageSize ? '' : String(size) }, true),
    setSort: (s) => update({ sort: s }, true),
    params,
    data,
    loading,
    error,
    reload: useCallback(() => setTick((t) => t + 1), []),
  }
}
