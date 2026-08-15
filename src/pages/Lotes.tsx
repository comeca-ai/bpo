import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { cn } from '@/lib/utils';
import { CountUp, LiveDot, OpsTopbar, Pill, Rise, Skeleton } from '@/components/gestao/bits';
import type { LoteVM, StatusBucket } from '@/components/gestao/fallback-data';
import { LOTES_FALLBACK } from '@/components/gestao/fallback-data';

/* ---------- helpers de data (pt-BR, estilo dos mockups) ---------- */

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pad = (n: number) => String(n).padStart(2, '0');
const fmtHora = (d: Date) => `${pad(d.getHours())}h${pad(d.getMinutes())}`;
const fmtCurto = (d: Date) => `${DIAS[d.getDay()]} ${fmtHora(d)}`;
const fmtDiaHora = (d: Date) => `${DIAS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${fmtHora(d)}`;
const fmtDM = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

const CANAL: Record<string, { icon: string; label: string }> = {
  whatsapp: { icon: '🟢', label: 'WhatsApp' },
  email: { icon: '✉', label: 'E-mail' },
  drive: { icon: '📁', label: 'Drive' },
  upload: { icon: '⬆', label: 'Upload' },
};

type LoteApi = {
  id: number;
  numero: number;
  titulo: string;
  canal: 'whatsapp' | 'email' | 'drive' | 'upload';
  qtdArquivos: number;
  status: StatusBucket;
  docsAjeitados: number;
  recebidoEm: Date;
  prazoEm: Date;
  entregueEm: Date | null;
  clienteNome: string;
};

function vmFromApi(l: LoteApi): LoteVM {
  const canal = CANAL[l.canal] ?? CANAL.upload;
  const recebido = new Date(l.recebidoEm);
  const prazo = new Date(l.prazoEm);
  const entregue = l.entregueEm ? new Date(l.entregueEm) : null;
  const recente = Date.now() - recebido.getTime() < 7 * 864e5;
  const done = l.status === 'entregue' || l.status === 'aprovado';
  const horas = Math.max(0, Math.round((prazo.getTime() - Date.now()) / 36e5));
  return {
    id: l.id,
    numero: l.numero,
    descricao: `${l.qtdArquivos} arq · ${l.titulo}`,
    clienteNome: l.clienteNome,
    canalIcon: canal.icon,
    canalLabel: canal.label,
    recebidoTxt: recente ? fmtCurto(recebido) : fmtDM(recebido),
    prazoTxt: entregue ? `entregue ${fmtCurto(entregue)}` : fmtDiaHora(prazo),
    prazoHint: !done && horas > 0 && horas < 96 ? `${horas}h` : null,
    progresso: done ? 100 : Math.min(100, Math.round((l.docsAjeitados / Math.max(1, l.qtdArquivos)) * 100)),
    fila: null, // preenchido ao vivo via FilaPill (query por lote)
    bucket: l.status,
    responsavel: l.status === 'processando' || l.status === 'recebido' ? null : 'NJ',
  };
}

/* ---------- tipos de filtro/ordenação ---------- */

type StatusFilter = 'todos' | StatusBucket;
type SortKey = 'prazo' | 'recebido' | 'progresso';

const ATIVOS: StatusBucket[] = ['recebido', 'processando', 'em_validacao', 'pronto_entrega'];

function matchStatus(row: LoteVM, f: StatusFilter): boolean {
  if (f === 'todos') return true;
  if (f === 'em_validacao') return row.bucket === 'em_validacao' || row.bucket === 'pronto_entrega';
  return row.bucket === f;
}

function sortRows(rows: LoteVM[], key: SortKey): LoteVM[] {
  const arr = [...rows];
  if (key === 'recebido') arr.sort((a, b) => b.numero - a.numero);
  else if (key === 'progresso') arr.sort((a, b) => b.progresso - a.progresso || b.numero - a.numero);
  else
    arr.sort((a, b) => {
      const aAt = ATIVOS.includes(a.bucket) ? 0 : 1;
      const bAt = ATIVOS.includes(b.bucket) ? 0 : 1;
      return aAt - bAt || b.numero - a.numero;
    });
  return arr;
}

/* ---------- status pill ---------- */

