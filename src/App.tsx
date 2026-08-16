import { Routes, Route } from 'react-router';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Lotes from '@/pages/Lotes';
import Clientes from '@/pages/Clientes';
import ClientePortal from '@/pages/ClientePortal';
import Landing from '@/pages/Landing';
import Contratar from '@/pages/Contratar';

export default function App() {
  return (
    <Routes>
      {/* Rotas internas — shell com OpsSidebar (Layout renderiza <Outlet/>) */}
      <Route element={<Layout />}>
        <Route path="/ops" element={<Home />} />
        <Route path="/lotes" element={<Lotes />} />
        <Route path="/clientes" element={<Clientes />} />
      </Route>
      {/* Público — sem sidebar */}
      <Route path="/" element={<Landing />} />
      <Route path="/contratar" element={<Contratar />} />
      <Route path="/cliente/:loteId" element={<ClientePortal />} />
    </Routes>
  );
}
