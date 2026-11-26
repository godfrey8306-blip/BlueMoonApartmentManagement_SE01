/**
 * UIContext.tsx
 * - Toast thông báo (success / error / info / warning) góc dưới phải.
 * - confirm(): hộp thoại xác nhận cho thao tác nhạy cảm.
 *     · details: bảng tóm tắt [nhãn, giá trị] để người dùng kiểm tra trước khi đồng ý
 *     · warning: cảnh báo hậu quả (vd. "không thể hoàn tác")
 *     · requireText: phải gõ đúng chuỗi này mới bật nút xác nhận (thao tác rất nguy hiểm)
 *     · onConfirm: chạy thao tác ngay trong hộp thoại (spinner, lỗi hiển thị tại chỗ, không đóng khi lỗi)
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Modal } from '../components/Modal'
import { errorMessage } from '../lib/errors'

type ToastKind = 'success' | 'error' | 'info' | 'warning'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

export interface ConfirmOptions {
  title?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  details?: [string, ReactNode][]
  warning?: ReactNode
  requireText?: string
  onConfirm?: () => Promise<unknown>
}

interface ConfirmState extends ConfirmOptions {
  message: ReactNode
  resolve: (ok: boolean) => void
}

interface UIContextValue {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
    warning: (message: string) => void
  }
  confirm: (message: ReactNode, options?: ConfirmOptions) => Promise<boolean>
}

const UIContext = createContext<UIContextValue | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmError, setConfirmError] = useState<string>()
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++
      setToasts((list) => [...list.slice(-4), { id, kind, message }])
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000)
    },
    [dismiss],
  )

  const confirm = useCallback((message: ReactNode, options?: ConfirmOptions) => {
    setTyped('')
    setConfirmError(undefined)
    setBusy(false)
    return new Promise<boolean>((resolve) => setConfirmState({ message, resolve, ...options }))
  }, [])

  function close(ok: boolean) {
    if (busy) return
    confirmState?.resolve(ok)
    setConfirmState(null)
  }

  async function accept() {
    if (!confirmState) return
    if (confirmState.onConfirm) {
      setBusy(true)
      setConfirmError(undefined)
      try {
        await confirmState.onConfirm()
      } catch (err) {
        setConfirmError(errorMessage(err))
        setBusy(false)
        return
      }
      setBusy(false)
    }
    confirmState.resolve(true)
    setConfirmState(null)
  }

  const value = useMemo<UIContextValue>(
    () => ({
      toast: {
        success: (m) => push('success', m),
        error: (m) => push('error', m),
        info: (m) => push('info', m),
        warning: (m) => push('warning', m),
      },
      confirm,
    }),
    [push, confirm],
  )

  const blocked = !!confirmState?.requireText && typed.trim() !== confirmState.requireText

  return (
    <UIContext.Provider value={value}>
      {children}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Đóng thông báo">
              ×
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(confirmState)}
        size={confirmState?.details ? 'md' : 'sm'}
        title={confirmState?.title ?? 'Xác nhận'}
        onClose={() => close(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => close(false)} disabled={busy}>
              {confirmState?.cancelText ?? 'Hủy'}
            </button>
            <button
              type="button"
              className={`btn ${confirmState?.danger ? 'btn-danger-solid' : 'btn-primary'}`}
              onClick={accept}
              disabled={blocked || busy}
              autoFocus={!confirmState?.requireText}
            >
              {busy && <span className="spinner spinner-sm" aria-hidden="true" />}
              {busy ? 'Đang xử lý…' : (confirmState?.confirmText ?? 'Đồng ý')}
            </button>
          </>
        }
      >
        {confirmError && <div className="alert alert-error">{confirmError}</div>}
        <div style={{ lineHeight: 1.55 }}>{confirmState?.message}</div>
        {confirmState?.details && confirmState.details.length > 0 && (
          <dl className="confirm-details">
            {confirmState.details.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {confirmState?.warning && <div className="alert alert-warning mt-16 mb-0">⚠️ {confirmState.warning}</div>}
        {confirmState?.requireText && (
          <div className="field mt-16">
            <label htmlFor="confirm-type">
              Gõ <strong className="text-danger">{confirmState.requireText}</strong> để xác nhận
            </label>
            <input
              id="confirm-type"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              autoComplete="off"
              onKeyDown={(e) => e.key === 'Enter' && !blocked && accept()}
            />
          </div>
        )}
      </Modal>
    </UIContext.Provider>
  )
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside <UIProvider>')
  return ctx
}
