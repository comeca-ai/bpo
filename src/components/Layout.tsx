import { Outlet } from 'react-router';
import OpsSidebar from '@/components/OpsSidebar';

/**
 * Shell das rotas internas (console ops): grid 238px + conteúdo.
 * Padrão B do contrato Layout+routing (renderiza <Outlet/>) —
 * App.tsx usa <Route> aninhadas. Rotas /cliente/* NÃO usam este Layout.
 */
export default function Layout() {
  return (
    <div className="grid min-h-[100dvh] grid-cols-[238px_1fr] bg-aj-cream text-aj-ink">
      <OpsSidebar />
      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