function StatusPill({ bucket }: { bucket: StatusBucket }) {
  if (bucket === 'em_validacao')
    return (
      <Pill tone="green" className="px-[13px] py-[6px] text-[12px]">
        <LiveDot />
        Em trabalho
      </Pill>
    );
  if (bucket === 'processando')
    return (
      <Pill tone="green" className="px-[13px] py-[6px] text-[12px]">
        Processando
      </Pill>
    );
  if (bucket === 'recebido')
    return (
      <Pill tone="gray" className="px-[13px] py-[6px] text-[12px]">
        Recebido
      </Pill>
    );
  if (bucket === 'pronto_entrega')
    return (
      <Pill tone="orange" className="px-[13px] py-[6px] text-[12px]">
        Pronto p/ entrega
      </Pill>
    );
  if (bucket === 'entregue')
    return (
      <Pill tone="gray" className="px-[13px] py-[6px] text-[12px]">
        Aguardando aprovação
      </Pill>
    );
  return (
    <Pill tone="green" className="px-[13px] py-[6px] text-[12px]">
      Aprovado ✓
    </Pill>
  );
}

/* ---------- pill de fila de validação (dados reais por lote) ---------- */

function FilaPill({ loteId, fallbackCount }: { loteId?: number; fallbackCount: number | null }) {
  const q = trpc.validacao.fila.useQuery(
    { loteId: loteId ?? 0 },
    { enabled: loteId != null, retry: 1, staleTime: 10_000 },
  );
  const n = loteId != null && q.data && !q.isError ? q.data.length : fallbackCount;
  if (n == null) return <span className="text-[12.5px] font-extrabold text-aj-faint">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-aj-actbg px-[11px] py-[4px] text-[12px] font-black text-aj-orange [font-variant-numeric:tabular-nums]">
      {n}
    </span>
  );
}

/* ---------- mini barra de progresso ---------- */

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-[8px]">
      <div className="h-[8px] w-[90px] overflow-hidden rounded-full bg-aj-rail">
        <motion.i
          className={cn(
            'block h-full rounded-full',
            pct >= 100 ? 'bg-aj-teal' : 'bg-[linear-gradient(90deg,#2FC79E,#F5820D)]',
          )}
          initial={{ width: '0%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[12px] font-extrabold text-aj-muted [font-variant-numeric:tabular-nums]">
        {pct}%
      </span>
    </div>
  );
}

/* ---------- página: Lotes / Pipeline ---------- */

