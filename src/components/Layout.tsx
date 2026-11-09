import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ChevronLeft, House, Plus, Receipt, ShoppingBag, Users } from 'lucide-react'

/** Detecta teclado virtual (iOS) e expoe a altura visivel em --vvh. */
function useKeyboard(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
      setOpen(window.innerHeight - vv.height > 150)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return open
}

const items = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/vendas', label: 'Vendas', icon: ShoppingBag },
  { to: '/boletos', label: 'Boletos', icon: Receipt },
  { to: '/clientes', label: 'Clientes', icon: Users },
]

function NavItem({ to, label, icon: Icon, end }: (typeof items)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-h-14 min-w-11 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-brand-800' : 'text-stone-500'}`
      }
    >
      <Icon className="h-6 w-6" strokeWidth={2.2} />
      {label}
    </NavLink>
  )
}

export function AppShell() {
  const keyboard = useKeyboard()
  const navigate = useNavigate()
  return (
    <div className="min-h-dvh">
      <div className="pb-nav">
        <Outlet />
      </div>
      {!keyboard && (
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto grid max-w-xl grid-cols-5 items-center px-2">
            <NavItem {...items[0]} />
            <NavItem {...items[1]} />
            <div className="flex justify-center">
              <button
                type="button"
                aria-label="Nova venda"
                onClick={() => navigate('/vendas/nova')}
                className="-mt-7 flex h-16 w-16 items-center justify-center rounded-full bg-brand-800 text-white shadow-lg ring-4 ring-stone-100 transition active:scale-95 active:bg-brand-900"
              >
                <Plus className="h-8 w-8" strokeWidth={2.6} />
              </button>
            </div>
            <NavItem {...items[2]} />
            <NavItem {...items[3]} />
          </div>
        </nav>
      )}
    </div>
  )
}

/** Cabecalho verde que respeita a area segura (status bar do iPhone). */
export function PageHeader({
  title, subtitle, back, right, children,
}: { title: string; subtitle?: string; back?: string | boolean; right?: ReactNode; children?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="bg-brand-900 text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto max-w-xl px-4 pb-4 pt-3">
        <div className="flex min-h-11 items-center gap-1">
          {back && (
            <button
              type="button"
              aria-label="Voltar"
              onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
              className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold leading-tight">{title}</h1>
            {subtitle && <p className="truncate text-sm text-brand-100/90">{subtitle}</p>}
          </div>
          {right}
        </div>
        {children}
      </div>
    </header>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-xl px-4 pt-4">{children}</main>
}
