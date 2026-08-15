import { Routes, Route } from 'react-router';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Lotes from '@/pages/Lotes';
import Clientes from '@/pages/Clientes';
import ClientePortal from '@/pages/ClientePortal';

export default function App() {
  return (
    <Routes>
      {/* Rotas internas — shell com OpsSidebar (Layout renderiza <Outlet/>) */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/ops" element={<Home />} />
        <Route path="/lotes" element={<Lotes />} />
        <Route path="/clientes" element={<Clientes />} />
      </Route>
      {/* Portal do cliente — sem sidebar */}
      <Route path="/cliente/:loteId" element={<ClientePortal />} />
    </Routes>
  );
}
