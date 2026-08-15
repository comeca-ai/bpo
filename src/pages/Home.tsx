import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MascotAvatar from '@/components/MascotAvatar';
import type { MascotId } from '@/components/MascotAvatar';
import { trpc } from '@/providers/trpc';
import { LOTE_DEMO_NUMERO } from '@/lib/ops-store';
import { cn } from '@/lib/utils';

/* ---------- tipos e helpers de texto rico ---------- */

type Seg = { t: string; b?: boolean; hl?: 'o' | 't' };
const s = (t: string): Seg => ({ t });
const bd = (t: string): Seg => ({ t, b: true });
const ho = (t: string): Seg => ({ t, hl: 'o' });
const ht = (t: string): Seg => ({ t, hl: 't' });
const plain = (segs: Seg[]) => segs.map((g) => g.t).join('');

/** texto do audit trail do backend: `<b>…</b>` → negrito */
function parseRich(texto: string): Seg[] {
  const segs: Seg[] = [];
  const re = /<b>([\s\S]*?)<\/b>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (m.index > last) segs.push(s(texto.slice(last, m.index)));
    segs.push(bd(m[1]));
    last = m.index + m[0].length;
  }
  if (last < texto.length) segs.push(s(texto.slice(last)));
  return segs.length > 0 ? segs : [s(texto)];
}

/** linha do "scan": `<hl>…</hl>` highlight laranja, `<hlt>…</hlt>` highlight teal */
function parsePageLine(line: string): Seg[] {
  const segs: Seg[] = [];
  const re = /<hl>([\s\S]*?)<\/hl>|<hlt>([\s\S]*?)<\/hlt>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) segs.push(s(line.slice(last, m.index)));
    if (m[1] !== undefined) segs.push(ho(m[1]));
    else segs.push(ht(m[2]));
    last = m.index + m[0].length;
  }
  if (last < line.length) segs.push(s(line.slice(last)));
  return segs.length > 0 ? segs : [s(line)];
}

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/* ---------- helpers de data/texto do pedido ---------- */

const p2 = (n: number) => String(n).padStart(2, '0');
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

function asDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** "seg 18/08, 08h14" */
function fmtDiaHora(d: Date) {
  return `${DIAS[d.getDay()]} ${p2(d.getDate())}/${p2(d.getMonth() + 1)}, ${p2(d.getHours())}h${p2(d.getMinutes())}`;
}

/** "14h15" */
function fmtHora(d: Date) {
  return `${p2(d.getHours())}h${p2(d.getMinutes())}`;
}

const CANAL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  drive: 'Drive',
  upload: 'Upload',
};

function fmtPreco(n: number) {
  return `R$ ${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}/mês`;
}

/* ---------- fila de validação (shape do backend → UI) ---------- */

type FilaDoc = {
  id: number;
  nomeOriginal: string;
  nomeFinal: string | null;
  origem: string;
  confianca: number; // 0-100
  pageLines: string | null;
  metaRows: string | null;
  duvida: string | null;
};

type QueueItem = {
  documentoId: number;
  file: string;
  from: string;
  conf: number; // 0-1
  page: Seg[][];
  rows: [string, string][];
  doubt: string;
  rnOld: string;
  rnNew: string;
};

function toQueueItem(doc: FilaDoc): QueueItem {
  const pageRaw = safeJson<string[]>(doc.pageLines, []);
  const rows = safeJson<[string, string][]>(doc.metaRows, []);
  return {
    documentoId: doc.id,
    file: doc.nomeOriginal,
    from: doc.origem,
    conf: Math.min(Math.max(doc.confianca / 100, 0), 1),
    page: pageRaw.map(parsePageLine),
    rows,
    doubt: doc.duvida ?? '',
    rnOld: doc.nomeOriginal,
    rnNew: doc.nomeFinal ?? doc.nomeOriginal,
  };
}

/* ---------- time (cosmético — rotação de tarefas client-side) ---------- */

type TeamMember = {
  id: MascotId;
  name: string;
  role: string;
  tag: 'agente' | 'humano';
  tasks: Seg[][];
};

const TEAM: TeamMember[] = [
  {
    id: 'bia',
    name: 'Bia',
    role: 'Triagem',
    tag: 'agente',
    tasks: [
      [s('monitorando a pasta do Drive')],
      [s('separando '), bd('duplicados'), s(' do lote')],
      [s('aguardando novos arquivos')],
    ],
  },
  {
    id: 'tom',
    name: 'Tom',
    role: 'Nomeação',
    tag: 'agente',
    tasks: [
      [s('renomeando '), bd('recibos'), s(' do Seu Zé')],
      [s('aplicando padrão '), bd('v7'), s(' do cliente')],
      [s('montando pastas '), bd('por unidade')],
    ],
  },
  {
    id: 'lia',
    name: 'Lia',
    role: 'Busca e índice',
    tag: 'agente',
    tasks: [
      [s('ligando notas ao '), bd('apto 302')],
      [s('gerando '), bd('resumo de custo')],
      [s('indexando contratos aprovados')],
    ],
  },
  {
    id: 'pedro',
    name: 'Pedro',
    role: 'Conferente',
    tag: 'humano',
    tasks: [
      [s('conferindo '), bd('dúvidas'), s(' da Bia')],
      [s('falando com o mestre de obras')],
      [s('aprovando leva de contratos')],
    ],
  },
];

