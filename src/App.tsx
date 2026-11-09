import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './data/AuthContext'
import { DataProvider } from './data/DataContext'
import { AppShell } from './components/Layout'
import { Spinner, ToastProvider } from './components/Ui'
import Login from './pages/Login'
import NewPassword from './pages/NewPassword'
import Activate from './pages/Activate'
import Home from './pages/Home'
import Sales from './pages/Sales'
import SaleForm from './pages/SaleForm'
import SaleDetail from './pages/SaleDetail'
import Bills from './pages/Bills'
import BillForm from './pages/BillForm'
import Clients from './pages/Clients'
import ClientForm from './pages/ClientForm'
import ClientDetail from './pages/ClientDetail'
import Payments from './pages/Payments'
import Monthly from './pages/Monthly'
import SettingsPage from './pages/SettingsPage'

const ImportPage = lazy(() => import('./pages/ImportPage'))

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  return <DataProvider>{children}</DataProvider>
}

export default function App() {
  return (
    // HashRouter: funciona em qualquer hospedagem estatica (atualizar a pagina nunca da 404) e no modo standalone do iPhone.
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/nova-senha" element={<NewPassword />} />
            <Route path="/ativar" element={<Activate />} />
            <Route element={<Protected><AppShell /></Protected>}>
              <Route index element={<Home />} />
              <Route path="vendas" element={<Sales />} />
              <Route path="vendas/nova" element={<SaleForm />} />
              <Route path="vendas/:id" element={<SaleDetail />} />
              <Route path="boletos" element={<Bills />} />
              <Route path="boletos/novo" element={<BillForm />} />
              <Route path="boletos/:id/editar" element={<BillForm />} />
              <Route path="clientes" element={<Clients />} />
              <Route path="clientes/novo" element={<ClientForm />} />
              <Route path="clientes/:id" element={<ClientDetail />} />
              <Route path="clientes/:id/editar" element={<ClientForm />} />
              <Route path="pagamentos" element={<Payments />} />
              <Route path="controle" element={<Monthly />} />
              <Route path="ajustes" element={<SettingsPage />} />
              <Route path="ajustes/importar" element={<Suspense fallback={<Spinner />}><ImportPage /></Suspense>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  )
}