export default function Lotes() {
  const navigate = useNavigate();
  const lotesQ = trpc.lotes.list.useQuery(undefined, { retry: 1, staleTime: 15_000 });

  const [statusF, setStatusF] = useState<StatusFilter>('todos');
  const [clienteF, setClienteF] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('prazo');
  const [search, setSearch] = useState('');
  const [clienteOpen, setClienteOpen] = useState(false);

  const apiMode = !lotesQ.isError && !!lotesQ.data;
  const rows: LoteVM[] = useMemo(() => {
    if (apiMode && lotesQ.data) return lotesQ.data.map((l) => vmFromApi(l as LoteApi));
    return LOTES_FALLBACK;
  }, [apiMode, lotesQ.data]);

  // Lote em foco (em validação) → contagem real da fila para o chip/KPI
  const foco = rows.find((r) => r.bucket === 'em_validacao');
  const filaFocusQ = trpc.validacao.fila.useQuery(
    { loteId: foco?.id ?? 0 },
    { enabled: apiMode && foco != null, retry: 1, staleTime: 10_000 },
  );
  const filaFocus =
    apiMode && filaFocusQ.data && !filaFocusQ.isError ? filaFocusQ.data.length : (foco?.fila ?? 5);

  const clientes = useMemo(() => [...new Set(rows.map((r) => r.clienteNome))], [rows]);
  const emTrabalho = rows.filter((r) => ATIVOS.includes(r.bucket)).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = rows.filter(
      (r) =>
        matchStatus(r, statusF) &&
        (clienteF == null || r.clienteNome === clienteF) &&
        (!q ||
          `#${r.numero}`.includes(q) ||
          r.descricao.toLowerCase().includes(q) ||
          r.clienteNome.toLowerCase().includes(q)),
    );
    return sortRows(base, sortKey);
  }, [rows, statusF, clienteF, search, sortKey]);

  const chips: { key: StatusFilter; label: string; badge?: number }[] = [
    { key: 'todos', label: `Todos (${rows.length})` },
    { key: 'recebido', label: 'Recebido' },
    { key: 'processando', label: 'Processando' },
    { key: 'em_validacao', label: 'Aguardando validação', badge: filaFocus },
    { key: 'entregue', label: 'Entregue · aguardando aprovação' },
    { key: 'aprovado', label: 'Aprovado' },
  ];

  const sortLabel = sortKey === 'prazo' ? 'Prazo ↑' : sortKey === 'recebido' ? 'Recebido ↓' : 'Progresso ↓';
  const nextSort: SortKey = sortKey === 'prazo' ? 'recebido' : sortKey === 'recebido' ? 'progresso' : 'prazo';

  const kpis = [
    { label: 'Lotes em trabalho', value: <CountUp value={emTrabalho} />, delta: '1 entrega hoje até 18h', tone: 'muted' as const },
    { label: 'Docs processados hoje', value: <CountUp value={214} />, delta: '▲ 18% vs ontem', tone: 'green' as const },
    {
      label: 'Fila de validação (total)',
      value: <CountUp value={9} />,
      delta: `${filaFocus} do lote #${foco?.numero ?? 482} · meta ≤ 15s/doc`,
      tone: 'orange' as const,
    },
    { label: 'SLA em dia', value: <CountUp value={100} format={(n) => `${Math.round(n)}%`} />, delta: '0 lotes atrasados na semana', tone: 'green' as const },
  ];

  const openLote = () => navigate('/');

  return (
    <div className="flex min-w-0 flex-col gap-[18px] px-[30px] pb-[60px] pt-6">
      <OpsTopbar
        placeholder="Buscar lote, cliente, arquivo…"
        search={search}
        onSearch={setSearch}
      />

      {/* TÍTULO */}
      <Rise delay={0.05} y={12} className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[26px] font-black tracking-[-0.02em]">Lotes</h1>
          <p className="mt-[2px] text-[13.5px] font-extrabold text-aj-muted">
            pipeline de trabalho · semana 33 · 16/08/2026
          </p>
        </div>
        <div className="ml-auto">
          <Pill tone="gray">{clientes.length} clientes ativos</Pill>
        </div>
      </Rise>

      {/* KPIs DO DIA */}
      <div className="grid grid-cols-2 gap-[14px] min-[1151px]:grid-cols-4">
        {lotesQ.isLoading
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[108px] rounded-2xl" />)
          : kpis.map((k, i) => (
              <Rise
                key={k.label}
                delay={0.12 + i * 0.07}
                y={14}
                className="flex flex-col gap-1 rounded-2xl border border-aj-border bg-white px-5 py-4"
              >
                <div className="text-[11.5px] font-extrabold uppercase tracking-[.08em] text-aj-faint">
                  {k.label}
                </div>
                <div
                  className={cn(
                    'text-[28px] font-black leading-[1.1] tracking-[-0.02em] [font-variant-numeric:tabular-nums]',
                    k.tone === 'orange' && 'text-aj-orange',
                  )}
                >
                  {k.value}
                </div>
                <div
                  className={cn(
                    'text-[12px] font-extrabold',
                    k.tone === 'green' ? 'text-aj-teal-dark' : k.tone === 'orange' ? 'text-aj-orange' : 'text-aj-faint',
                  )}
                >
                  {k.delta}
                </div>
              </Rise>
            ))}
      </div>

      {/* FILTROS */}
      <Rise delay={0.3} y={10} className="flex flex-wrap items-center gap-[8px] overflow-x-auto pb-[2px]">
        {chips.map((c) => {
          const active = statusF === c.key;
          return (
            <motion.button
              key={c.key}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setStatusF(c.key)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-[16px] py-[8px] text-[12.5px] font-black transition-colors',
                active
                  ? 'border-[rgba(47,199,158,.4)] bg-aj-teal-soft text-aj-teal-dark'
                  : 'border-aj-border bg-white text-aj-muted hover:border-aj-ink',
              )}
            >
              {c.label}
              {typeof c.badge === 'number' && (
                <span className="rounded-full bg-aj-orange px-[7px] py-[1px] text-[10.5px] font-black text-white [font-variant-numeric:tabular-nums]">
                  {c.badge}
                </span>
              )}
            </motion.button>
          );
        })}

        <span className="mx-[4px] hidden h-[24px] w-px bg-aj-border min-[1151px]:block" />

        {/* dropdown de cliente */}
        <div className="relative">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => setClienteOpen((v) => !v)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-[16px] py-[8px] text-[12.5px] font-black transition-colors',
              clienteF
                ? 'border-[rgba(47,199,158,.4)] bg-aj-teal-soft text-aj-teal-dark'
                : 'border-aj-border bg-white text-aj-muted hover:border-aj-ink',
            )}
          >
            {clienteF ?? 'Todos os clientes'}
            <motion.span animate={{ rotate: clienteOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              ▾
            </motion.span>
          </motion.button>
          <AnimatePresence>
            {clienteOpen && (
              <>
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={() => setClienteOpen(false)}
                  className="fixed inset-0 z-10 cursor-default bg-transparent"
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[220px] overflow-hidden rounded-[14px] border border-aj-border bg-white p-[6px] [box-shadow:0_10px_32px_rgba(46,39,33,.12)]"
                >
                  {[null, ...clientes].map((c) => (
                    <button
                      key={c ?? 'todos'}
                      type="button"
                      onClick={() => {
                        setClienteF(c);
                        setClienteOpen(false);
                      }}
                      className={cn(
                        'flex w-full cursor-pointer items-center rounded-[10px] px-[12px] py-[9px] text-left text-[13px] font-extrabold transition-colors hover:bg-aj-cream',
                        clienteF === c ? 'text-aj-orange' : 'text-aj-ink',
                      )}
                    >
                      {c ?? 'Todos os clientes'}
                      {clienteF === c && <span className="ml-auto text-aj-orange">✓</span>}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setSortKey(nextSort)}
          className="ml-auto cursor-pointer whitespace-nowrap rounded-full border border-aj-border bg-white px-[16px] py-[8px] text-[12.5px] font-black text-aj-muted transition-colors hover:border-aj-ink"
        >
          {sortLabel}
        </motion.button>
      </Rise>

      {/* TABELA (desktop) */}
      <Rise delay={0.34} y={14} className="hidden rounded-[18px] border border-aj-border bg-white px-[8px] py-[8px] min-[1151px]:block">
        {lotesQ.isLoading ? (
          <div className="flex flex-col gap-[10px] p-[14px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[44px]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="text-[14px] font-extrabold text-aj-muted">Nenhum lote com esse filtro.</p>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setStatusF('todos');
                setClienteF(null);
                setSearch('');
              }}
              className="cursor-pointer rounded-full border-[1.5px] border-aj-border bg-white px-[20px] py-[10px] text-[12.5px] font-black text-aj-ink transition-colors hover:border-aj-ink"
            >
              Limpar filtros
            </motion.button>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[11px] font-black uppercase tracking-[.1em] text-aj-faint">
                <th className="px-[14px] py-[10px]">Lote</th>
                <th className="px-[10px] py-[10px]">Cliente</th>
                <th className="px-[10px] py-[10px]">Canal / Recebido</th>
                <th className="px-[10px] py-[10px]">Prazo</th>
                <th className="px-[10px] py-[10px]">Progresso</th>
                <th className="px-[10px] py-[10px]">Validação</th>
                <th className="px-[10px] py-[10px]">Status</th>
                <th className="px-[10px] py-[10px]">Responsável</th>
                <th className="w-[30px] px-[8px] py-[10px]" />
              </tr>
            </thead>
            <motion.tbody layout>
              <AnimatePresence initial={false}>
                {filtered.map((r, i) => {
                  const isFoco = r.bucket === 'em_validacao';
                  return (
                    <motion.tr
                      key={r.numero}
                      layout="position"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{
                        duration: 0.3,
                        delay: i * 0.04,
                        layout: { duration: 0.25, ease: 'easeOut' },
                      }}
                      onClick={openLote}
                      className="group cursor-pointer border-t border-aj-feedline transition-colors hover:bg-aj-actbg"
                    >
                      <td
                        className={cn(
                          'rounded-l-[10px] px-[14px] py-[12px]',
                          isFoco && '[box-shadow:inset_3px_0_0_#F5820D]',
                        )}
                      >
                        <div className="text-[14px] font-black">#{r.numero}</div>
                        <div className="max-w-[190px] truncate text-[11.5px] font-bold text-aj-faint">
                          {r.descricao}
                        </div>
                      </td>
                      <td className="px-[10px] py-[12px] text-[13px] font-extrabold">{r.clienteNome}</td>
                      <td className="px-[10px] py-[12px] text-[12.5px] font-bold text-aj-muted">
                        {r.canalIcon} {r.canalLabel} · {r.recebidoTxt}
                      </td>
                      <td className="px-[10px] py-[12px]">
                        <span
                          className={cn(
                            'text-[12.5px] font-extrabold [font-variant-numeric:tabular-nums]',
                            r.prazoHint ? 'text-aj-orange' : 'text-aj-muted',
                          )}
                        >
                          {r.prazoTxt}
                        </span>
                        {r.prazoHint && (
                          <span className="ml-[6px] rounded-full bg-aj-actbg px-[8px] py-[2px] text-[10.5px] font-black text-aj-orange [font-variant-numeric:tabular-nums]">
                            {r.prazoHint}
                          </span>
                        )}
                      </td>
                      <td className="px-[10px] py-[12px]">
                        <ProgressBar pct={r.progresso} />
                      </td>
                      <td className="px-[10px] py-[12px]">
                        <FilaPill loteId={apiMode && isFoco ? r.id : undefined} fallbackCount={r.fila} />
                      </td>
                      <td className="px-[10px] py-[12px]">
                        <StatusPill bucket={r.bucket} />
                      </td>
                      <td className="px-[10px] py-[12px]">
                        {r.responsavel ? (
                          <span className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-aj-orange text-[10.5px] font-black text-white">
                            {r.responsavel}
                          </span>
                        ) : (
                          <span className="text-[12.5px] font-extrabold text-aj-faint">—</span>
                        )}
                      </td>
                      <td className="rounded-r-[10px] px-[8px] py-[12px] text-[18px] font-black text-aj-faint transition-colors group-hover:text-aj-orange">
                        ›
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </motion.tbody>
          </table>
        )}
      </Rise>

      {/* CARDS EMPILHADOS (≤1150px) */}
      <div className="flex flex-col gap-[12px] min-[1151px]:hidden">
        {lotesQ.isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-[110px] rounded-[16px]" />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[16px] border border-aj-border bg-white px-6 py-10 text-center">
            <p className="text-[14px] font-extrabold text-aj-muted">Nenhum lote com esse filtro.</p>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setStatusF('todos');
                setClienteF(null);
                setSearch('');
              }}
              className="cursor-pointer rounded-full border-[1.5px] border-aj-border bg-white px-[20px] py-[10px] text-[12.5px] font-black text-aj-ink transition-colors hover:border-aj-ink"
            >
              Limpar filtros
            </motion.button>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((r, i) => (
              <motion.button
                key={r.numero}
                type="button"
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                onClick={openLote}
                className={cn(
                  'cursor-pointer rounded-[16px] border border-aj-border bg-white px-[16px] py-[14px] text-left transition-colors hover:bg-aj-actbg',
                  r.bucket === 'em_validacao' && '[box-shadow:inset_3px_0_0_#F5820D]',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[14.5px] font-black">#{r.numero}</span>
                    <span className="ml-2 truncate text-[12px] font-bold text-aj-faint">{r.clienteNome}</span>
                  </div>
                  <StatusPill bucket={r.bucket} />
                </div>
                <div className="mt-[10px] flex flex-wrap items-center gap-x-4 gap-y-2">
                  <ProgressBar pct={r.progresso} />
                  <span
                    className={cn(
                      'text-[12px] font-extrabold [font-variant-numeric:tabular-nums]',
                      r.prazoHint ? 'text-aj-orange' : 'text-aj-muted',
                    )}
                  >
                    {r.prazoTxt}
                    {r.prazoHint ? ` (${r.prazoHint})` : ''}
                  </span>
                  <FilaPill
                    loteId={apiMode && r.bucket === 'em_validacao' ? r.id : undefined}
                    fallbackCount={r.fila}
                  />
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* FAIXA DE CAPACIDADE */}
      <Rise
        delay={0.35}
        y={14}
        className="flex flex-wrap items-center gap-3 rounded-[16px] border border-[rgba(47,199,158,.4)] bg-aj-teal-soft px-[20px] py-[16px]"
      >
        <p className="text-[13.5px] font-extrabold text-aj-teal-dark">
          ⚡ Capacidade da semana: <b>214/600</b> docs processados · fila média <b>11s/doc</b> ·
          próxima janela de entrega: <b>hoje 18h</b>
        </p>
        <button
          type="button"
          disabled
          title="Em breve"
          className="ml-auto cursor-default rounded-full bg-aj-teal px-[20px] py-[10px] text-[12.5px] font-black text-white opacity-60"
        >
          Ver financeiro
        </button>
      </Rise>
    </div>
  );
}
