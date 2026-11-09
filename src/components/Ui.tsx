import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode,
} from 'react'
import { Check, Loader2, Minus, Plus, X } from 'lucide-react'
import { centsToInputText, digitsToCents } from '../lib/money'

export const inputCls =
  'block w-full min-h-12 rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-stone-500 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100'

/* ---------- Botao (area de toque minima 48px) ---------- */
type Variant = 'primary' | 'secondary' | 'danger' | 'soft' | 'ghost'
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-pop active:bg-brand-700',
  secondary: 'bg-white text-brand-800 border border-brand-300 active:bg-brand-50',
  soft: 'bg-brand-100 text-brand-800 active:bg-brand-200',
  danger: 'bg-red-700 text-white active:bg-red-800',
  ghost: 'bg-transparent text-stone-700 active:bg-brand-50',
}
export function Button({
  variant = 'primary', full, loading, className = '', children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean; loading?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition duration-150 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none ${full ? 'w-full' : ''} ${variants[variant]} ${className}`}
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
  return <div className={`rounded-3xl border border-brand-100 p-4 shadow-card ${bg} ${className}`}>{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-7 flex items-center justify-between px-1">
      <h2 className="text-xl text-brand-800">{children}</h2>
      {action}
    </div>
  )
}

/* ---------- Selo de situacao ---------- */
export type Tone = 'green' | 'yellow' | 'red' | 'gray' | 'rose'
const tones: Record<Tone, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  yellow: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-stone-200 text-stone-700',
  rose: 'bg-brand-100 text-brand-800',
}
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>
}

/* ---------- Campos ---------- */
export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-brand-800">{label}</label>
      {children}
      {hint && <p className="text-xs text-stone-600">{hint}</p>}
    </div>
  )
}

/** Valor em reais "estilo caixa", teclado numerico no iPhone. */
export function MoneyInput({ id, value, onChange, placeholder = 'R$ 0,00' }: { id?: string; value: number; onChange: (cents: number) => void; placeholder?: string }) {
  return (
    <input
      id={id}
      className={`${inputCls} tabular`}
      inputMode="numeric"
      autoComplete="off"
      enterKeyHint="next"
      placeholder={placeholder}
      value={centsToInputText(value)}
      onChange={(e) => onChange(digitsToCents(e.target.value))}
    />
  )
}

/** Quantidade com botoes grandes (-/+), teclado numerico. */
export function Stepper({ id, value, onChange, min = 1, max = 999 }: { id?: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)))
  return (
    <div className="flex items-stretch gap-2">
      <button type="button" aria-label="Diminuir quantidade" onClick={() => set(value - 1)} disabled={value <= min}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-300 bg-white text-brand-800 transition active:scale-95 active:bg-brand-50 disabled:opacity-40">
        <Minus className="h-5 w-5" />
      </button>
      <input
        id={id} className={`${inputCls} text-center font-bold tabular`} inputMode="numeric" autoComplete="off"
        value={String(value)}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '').slice(0, 3)
          set(d ? parseInt(d, 10) : min)
        }}
        onFocus={(e) => e.target.select()}
      />
      <button type="button" aria-label="Aumentar quantidade" onClick={() => set(value + 1)} disabled={value >= max}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-300 bg-white text-brand-800 transition active:scale-95 active:bg-brand-50 disabled:opacity-40">
        <Plus className="h-5 w-5" />
      </button>
    </div>
  )
}

/** Escolha de 1 a N por botoes grandes (melhor que select no celular). */
export function Segmented({ options, value, onChange, label }: { options: number[]; value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2 min-[370px]:grid-cols-6 min-[370px]:gap-1.5">
      {options.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={`min-h-12 rounded-2xl border text-base font-bold transition active:scale-95 ${
            value === n ? 'border-brand-600 bg-brand-600 text-white shadow-pop' : 'border-brand-300 bg-white text-brand-800'
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
    <div className="rounded-3xl border border-dashed border-brand-300 bg-brand-50/60 px-5 py-10 text-center">
      <p className="font-display text-xl text-brand-800">{title}</p>
      {text && <p className="mt-1 text-sm text-stone-600">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

export function Spinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-stone-600" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-brand-600" /> {label}
    </div>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{children}</div>
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
      <button type="button" aria-label="Fechar" className="anim-fade absolute inset-0 bg-brand-900/45" onClick={onClose} />
      <div
        className="anim-sheet relative w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-[2rem] bg-paper px-5 pt-3 shadow-2xl"
        style={{ maxHeight: 'calc(var(--vvh, 100dvh) - 0.75rem)', paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-brand-200" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-2xl text-brand-800">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-800 active:bg-brand-200">
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
          <div role="status" className={`anim-rise pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${item.tone === 'ok' ? 'bg-brand-800' : 'bg-red-700'}`}>
            {item.tone === 'ok' ? <Check className="h-5 w-5 shrink-0" /> : <X className="h-5 w-5 shrink-0" />}
            {item.msg}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  )
}
