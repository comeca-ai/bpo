import { useParams } from 'react-router';
import LogoTick from '@/components/LogoTick';
import Footer from '@/components/Footer';

export default function ClientePortal() {
  const { loteId } = useParams();
  return (
    <div className="flex min-h-[100dvh] flex-col bg-aj-cream">
      <header className="px-6 pb-2 pt-6">
        <LogoTick variant="dark" />
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[560px] rounded-[18px] border border-aj-border bg-white px-[22px] py-5 text-center">
          <h1 className="text-[15.5px] font-black">Portal do cliente — lote #{loteId}</h1>
          <p className="mt-1 text-[12.5px] font-bold text-aj-faint">
            Página em construção — acompanhamento ao vivo e aprovação final.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
