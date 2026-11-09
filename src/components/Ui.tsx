import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode,
} from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { centsToInputText, digitsToCents } from '../lib/money'

export const inputCls =
  'block w-full min-h-12 rounded-xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 placeholder:text-stone-400 outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-200'

/* ---------- Botao (area de toque minima 48px) ---------- */
type Variant = 'primary' | 'secondary' | 'danger' | 'soft' | 'ghost'
const variants: Record<Variant, string> = {
  primary: 'bg-brand-800 text-white shadow-sm active:bg-brand-900',
  secondary: 'bg-white text-brand-900 border border-brand-800/30 active:bg-brand-50',
  soft: 'bg-brand-100 text-brand-900 active:bg-brand-200',
  danger: 'bg-red-600 text-white active:bg-red-700',
  ghost: 'bg-transparent text-stone-700 active:bg-stone-200',
}
export function Button({
  variant = 'primary', full, loading, className = '', children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean; loading?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 ${full ? 'w-full' : ''} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  )
}

/* ---------- Cartao ---------- */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  const bg = /(^|\s)bg-/.test(className) ? '' : 'bg-white'
  return <div className={`rounded-2xl border border-stone-200/70 p-4 shadow-sm ${bg} ${className}`}>{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">{children}</h2>
      {action}
    </div>
  )
}

/* ---------- Selo de situacao ---------- */
export type Tone = 'green' | 'yellow' | 'red' | 'gray'
const tones: Record<Tone, string> = {
  green: 'bg-brand-100 text-brand-800',
  yellow: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-stone-200 text-stone-700',
}
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>
}

/* ---------- Campos ---------- */
export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-stone-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
    </div>
  )
}

/** Valor em reais "estilo caixa", teclado numerico no iPhone. */
export function MoneyInput({ id, value, onChange }: { id?: string; value: number; onChange: (cents: number) => void }) {
  return (
    <input
      id={id}
      className={inputCls}
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="done"
      placeholder="R$ 0,00"
      value={centsToInputText(value)}
      onChange={(e) => onChange(digitsToCents(e.target.value))}
    />
  )
}

/** Escolha de 1 a N por botoes grandes (melhor que select no celular). */
export function Segmented({ options, value, onChange, label }: { options: number[]; value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-6 gap-1.5">
      {options.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={`min-h-12 rounded-xl border text-base font-bold transition active:scale-95 ${
            value === n ? 'border-brand-800 bg-brand-800 text-white' : 'border-stone-300 bg-white text-stone-700'
          }`}
        >
          {n}x
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-5 py-10 text-center">
      <p className="text-base font-bold text-stone-700">{title}</p>
      {text && <p className="mt-1 text-sm text-stone-500">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-stone-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{children}</div>
}

/* ---------- Folha inferior (modal) ---------- */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        className="relative w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-5 pt-3 shadow-2xl"
        style={{ maxHeight: 'calc(var(--vvh, 100dvh) - 0.75rem)', paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-300" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-stone-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 active:bg-stone-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ---------- Aviso rapido (toast) ---------- */
interface ToastApi { toast: (msg: string, tone?: 'ok' | 'error') => void }
const ToastCtx = createContext<ToastApi>({ toast: () => {} })
export const useToast = () => useContext(ToastCtx).toast

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<{ msg: string; tone: 'ok' | 'error'; id: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const toast = useCallback((msg: string, tone: 'ok' | 'error' = 'ok') => {
    window.clearTimeout(timer.current)
    setItem({ msg, tone, id: Date.now() })
    timer.current = window.setTimeout(() => setItem(null), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {item && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
          <div role="status" className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${item.tone === 'ok' ? 'bg-brand-800' : 'bg-red-600'}`}>
            {item.tone === 'ok' ? <Check className="h-5 w-5 shrink-0" /> : <X className="h-5 w-5 shrink-0" />}
            {item.msg}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  )
}