type FeedWho = MascotId | 'sys' | 'me';
type FeedItem = { id: number; who: FeedWho; segs: Seg[]; alert?: boolean; time: string };

/* ---------- micro-componentes ---------- */

function Txt({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((g, i) =>
        g.b ? (
          <b key={i} className="text-aj-ink">
            {g.t}
          </b>
        ) : (
          <span key={i}>{g.t}</span>
        ),
      )}
    </>
  );
}

function PageLine({ segs }: { segs: Seg[] }) {
  return (
    <div>
      {segs.map((g, i) =>
        g.hl ? (
          <span
            key={i}
            className={cn(
              'rounded-[3px] px-[3px] font-black',
              g.hl === 'o' ? 'bg-[rgba(245,130,13,.18)]' : 'bg-[rgba(47,199,158,.2)]',
            )}
          >
            {g.t}
          </span>
        ) : (
          <span key={i}>{g.t}</span>
        ),
      )}
    </div>
  );
}

function LiveDot() {
  return <span className="h-[9px] w-[9px] shrink-0 animate-pulse-ring rounded-full bg-aj-teal" />;
}

function Pill({ tone, children }: { tone: 'green' | 'orange' | 'gray' | 'red'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[7px] whitespace-nowrap rounded-full px-[15px] py-[9px] text-[12.5px] font-black',
        tone === 'green' && 'border border-[rgba(47,199,158,.4)] bg-aj-teal-soft text-aj-teal-dark',
        tone === 'orange' && 'bg-aj-actbg text-aj-orange',
        tone === 'gray' && 'border border-aj-border bg-white text-aj-muted',
        tone === 'red' && 'bg-aj-danger-soft text-aj-danger',
      )}
    >
      {children}
    </span>
  );
}

function Rise({
  delay = 0,
  y = 16,
  className,
  children,
}: {
  delay?: number;
  y?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-aj-rail/50', className)} />;
}

function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const v = from + (target - from) * (1 - Math.pow(1 - p, 3));
      fromRef.current = v;
      setVal(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function CountUp({
  value,
  format = (n: number) => String(Math.round(n)),
}: {
  value: number;
  format?: (n: number) => string;
}) {
  return <>{format(useCountUp(value))}</>;
}

function confColor(conf: number) {
  return conf >= 0.9 ? '#2FC79E' : conf >= 0.7 ? '#F5820D' : '#D9534F';
}

function FeedAvatar({ who }: { who: FeedWho }) {
  if (who === 'sys') {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aj-dark text-[11px] font-black text-aj-teal-light">
        ⚙
      </div>
    );
  }
  if (who === 'me') {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aj-orange text-[11px] font-black text-white">
        NJ
      </div>
    );
  }
  return <MascotAvatar id={who} size={28} radius={8} className="shrink-0" />;
}

/* ---------- página: Console Ops (backend tRPC real) ---------- */

