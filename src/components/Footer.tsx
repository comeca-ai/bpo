import LogoTick from '@/components/LogoTick';

/**
 * Rodapé mínimo — usado apenas no portal do cliente (rotas /cliente/*).
 */
export default function Footer() {
  return (
    <footer className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <LogoTick variant="dark" className="text-[20px]" />
      <p className="text-[12px] font-bold text-aj-faint">
        BPO híbrido de organização documental — agentes de IA + validação humana · ajeita.ia.br
      </p>
    </footer>
  );
}
