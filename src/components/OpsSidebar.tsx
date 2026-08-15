import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import LogoTick from '@/components/LogoTick';
import { useOpsState } from '@/lib/ops-store';

type NavEntry = {
  label: string;
  to?: string;
  external?: boolean;
  disabled?: boolean;
  badge?: number;
  active?: boolean;
};

function NavItem({ entry }: { entry: NavEntry }) {
  const cls = cn(
    'flex w-full items-center gap-[11px] rounded-xl px-[14px] py-[10px] text-left text-[14px] font-extrabold no-underline transition-colors',
    entry.disabled
      ? 'cursor-default text-aj-sand/50'
      : 'cursor-pointer text-aj-sand hover:bg-white/[.07] hover:text-aj-cream',
    entry.active && 'bg-[rgba(245,130,13,.16)] text-[#FFB86B] hover:bg-[rgba(245,130,13,.16)] hover:text-[#FFB86B]',
  );
  const inner = (
    <>
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full bg-current opacity-[.55]',
          entry.active && 'bg-aj-orange opacity-100',
        )}
      />
      {entry.label}
      {typeof entry.badge === 'number' && (
        <span className="ml-auto rounded-full bg-aj-orange px-[9px] py-[2px] text-[11.5px] font-black text-white [font-variant-numeric:tabular-nums]">
          {entry.badge}
        </span>
      )}
    </>
  );
  if (entry.disabled || !entry.to) {
    return (
      <button type="button" className={cls} disabled={entry.disabled}>
        {inner}
      </button>
    );
  }
  if (entry.external) {
    return (
      <Link to={entry.to} target="_blank" rel="noreferrer" className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <Link to={entry.to} className={cls}>
      {inner}
    </Link>
  );
}

/**
 * Sidebar do console ops (238px, fundo --dark, sticky).
 * Navegação principal do app — usada pelo Layout das rotas internas.
 */
export default function OpsSidebar() {
  const { pathname } = useLocation();
  const { queueLeft, validatedToday } = useOpsState();

  const nav: NavEntry[] = [
    {
      label: 'Lote em trabalho',
      to: '/',
      active: pathname === '/' || pathname === '/ops',
      badge: queueLeft,
    },
    { label: 'Lotes', to: '/lotes', active: pathname.startsWith('/lotes') },
    { label: 'Visão do cliente ↗', to: '/cliente/482', external: true },
    { label: 'Clientes e contexto', to: '/clientes', active: pathname.startsWith('/clientes') },
    { label: 'Financeiro', disabled: true },
  ];

  return (
    <aside className="sticky top-0 flex h-[100dvh] w-[238px] shrink-0 flex-col gap-2 bg-aj-dark px-[18px] py-[26px] text-aj-cream">
      <div>
        <Link to="/" className="inline-block no-underline">
          <LogoTick variant="light" />
        </Link>
      </div>
      <div className="mb-5 mt-[10px] text-[10.5px] font-extrabold uppercase tracking-[.14em] text-aj-faint">
        ops · console interno v1
      </div>

      <nav className="flex flex-col gap-2">
        {nav.map((entry) => (
          <NavItem key={entry.label} entry={entry} />
        ))}
      </nav>

      <div className="mx-[14px] mb-0 mt-4 text-[10.5px] font-black uppercase tracking-[.12em] text-aj-caption">
        Canais conectados
      </div>
      <div className="px-[14px] py-[7px] text-[12.5px] font-extrabold text-aj-sand">🟢 WhatsApp — 3 números</div>
      <div className="px-[14px] py-[7px] text-[12.5px] font-extrabold text-aj-sand">🟢 E-mail — ajeita@recebe</div>
      <div className="px-[14px] py-[7px] text-[12.5px] font-extrabold text-aj-sand">🟢 Drive — 6 pastas ativas</div>

      <div className="mt-auto rounded-[14px] border border-white/10 bg-white/[.06] p-[14px]">
        <div className="text-[14px] font-black text-white">Nizan Jhon</div>
        <div className="mt-[2px] text-[12px] font-bold text-aj-faint">Organizador · validação</div>
        <div className="mt-[10px] text-[12px] font-extrabold text-aj-teal-light [font-variant-numeric:tabular-nums]">
          Hoje: {validatedToday} docs validados · 11s/doc
        </div>
      </div>
    </aside>
  );
}