export default function Home() {
  const utils = trpc.useUtils();

  /* ----- dados do servidor: lote demo #482 ----- */
  const loteQ = trpc.lotes.porNumero.useQuery(
    { numero: LOTE_DEMO_NUMERO },
    { refetchInterval: 3000, retry: 1 },
  );
  const lote = loteQ.data?.lote ?? null;
  const cliente = loteQ.data?.cliente ?? null;
  const loteId = lote?.id ?? 0;

  const metQ = trpc.metricas.ops.useQuery(
    { loteId },
    { enabled: loteId > 0, refetchInterval: 3000, retry: 1 },
  );
  const filaQ = trpc.validacao.fila.useQuery(
    { loteId },
    { enabled: loteId > 0, refetchInterval: 3000, retry: 1 },
  );
  const ctxQ = trpc.clientes.contexto.useQuery(
    { clienteId: cliente?.id ?? 0 },
    { enabled: !!cliente, refetchInterval: 10000, retry: 1 },
  );

  /* ----- feed ao vivo (incremental por sinceId, prepend) ----- */
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const sinceRef = useRef(0);
  const [sinceId, setSinceId] = useState(0);
  const localSeq = useRef(0);

  const evQ = trpc.eventos.porLote.useQuery(
    { loteId, sinceId },
    { enabled: loteId > 0, refetchInterval: 3000, retry: 1 },
  );

  useEffect(() => {
    const rows = evQ.data;
    if (!rows || rows.length === 0) return;
    const fresh = rows.filter((r) => r.id > sinceRef.current);
    if (fresh.length === 0) return;
    sinceRef.current = Math.max(...fresh.map((r) => r.id));
    setSinceId(sinceRef.current);
    const items: FeedItem[] = fresh.map((r) => ({
      id: r.id,
      who: r.ator,
      segs: parseRich(r.texto),
      alert: r.alerta,
      time: fmtHora(asDate(r.criadoEm) ?? new Date()),
    }));
    setFeed((prev) => [...items, ...prev].slice(0, 9));
  }, [evQ.data]);

  /** itens cosméticos locais (alerta de escopo / upsell) — ids negativos */
  const addLocalFeed = useCallback((who: FeedWho, segs: Seg[], alert = false) => {
    localSeq.current += 1;
    const item: FeedItem = { id: -localSeq.current, who, segs, alert, time: fmtHora(new Date()) };
    setFeed((prev) => [item, ...prev].slice(0, 9));
  }, []);

  /* ----- mutações ----- */
  const invalidateOps = useCallback(() => {
    void utils.lotes.porNumero.invalidate();
    void utils.metricas.ops.invalidate();
    void utils.validacao.fila.invalidate();
    void utils.eventos.porLote.invalidate();
  }, [utils]);

  const decidir = trpc.validacao.decidir.useMutation({ onSuccess: invalidateOps });
  const entregar = trpc.lotes.entregar.useMutation({ onSuccess: invalidateOps });
  const { mutate: simTickMutate } = trpc.sim.tick.useMutation();

  /* ----- motor de tiques: sim.tick (3,4s) enquanto em trabalho + time respirando ----- */
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);
  const simActive = lote?.status === 'em_validacao' || lote?.status === 'processando';
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
      if (simActive && loteId > 0) simTickMutate({ loteId });
    }, 3400);
    return () => clearInterval(id);
  }, [simActive, loteId, simTickMutate]);

  /* ----- alerta de fora-de-escopo (~7s) — cosmético ----- */
  const [scopeVisible, setScopeVisible] = useState(false);
  const [scopeSuggested, setScopeSuggested] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => {
      setScopeVisible(true);
      addLocalFeed(
        'sys',
        [bd('Escopo:'), s(' 4 holerites detectados — tipo não mapeado no plano (guardados em “_revisar”)')],
        true,
      );
    }, 7000);
    return () => clearTimeout(id);
  }, [addLocalFeed]);

  /* ----- fila de validação ----- */
  /* rascunho de correção é por documento — some sozinho quando a fila avança */
  const [edit, setEdit] = useState<{ docId: number; draft: string } | null>(null);
  const [decidedCount, setDecidedCount] = useState(0);
  const [search, setSearch] = useState('');

  const queueKnown = filaQ.data !== undefined;
  const fila: QueueItem[] = (filaQ.data ?? []).map(toQueueItem);
  const queueLeft = metQ.data?.fila ?? fila.length;
  const queueDone = queueKnown && fila.length === 0;
  const item = !queueDone && fila.length > 0 ? fila[0] : null;
  const currentDocId = item?.documentoId ?? 0;
  const editDraft = edit && edit.docId === currentDocId ? edit.draft : null;
  const setEditDraft = (v: string | null) => {
    if (v === null || !item) setEdit(null);
    else setEdit({ docId: item.documentoId, draft: v });
  };

  const resolveItem = (action: 'ok' | 'fix' | 'rej') => {
    if (!item || decidir.isPending) return;
    const nomeFinalCorrigido = action === 'fix' ? (editDraft ?? item.rnNew) : undefined;
    decidir.mutate(
      {
        documentoId: item.documentoId,
        decisao: action === 'ok' ? 'aprovado' : action === 'fix' ? 'corrigido' : 'segunda_foto',
        ...(nomeFinalCorrigido ? { nomeFinalCorrigido } : {}),
        organizadorNome: 'Nizan Jhon',
      },
      {
        onSuccess: () => {
          setDecidedCount((c) => c + 1);
          setEdit(null);
        },
      },
    );
  };

  /* ----- entrega ----- */
  const delivered = lote?.status === 'entregue' || lote?.status === 'aprovado';
  const deliver = () => {
    if (loteId > 0 && !entregar.isPending) entregar.mutate({ id: loteId });
  };

  /* ----- valores derivados (fallbacks da seed enquanto carrega) ----- */
  const docsDone = metQ.data?.docsAjeitados ?? lote?.docsAjeitados ?? 79;
  const totalDocs = metQ.data?.qtdArquivos ?? lote?.qtdArquivos ?? 86;
  const autoPct = metQ.data?.autoAprovacaoPct ?? 87;
  const custoDoc = metQ.data?.custoPorDoc ?? 0.04;
  const tempoPct = lote?.tempoUsadoPct ?? 34;

  const recebidoEm = asDate(lote?.recebidoEm);
  const prazoEm = asDate(lote?.prazoEm);
  const totalHoras =
    recebidoEm && prazoEm ? Math.max((prazoEm.getTime() - recebidoEm.getTime()) / 36e5, 1) : 48;
  const horasRestantes = Math.max(Math.floor((1 - tempoPct / 100) * totalHoras), 0);

  const escopoIn = safeJson<string[]>(lote?.escopoInclui, [
    'Docs de obra',
    'Caixa de documentos',
    '+ resumo de custo por apto',
  ]);
  const escopoOut = safeJson<string[]>(lote?.escopoFora, [
    'holerites/folha',
    'lançamento contábil',
    'assinatura/parecer',
  ]);

  const ctxVersao = ctxQ.data?.versao ?? 7;
  const ctxDocTypes = safeJson<string[]>(ctxQ.data?.docTypes, []).length || 7;

  const q = search.trim().toLowerCase();
  const visibleFeed = q ? feed.filter((it) => plain(it.segs).toLowerCase().includes(q)) : feed;

  const steps = [
    { lines: ['Recebido', '08h14'], state: 'done' as const },
    { lines: ['OCR', '34 escaneados'], state: 'done' as const },
    { lines: ['IA classificou', `${totalDocs}/${totalDocs}`], state: 'done' as const },
    {
      lines: ['Validação', queueDone ? 'zerada ✓' : `${queueLeft} pendentes`],
      state: (queueDone ? 'done' : 'now') as 'done' | 'now',
    },
    { lines: ['Entrega', 'Drive + índice'], state: (delivered ? 'done' : 'todo') as 'done' | 'todo' },
  ];

  /* ----- skeleton discreto no primeiro carregamento (erro → mantém estável) ----- */
  if (!loteQ.data) {
    return (
      <div className="flex min-w-0 flex-col gap-[18px] px-[30px] pb-[60px] pt-6">
        <Sk className="h-[62px] rounded-full" />
        <Sk className="h-[240px] rounded-[20px]" />
        <div className="grid grid-cols-2 gap-[14px] min-[1151px]:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Sk key={i} className="h-[106px] rounded-2xl" />
          ))}
        </div>
        <Sk className="h-[108px] rounded-[18px]" />
        <Sk className="h-[150px] rounded-[18px]" />
        <div className="grid grid-cols-1 items-start gap-4 min-[1151px]:grid-cols-[1fr_1.15fr]">
          <Sk className="h-[430px] rounded-[18px]" />
          <Sk className="h-[430px] rounded-[18px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-[18px] px-[30px] pb-[60px] pt-6">
      {/* TOPBAR */}
      <Rise delay={0} className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-[10px] rounded-full border border-aj-border bg-white px-[18px] py-[11px] text-[14px] font-bold text-aj-faint transition-shadow focus-within:[box-shadow:0_0_0_3px_rgba(245,130,13,.15)]">
          🔎
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar em qualquer cliente: “nota do gesso do apto 302”…"
            className="flex-1 bg-transparent font-[inherit] text-aj-ink outline-none placeholder:text-aj-faint"
          />
        </div>
        <Pill tone="green">
          <LiveDot />
          Pipeline ao vivo
        </Pill>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aj-orange text-[15px] font-black text-white">
          NJ
        </div>
      </Rise>

      {/* PEDIDO: SOLICITADO / PRAZO / ESCOPO */}
      <Rise delay={0.06} className="overflow-hidden rounded-[20px] border border-aj-border bg-white">
        <div className="flex flex-wrap items-center gap-[14px] border-b border-aj-border px-6 py-[18px]">
          <div>
            <div className="text-[20px] font-black tracking-[-0.01em]">
              Lote #{lote?.numero ?? LOTE_DEMO_NUMERO} — {cliente?.nome ?? 'Construtora Sol Nascente'}
            </div>
            <div className="text-[14px] font-extrabold text-aj-muted">
              {cliente?.cidade ?? 'João Pessoa · PB'} · plano {cliente?.planoAgentes ?? 3} agentes +{' '}
              {cliente?.planoSkills ?? 2} skills · {fmtPreco(cliente?.precoMensal ?? 1450)}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {delivered ? (
              <Pill tone="green">✓ Entregue — aguardando aprovação do cliente</Pill>
            ) : (
              <Pill tone="green">
                <LiveDot />
                Em trabalho
              </Pill>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 min-[1151px]:grid-cols-[1.15fr_1fr_1.15fr]">
          <div className="border-b border-aj-rail px-6 py-[18px] last:border-b-0 min-[1151px]:border-b-0 min-[1151px]:border-r min-[1151px]:last:border-r-0">
            <div className="mb-2 flex items-center gap-[7px] text-[11px] font-black uppercase tracking-[.1em] text-aj-faint">
              📥 Solicitado
            </div>
            <div className="rounded-[0_10px_10px_0] border-l-[3px] border-aj-orange bg-aj-cream px-[13px] py-[10px] text-[13.5px] font-bold leading-[1.5] text-aj-muted">
              {lote?.solicitadoTexto ??
                '“Organiza as notas e os contratos da obra Litoral Plaza e monta o resumo de custo por apartamento.”'}
              <small className="mt-[6px] block text-[11.5px] font-extrabold text-aj-faint">
                recebido pelo {CANAL[lote?.canal ?? 'whatsapp'] ?? 'WhatsApp'} ·{' '}
                {recebidoEm ? fmtDiaHora(recebidoEm) : 'sáb 16/08, 08h14'} · {totalDocs} arquivos
              </small>
            </div>
            <div className="mt-[10px] text-[12.5px] font-bold text-aj-faint">
              Contexto do cliente: <b className="text-aj-ink">v{ctxVersao}</b> · {ctxDocTypes} tipos de
              doc mapeados
            </div>
          </div>

          <div className="border-b border-aj-rail px-6 py-[18px] last:border-b-0 min-[1151px]:border-b-0 min-[1151px]:border-r min-[1151px]:last:border-r-0">
            <div className="mb-2 flex items-center gap-[7px] text-[11px] font-black uppercase tracking-[.1em] text-aj-faint">
              ⏱ Prazo
            </div>
            <div className="text-[14.5px] font-extrabold leading-[1.5]">
              Entrega:{' '}
              <span className="text-aj-orange">
                {prazoEm ? fmtDiaHora(prazoEm) : 'seg 18/08, 08h14'}
              </span>
            </div>
            <div className="mb-[6px] mt-2 h-[10px] overflow-hidden rounded-full bg-aj-rail">
              <motion.i
                className="block h-full rounded-full bg-[linear-gradient(90deg,#2FC79E,#F5820D)]"
                initial={{ width: '0%' }}
                animate={{ width: `${tempoPct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-[12px] font-extrabold text-aj-faint">
              <span>{tempoPct}% do tempo usado</span>
              <span>{horasRestantes}h restantes</span>
            </div>
            <div className="mt-2 text-[12.5px] font-black text-aj-teal-dark">
              {delivered ? 'Entregue com 19h de antecedência ✓' : '63% do trabalho feito → adiantado ✓'}
            </div>
          </div>

          <div className="border-b border-aj-rail px-6 py-[18px] last:border-b-0 min-[1151px]:border-b-0">
            <div className="mb-2 flex items-center gap-[7px] text-[11px] font-black uppercase tracking-[.1em] text-aj-faint">
              🎯 Escopo contratado
            </div>
            <div className="mb-2">
              {escopoIn.map((chip) =>
                chip.startsWith('+') ? (
                  <span
                    key={chip}
                    className="mb-[5px] mr-[5px] inline-flex rounded-full border border-aj-border bg-aj-cream px-[11px] py-1 text-[12px] font-extrabold text-aj-muted"
                  >
                    {chip}
                  </span>
                ) : (
                  <span
                    key={chip}
                    className="mb-[5px] mr-[5px] inline-flex rounded-full border border-[rgba(47,199,158,.4)] bg-aj-teal-soft px-[11px] py-1 text-[12px] font-extrabold text-aj-teal-dark"
                  >
                    {chip}
                  </span>
                ),
              )}
            </div>
            <div>
              {escopoOut.map((chip) => (
                <span
                  key={chip}
                  className="mb-[5px] mr-[5px] inline-flex rounded-full border border-dashed border-aj-border bg-aj-chipout px-[11px] py-1 text-[12px] font-extrabold text-aj-faint"
                >
                  fora: {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {scopeVisible && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="mx-6 mb-[18px] flex items-center gap-3 rounded-[14px] border border-[rgba(245,130,13,.4)] bg-aj-actbg px-4 py-3 text-[13px] font-extrabold text-aj-ink"
            >
              ⚠{' '}
              <span>
                <b>4 holerites</b> detectados no lote — fora do escopo (skill “Docs de pessoas”, +R$
                160/mês).
              </span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                disabled={scopeSuggested}
                onClick={() => {
                  setScopeSuggested(true);
                  addLocalFeed('me', [
                    bd('Você'),
                    s(' sugeriu o add-on '),
                    bd('Docs de pessoas (+R$160/mês)'),
                    s(' pro cliente no WhatsApp'),
                  ]);
                }}
                className="ml-auto cursor-pointer whitespace-nowrap rounded-full border-none bg-aj-orange px-4 py-[9px] font-[inherit] text-[12.5px] font-black text-white transition-colors hover:bg-aj-orange-hover disabled:cursor-default disabled:opacity-80"
              >
                {scopeSuggested ? 'Sugerido no WhatsApp ✓' : 'Sugerir add-on no WhatsApp'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </Rise>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-[14px] min-[1151px]:grid-cols-4">
        {[
          {
            label: 'Docs ajeitados',
            value: (
              <>
                <CountUp value={docsDone} />
                <span className="text-[16px] text-aj-faint">/{totalDocs}</span>
              </>
            ),
            delta: delivered
              ? `${totalDocs}/${totalDocs} entregues · pasta + índice no Drive`
              : 'pipeline IA concluído · faltam validações',
            up: true,
          },
          {
            label: 'Fila de validação',
            value: <CountUp value={queueLeft} />,
            delta: 'só entra confiança < 0,90 ou amostra',
            up: false,
          },
          {
            label: 'Auto-aprovação',
            value: <CountUp value={autoPct} format={(n) => `${Math.round(n)}%`} />,
            delta: 'threshold 0,90 · concordância 97,2%',
            up: true,
          },
          {
            label: 'Custo por doc',
            value: <CountUp value={custoDoc} format={(n) => `R$ ${n.toFixed(2).replace('.', ',')}`} />,
            delta: 'OCR R$ 1,36 + tokens R$ 2,10',
            up: true,
          },
        ].map((k, i) => (
          <Rise
            key={k.label}
            delay={0.12 + i * 0.07}
            y={14}
            className="flex flex-col gap-1 rounded-2xl border border-aj-border bg-white px-5 py-4"
          >
            <div className="text-[11.5px] font-extrabold uppercase tracking-[.08em] text-aj-faint">
              {k.label}
            </div>
            <div className="text-[28px] font-black leading-[1.1] tracking-[-0.02em] [font-variant-numeric:tabular-nums]">
              {k.value}
            </div>
            <div className={cn('text-[12px] font-extrabold', k.up ? 'text-aj-teal-dark' : 'text-aj-faint')}>
              {k.delta}
            </div>
          </Rise>
        ))}
      </div>

      {/* STEPPER */}
      <Rise delay={0.3} className="rounded-[18px] border border-aj-border bg-white px-[22px] py-5">
        <div className="flex items-center">
          {steps.map((st, i) => (
            <div key={st.lines[0]} className="relative flex flex-1 flex-col items-center gap-2">
              {i > 0 && (
                <span
                  className={cn(
                    'absolute left-[-50%] top-[19px] h-[3px] w-full transition-colors duration-300',
                    st.state === 'done' && 'bg-aj-teal',
                    st.state === 'now' && 'bg-[linear-gradient(90deg,#2FC79E,#F5820D)]',
                    st.state === 'todo' && 'bg-aj-border',
                  )}
                />
              )}
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.36 + i * 0.12, duration: 0.3 }}
                className={cn(
                  'z-[1] flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 text-[14px] font-black transition-all duration-300',
                  st.state === 'done' && 'border-aj-teal bg-aj-teal text-white',
                  st.state === 'now' &&
                    'border-aj-orange bg-aj-orange text-white [box-shadow:0_0_0_6px_rgba(245,130,13,.15)]',
                  st.state === 'todo' && 'border-aj-border bg-aj-cream text-aj-faint',
                )}
              >
                <motion.span
                  key={st.state}
                  initial={st.state !== 'todo' ? { scale: 1.15 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  {st.state === 'done' ? '✓' : i + 1}
                </motion.span>
              </motion.div>
              <div
                className={cn(
                  'text-center text-[12px] font-extrabold leading-[1.3]',
                  st.state === 'done' && 'text-aj-teal-dark',
                  st.state === 'now' && 'text-aj-orange',
                  st.state === 'todo' && 'text-aj-faint',
                )}
              >
                {st.lines[0]}
                <br />
                {st.lines[1]}
              </div>
            </div>
          ))}
        </div>
      </Rise>

      {/* TIME */}
      <Rise delay={0.36} className="rounded-[18px] border border-aj-border bg-white px-[22px] py-5">
        <div className="mb-3 flex items-center gap-[9px] text-[15.5px] font-black">
          Time alocado no lote
          <span className="rounded-full border border-aj-border bg-aj-cream px-[10px] py-[3px] text-[11px] font-black text-aj-muted">
            3 agentes + 1 humano
          </span>
        </div>
        <div className="grid grid-cols-2 gap-[14px] min-[1151px]:grid-cols-4">
          {TEAM.map((m, i) => {
            const working = (tick + i) % 4 < 2;
            const taskIdx = tick === 0 ? 0 : Math.floor((tick + i) / 2) % m.tasks.length;
            return (
              <div
                key={m.id}
                className={cn(
                  'flex flex-col gap-[9px] rounded-2xl border border-aj-border bg-white px-4 py-[15px] transition-[border-color,box-shadow] duration-300',
                  working && 'border-aj-orange [box-shadow:0_0_0_4px_rgba(245,130,13,.07)]',
                )}
              >
                <div className="flex items-center gap-[10px]">
                  <div className="relative shrink-0">
                    <MascotAvatar id={m.id} size={38} radius={12} />
                    <span
                      className={cn(
                        'absolute bottom-[-3px] right-[-3px] h-3 w-3 rounded-full border-[2.5px] border-white bg-aj-border',
                        working && 'animate-pulse-ring bg-aj-teal',
                      )}
                    />
                  </div>
                  <div>
                    <div className="text-[14px] font-black">{m.name}</div>
                    <div className="text-[11px] font-extrabold text-aj-faint">{m.role}</div>
                  </div>
                  <span
                    className={cn(
                      'ml-auto rounded-full px-[7px] py-[2px] text-[9.5px] font-black uppercase tracking-[.08em]',
                      m.tag === 'humano' ? 'bg-aj-teal-soft text-aj-teal-dark' : 'bg-aj-actbg text-aj-orange',
                    )}
                  >
                    {m.tag}
                  </span>
                </div>
                <motion.div
                  key={taskIdx}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="min-h-[34px] text-[12.5px] font-bold leading-[1.4] text-aj-muted"
                >
                  <Txt segs={m.tasks[taskIdx]} />
                </motion.div>
              </div>
            );
          })}
        </div>
      </Rise>

      {/* LOG AO VIVO + FILA DE VALIDAÇÃO */}
      <Rise delay={0.42} className="grid grid-cols-1 items-start gap-4 min-[1151px]:grid-cols-[1fr_1.15fr]">
        {/* log */}
        <div className="rounded-[18px] border border-aj-border bg-white px-[22px] py-5">
          <div className="mb-3 flex items-center gap-[9px] text-[15.5px] font-black">
            Log ao vivo
            <span className="rounded-full border border-aj-border bg-aj-cream px-[10px] py-[3px] text-[11px] font-black text-aj-muted">
              audit trail — tudo registrado
            </span>
          </div>
          <div className="flex max-h-[430px] flex-col overflow-hidden">
            <AnimatePresence initial={false}>
              {visibleFeed.map((it) => (
                <motion.div
                  key={it.id}
                  layout="position"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className={cn(
                    'flex gap-[11px]',
                    it.alert
                      ? 'my-[5px] rounded-xl bg-aj-actbg px-3 py-[10px]'
                      : 'border-b border-aj-feedline px-[2px] py-[10px]',
                  )}
                >
                  <FeedAvatar who={it.who} />
                  <div>
                    <div className="text-[13px] font-bold leading-[1.45] text-aj-muted">
                      <Txt segs={it.segs} />
                    </div>
                    <div className="mt-[2px] text-[11px] font-extrabold text-aj-faint [font-variant-numeric:tabular-nums]">
                      {it.time} · registrado no audit trail
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {visibleFeed.length === 0 && !q && (
              <div className="flex flex-col gap-[10px] py-1">
                <Sk className="h-[52px] rounded-xl" />
                <Sk className="h-[52px] rounded-xl" />
                <Sk className="h-[52px] rounded-xl" />
              </div>
            )}
            {visibleFeed.length === 0 && q && (
              <div className="py-6 text-center text-[12.5px] font-bold text-aj-faint">
                Nada no log com “{search}”.
              </div>
            )}
          </div>
        </div>

        {/* fila de validação */}
        <div className="flex flex-col gap-[14px] rounded-[18px] border border-aj-border bg-white px-[22px] py-5">
          <div className="flex items-center gap-[10px]">
            <div className="text-[15.5px] font-black">Fila de validação</div>
            {!queueDone && item && (
              <Pill tone="orange">{`item ${decidedCount + 1} de ${decidedCount + fila.length}`}</Pill>
            )}
            <span className="ml-auto text-[12px] font-extrabold text-aj-faint">meta ≤ 15s/doc</span>
          </div>

          {!queueKnown && (
            <div className="flex flex-col gap-[14px]">
              <Sk className="h-[196px] rounded-[14px]" />
              <Sk className="h-[74px] rounded-[11px]" />
              <Sk className="h-[46px] rounded-full" />
            </div>
          )}

          <AnimatePresence mode="wait">
            {queueKnown && !queueDone && item && (
              <motion.div
                key={item.documentoId}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-[14px]"
              >
                {/* documento "scan" */}
                <div className="flex flex-col gap-2 rounded-[14px] bg-aj-dark px-[18px] py-4">
                  <div className="flex justify-between gap-3 text-[12px] font-extrabold text-aj-sand">
                    <span className="min-w-0 truncate">📄 {item.file}</span>
                    <span className="shrink-0 text-aj-orange">{item.from}</span>
                  </div>
                  <div className="flex flex-col gap-[6px] rounded-[9px] bg-aj-page px-4 py-[14px] text-[12.5px] font-bold text-[#4a4238]">
                    {item.page.map((line, li) => (
                      <PageLine key={li} segs={line} />
                    ))}
                  </div>
                </div>

                {/* linhas da IA */}
                <div className="flex flex-col gap-[7px]">
                  {item.rows.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 text-[13.5px] font-bold">
                      <span className="text-[11.5px] font-extrabold uppercase tracking-[.06em] text-aj-faint">
                        {k}
                      </span>
                      <span className="text-right font-black">{v}</span>
                    </div>
                  ))}
                </div>

                {/* confiança */}
                <div className="flex items-center gap-[10px]">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-aj-rail">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(item.conf * 100)}%` }}
                      transition={{ duration: 0.5 }}
                      style={{ backgroundColor: confColor(item.conf) }}
                    />
                  </div>
                  <span
                    className="text-[12.5px] font-black [font-variant-numeric:tabular-nums]"
                    style={{ color: confColor(item.conf) }}
                  >
                    {item.conf.toFixed(2).replace('.', ',')}
                  </span>
                </div>

                {/* dúvida da IA */}
                <div className="rounded-[11px] border border-[rgba(245,130,13,.35)] bg-aj-actbg px-3 py-[10px] text-[12.5px] font-extrabold leading-[1.45] text-aj-orange">
                  {item.doubt}
                </div>

                {/* rename box / modo correção */}
                {editDraft === null ? (
                  <div className="break-all rounded-[11px] border border-aj-border bg-aj-cream px-3 py-[10px] text-[12.5px] font-extrabold">
                    <span>{item.rnOld}</span>
                    <span className="my-1 block font-bold text-aj-faint">↓ renomeia para</span>
                    <span>{item.rnNew}</span>
                  </div>
                ) : (
                  <div className="rounded-[11px] border border-aj-orange bg-aj-cream px-3 py-[10px] text-[12.5px] font-extrabold">
                    <span className="text-aj-faint">{item.rnOld}</span>
                    <span className="my-1 block font-bold text-aj-faint">↓ renomeia para</span>
                    <input
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="w-full rounded-lg border border-aj-border bg-white px-[10px] py-[7px] font-[inherit] text-[12.5px] font-extrabold text-aj-ink outline-none focus:[box-shadow:0_0_0_3px_rgba(245,130,13,.15)]"
                    />
                  </div>
                )}

                {/* ações */}
                {editDraft === null ? (
                  <div className="flex gap-[9px]">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      disabled={decidir.isPending}
                      onClick={() => resolveItem('ok')}
                      className="flex-1 cursor-pointer rounded-full border-none bg-aj-teal px-[18px] py-[13px] font-[inherit] text-[14px] font-black text-white transition-colors duration-150 hover:bg-aj-teal-hover disabled:cursor-default disabled:opacity-70"
                    >
                      ✓ Aprovar
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      disabled={decidir.isPending}
                      onClick={() => setEditDraft(item.rnNew)}
                      className="flex-1 cursor-pointer rounded-full border-[1.5px] border-aj-border bg-white px-[18px] py-[13px] font-[inherit] text-[14px] font-black text-aj-ink transition-colors duration-150 hover:border-aj-ink disabled:cursor-default disabled:opacity-70"
                    >
                      ✎ Corrigir
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      disabled={decidir.isPending}
                      onClick={() => resolveItem('rej')}
                      className="flex-1 cursor-pointer rounded-full border-[1.5px] border-aj-danger bg-white px-[18px] py-[13px] font-[inherit] text-[14px] font-black text-aj-danger transition-colors duration-150 disabled:cursor-default disabled:opacity-70"
                    >
                      ✕ 2ª foto
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex gap-[9px]">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      disabled={decidir.isPending}
                      onClick={() => resolveItem('fix')}
                      className="flex-1 cursor-pointer rounded-full border-none bg-aj-orange px-[18px] py-[13px] font-[inherit] text-[14px] font-black text-white transition-colors duration-150 hover:bg-aj-orange-hover disabled:cursor-default disabled:opacity-70"
                    >
                      ✓ Confirmar correção
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setEditDraft(null)}
                      className="cursor-pointer rounded-full border-[1.5px] border-aj-border bg-white px-[18px] py-[13px] font-[inherit] text-[14px] font-black text-aj-muted transition-colors duration-150 hover:border-aj-ink"
                    >
                      Cancelar
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {queueDone && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center gap-2 rounded-[14px] border border-[rgba(47,199,158,.4)] bg-aj-teal-soft p-[22px] text-center font-black text-aj-teal-dark"
            >
              <div className="text-[30px]">✓</div>
              <div>Fila zerada — lote pronto pra entrega.</div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                disabled={delivered || entregar.isPending}
                onClick={deliver}
                className="cursor-pointer rounded-full border-none bg-aj-orange px-[18px] py-[13px] font-[inherit] text-[14px] font-black text-white transition-colors duration-150 hover:bg-aj-orange-hover disabled:cursor-default disabled:opacity-80"
              >
                {delivered ? 'Entregue ✓' : 'Entregar e notificar o cliente'}
              </motion.button>
            </motion.div>
          )}
        </div>
      </Rise>
    </div>
  );
}
