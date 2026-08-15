import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { trpc } from "@/providers/trpc";
import LogoTick from "@/components/LogoTick";
import Footer from "@/components/Footer";
import MascotAvatar from "@/components/MascotAvatar";
import type { MascotId } from "@/components/MascotAvatar";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────
   Portal do Cliente — /cliente/:loteId (demo: /cliente/482)
   Réplica fiel de mockups/portal-cliente.html com dados reais
   via tRPC (motor de simulação vive no servidor: sim.tick).
   Fallback gracioso: se o backend falhar, usa os dados
   estáticos do mockup e a simulação local — a página nunca quebra.
   ──────────────────────────────────────────────────────────── */

type Ator = "bia" | "tom" | "lia" | "pedro" | "sys" | "me";
type DocStatus = "todo" | "doing" | "done";

type FeedItem = {
  id: string;
  ator: Ator;
  texto: string;
  hora: string;
  alerta?: boolean;
};
type DocView = {
  id: number;
  oldName: string;
  newName: string;
  status: DocStatus;
};

/* ── Textos/dados verbatim do mockup (fallback) ── */

const SEED_FEED: FeedItem[] = [
  {
    id: "seed-4",
    ator: "pedro",
    texto:
      "<b>Pedro</b> conferiu <b>10 documentos</b>: todos aprovados de primeira",
    hora: "14h11",
  },
  {
    id: "seed-3",
    ator: "lia",
    texto:
      "<b>Lia</b> indexou o <b>contrato do apto 302</b> — já dá pra buscar",
    hora: "14h07",
  },
  {
    id: "seed-2",
    ator: "tom",
    texto: "<b>Tom</b> renomeou <b>8 arquivos</b> no padrão da sua obra",
    hora: "14h05",
  },
  {
    id: "seed-1",
    ator: "bia",
    texto: "<b>Bia</b> separou <b>12 notas de material</b> da Litoral Plaza",
    hora: "14h02",
  },
];

const FB_LIVE: Array<[Ator, string, boolean?]> = [
  [
    "bia",
    "<b>Bia</b> classificou a nota da <b>Gessopar</b> como NF de material",
  ],
  ["tom", "<b>Tom</b> renomeou <b>3 recibos</b> do Seu Zé"],
  ["lia", "<b>Lia</b> ligou <b>4 notas</b> ao resumo de custo do apto 302"],
  ["pedro", "<b>Pedro</b> aprovou <b>5 documentos</b> que estavam com dúvida"],
  [
    "bia",
    "<b>Bia</b> achou um <b>boleto do condomínio vencendo dia 20</b> — criamos um alerta pra você",
    true,
  ],
  ["tom", "<b>Tom</b> separou as <b>fotos da laje</b> por data"],
  ["lia", "<b>Lia</b> gerou o <b>cartão-resumo</b> da medição parcial 2"],
  [
    "pedro",
    "<b>Pedro</b> pediu 2ª foto de <b>1 nota torta</b> pro mestre de obras",
  ],
];

const FB_DOCS_SEED: DocView[] = [
  {
    id: 6,
    oldName: "IMG_20260814_1432.jpg",
    newName: "2026-08-NF-MAT-GESSOPAR-LITORAL-R4280.pdf",
    status: "done",
  },
  {
    id: 7,
    oldName: "doc (7).pdf",
    newName: "2026-08-MEDICAO-MAODBOBRA-LITORAL-PARCIAL2.pdf",
    status: "done",
  },
  {
    id: 8,
    oldName: "WhatsApp Image 2026-08-13 at 17.52.jpeg",
    newName: "2026-08-DIARIO-OBRA-LITORAL-DIA13.pdf",
    status: "doing",
  },
  {
    id: 9,
    oldName: "ART laje 2o pavimento.pdf",
    newName: "2026-08-ART-LAJE-PAV2-LITORAL.pdf",
    status: "todo",
  },
  {
    id: 10,
    oldName: "recibo ze agosto.jpeg",
    newName: "2026-08-RECIBO-MO-JOSE-FERREIRA-LITORAL.pdf",
    status: "todo",
  },
  {
    id: 11,
    oldName: "contrato pedreiro FINAL final2.pdf",
    newName: "2026-08-CONTRATO-MO-ANTONIO-S-LITORAL.pdf",
    status: "todo",
  },
  {
    id: 12,
    oldName: "boleto condomínio.pdf",
    newName: "2026-08-BOLETO-COND-LITORAL-UN302.pdf",
    status: "todo",
  },
  {
    id: 13,
    oldName: "orcamento tintas suvinil.pdf",
    newName: "2026-08-ORCAMENTO-TINTAS-SUVINIL-LITORAL.pdf",
    status: "todo",
  },
];

type TeamMember = {
  id: MascotId;
  name: string;
  role: string;
  tag: "agente" | "humano";
  tasks: string[];
  doneLabel: string;
  base: number;
  ring?: boolean;
};

const TEAM: TeamMember[] = [
  {
    id: "bia",
    name: "Bia",
    role: "Triagem",
    tag: "agente",
    doneLabel: "docs separados",
    base: 38,
    tasks: [
      "separando <b>notas de material</b> do resto",
      "conferindo <b>fotos do WhatsApp</b> do Pedro",
      "marcando o que é <b>duplicado</b>",
    ],
  },
  {
    id: "tom",
    name: "Tom",
    role: "Nomeação",
    tag: "agente",
    doneLabel: "docs nomeados",
    base: 31,
    tasks: [
      "renomeando <b>contratos</b> da Litoral Plaza",
      "padronizando <b>recibos do Seu Zé</b>",
      "montando as <b>pastas por unidade</b>",
    ],
  },
  {
    id: "lia",
    name: "Lia",
    role: "Busca e índice",
    tag: "agente",
    doneLabel: "docs indexados",
    base: 27,
    ring: true,
    tasks: [
      "montando seu <b>índice de busca</b>",
      "ligando <b>notas ao apto 302</b>",
      "gerando <b>resumo de custo</b> da obra",
    ],
  },
  {
    id: "pedro",
    name: "Pedro",
    role: "Conferente",
    tag: "humano",
    doneLabel: "docs conferidos",
    base: 22,
    tasks: [
      "conferindo o que a Bia <b>marcou com dúvida</b>",
      "ligando pro mestre de obras sobre <b>1 nota ilegível</b>",
      "aprovando a <b>leva de contratos</b>",
    ],
  },
];

const H1_WORDS = [
  "Seu",
  "time",
  "tá",
  "ajeitando",
  "a",
  "papelada",
  "da",
  "obra",
  "Litoral",
  "Plaza.",
];

/* ── Helpers de data (pt-BR, sem depender de locale do SO) ── */

const DIAS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function asDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(v as string);
}
function fmtPrazo(d: Date): string {
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}
function fmtHora(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Renderiza texto com marcação <b>…</b> de forma segura (sem innerHTML). */
function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(<b>.*?<\/b>)/g).filter(Boolean);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith("<b>") && p.endsWith("</b>") ? (
          <b key={i} className="text-aj-ink">
            {p.slice(3, -4)}
          </b>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

/** Incremento determinístico ~50%/tique (substitui Math.random do mockup, sem re-render instável). */
function teamCount(base: number, memberIdx: number, tick: number): number {
  let c = base;
  for (let k = 1; k <= tick; k++) c += (k * 31 + memberIdx * 17) % 2;
  return c;
}

/* ── Skeleton discreto (tokens do design) ── */

function PortalSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1060px] flex-col gap-[22px] px-[22px] pb-20 pt-[26px]">
      <div className="flex items-center justify-between gap-4">
        <div className="h-8 w-24 animate-pulse rounded-lg bg-aj-rail" />
        <div className="flex gap-[10px]">
          <div className="h-9 w-28 animate-pulse rounded-full bg-aj-rail" />
          <div className="h-10 w-44 animate-pulse rounded-full bg-aj-rail" />
        </div>
      </div>
      <div className="flex h-[200px] animate-pulse flex-col justify-between rounded-[24px] bg-aj-dark p-[30px]">
        <div className="h-5 w-44 rounded-full bg-white/10" />
        <div className="h-8 w-2/3 rounded-lg bg-white/10" />
        <div className="h-[14px] w-full rounded-full bg-white/10" />
      </div>
      <div className="h-6 w-48 animate-pulse rounded-lg bg-aj-rail" />
      <div className="grid grid-cols-2 gap-[14px] min-[901px]:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="h-[150px] animate-pulse rounded-[18px] border border-aj-border bg-white"
          />
        ))}
      </div>
      <div className="grid items-start gap-[18px] min-[901px]:grid-cols-[1.05fr_1fr]">
        <div className="h-[300px] animate-pulse rounded-[18px] border border-aj-border bg-white" />
        <div className="h-[300px] animate-pulse rounded-[18px] border border-aj-border bg-white" />
      </div>
    </div>
  );
}

/* ── Componentes de apresentação ── */

function FeedAvatar({ ator }: { ator: Ator }) {
  if (ator === "bia" || ator === "tom" || ator === "lia" || ator === "pedro") {
    return <MascotAvatar id={ator} size={30} radius={9} className="shrink-0" />;
  }
  return (
    <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-aj-dark text-[13px] text-aj-cream">
      ⚙
    </div>
  );
}

function DocState({ status }: { status: DocStatus }) {
  return (
    <motion.div
      key={status}
      initial={{ scale: 0.7 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", duration: 0.25 }}
      className={cn(
        "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[13px] font-black",
        status === "todo" &&
          "border-[1.5px] border-aj-border bg-aj-cream text-transparent",
        status === "doing" && "border-[1.5px] border-aj-orange bg-aj-actbg",
        status === "done" && "bg-aj-teal text-white"
      )}
    >
      {status === "doing" ? (
        <span className="h-3 w-3 animate-spin rounded-full border-[2.5px] border-aj-orange border-t-transparent" />
      ) : status === "done" ? (
        "✓"
      ) : (
        ""
      )}
    </motion.div>
  );
}

function TeamCard({
  m,
  index,
  working,
  task,
  count,
}: {
  m: TeamMember;
  index: number;
  working: boolean;
  task: string;
  count: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 * index, ease: "easeOut" }}
      className={cn(
        "relative flex flex-col gap-[11px] rounded-[18px] border bg-white p-[18px] transition-[border-color,box-shadow] duration-300",
        working
          ? "border-aj-orange [box-shadow:0_0_0_4px_rgba(245,130,13,.08)]"
          : "border-aj-border"
      )}
    >
      <div className="flex items-center gap-[11px]">
        <div className="relative h-11 w-11 shrink-0">
          <MascotAvatar id={m.id} size={44} radius={14} />
          {m.ring && (
            <svg
              viewBox="0 0 44 44"
              className="absolute inset-0 h-11 w-11"
              aria-hidden="true"
            >
              <circle
                cx={22}
                cy={26}
                r={11}
                fill="none"
                stroke="#D9534F"
                strokeWidth={1.5}
                opacity={0.35}
              />
            </svg>
          )}
          <span
            className={cn(
              "absolute -bottom-1 -right-1 h-[14px] w-[14px] rounded-full border-[2.5px] border-white bg-aj-border",
              working && "animate-pulse-ring bg-aj-teal"
            )}
          />
        </div>
        <div>
          <div className="text-[15.5px] font-black">{m.name}</div>
          <div className="text-[12px] font-extrabold text-aj-faint">
            {m.role}
          </div>
        </div>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-[3px] text-[10px] font-black uppercase tracking-[.08em]",
            m.tag === "humano"
              ? "bg-aj-teal-soft text-aj-teal-dark"
              : "bg-aj-actbg text-aj-orange"
          )}
        >
          {m.tag}
        </span>
      </div>
      <div className="min-h-[38px] text-[13px] font-bold leading-[1.45] text-aj-muted">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={task}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="block"
          >
            <RichText text={task} />
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="flex items-center justify-between border-t border-aj-rail pt-[10px] text-[12px] font-black text-aj-faint">
        <span>{m.doneLabel}</span>
        <span className="tabular-nums text-aj-ink">{count}</span>
      </div>
    </motion.div>
  );
}

function DoneOverlay({
  open,
  total,
  onClose,
  onAprovar,
}: {
  open: boolean;
  total: number;
  onClose: () => void;
  onAprovar: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={e => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(46,39,33,.55)] p-5"
        >
          <motion.div
            initial={{ scale: 0.92, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", duration: 0.35 }}
            className="flex w-full max-w-[520px] flex-col items-center gap-[14px] rounded-[24px] bg-aj-cream px-[34px] py-9 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.15, 1] }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-aj-teal text-[34px] font-black text-white"
            >
              ✓
            </motion.div>
            <h2 className="text-[30px] font-black tracking-[-0.02em]">
              Tá tudo ajeitado!
            </h2>
            <p className="text-[15px] font-bold leading-[1.55] text-aj-muted">
              <b>{total} documentos</b> organizados, nomeados e buscáveis na sua
              pasta da obra Litoral Plaza. Entregue <b>1 dia antes do prazo</b>.
            </p>
            <p className="text-[13.5px] font-bold leading-[1.55] text-aj-muted">
              O Pedro conferiu tudo que os agentes marcaram com dúvida. Achamos
              ainda <b>1 boleto vencendo dia 20</b> — já criamos um alerta pra
              você.
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="w-full cursor-pointer rounded-full bg-aj-orange px-7 py-[15px] text-[15px] font-black text-white transition-colors duration-150 hover:bg-aj-orange-hover"
            >
              Ver minha pasta organizada
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onAprovar}
              className="w-full cursor-pointer rounded-full border-[1.5px] border-aj-border bg-white px-7 py-[15px] text-[15px] font-black text-aj-ink transition-colors duration-150 hover:border-aj-ink"
            >
              Aprovar e receber o relatório
            </motion.button>
            <div className="text-[12.5px] font-extrabold text-aj-faint">
              Você só paga quando aprovar. Combinado é combinado.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Página ── */

export default function ClientePortal() {
  const { loteId } = useParams();
  const numero = Number(loteId) || 482;

  /* ── Dados reais via tRPC ── */
  const loteQ = trpc.lotes.porNumero.useQuery(
    { numero },
    { refetchInterval: 2800, retry: 1 }
  );
  const lote = loteQ.data?.lote ?? null;
  const loteDbId = lote?.id ?? null;
  // Fallback: query falhou ou o lote não existe → usa dados estáticos do mockup.
  const backendDown = loteQ.isError || (loteQ.isSuccess && !loteQ.data);

  const docsQ = trpc.documentos.porLote.useQuery(
    { loteId: loteDbId ?? 0 },
    { enabled: loteDbId != null, refetchInterval: 2800 }
  );

  const [sinceId, setSinceId] = useState(0);
  const eventosQ = trpc.eventos.porLote.useQuery(
    { loteId: loteDbId ?? 0, sinceId },
    { enabled: loteDbId != null, refetchInterval: 2600 }
  );

  const aprovarMut = trpc.lotes.aprovar.useMutation();
  const tickMut = trpc.sim.tick.useMutation();
  const tickMutRef = useRef(tickMut.mutate);
  useEffect(() => {
    tickMutRef.current = tickMut.mutate;
  }, [tickMut.mutate]);

  /* ── Estado local / fallback ── */
  const [approvedLocal, setApprovedLocal] = useState(false);
  const approved = approvedLocal || lote?.status === "aprovado";
  const serverDone = lote?.status === "entregue" || lote?.status === "aprovado";

  const [tick, setTick] = useState(0);
  const [fbDone, setFbDone] = useState(54);
  const [fbDocs, setFbDocs] = useState<DocView[]>(FB_DOCS_SEED);
  const [feed, setFeed] = useState<FeedItem[]>(SEED_FEED);
  const [showOverlay, setShowOverlay] = useState(false);
  const [termo, setTermo] = useState("nota do gesso do apto 302");
  const [busca, setBusca] = useState("nota do gesso do apto 302");
  const [barMounted, setBarMounted] = useState(false);

  const total = lote?.qtdArquivos ?? 86;
  const done =
    approved || serverDone
      ? total
      : backendDown
        ? fbDone
        : lote
          ? Math.min(lote.docsAjeitados, total)
          : 54;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = done >= total;

  /* ── Motor da simulação no servidor: sim.tick a cada ~2,6s ── */
  useEffect(() => {
    if (loteDbId == null || serverDone || complete) return;
    const iv = setInterval(
      () => tickMutRef.current({ loteId: loteDbId }, {}),
      2600
    );
    return () => clearInterval(iv);
  }, [loteDbId, serverDone, complete]);

  /* ── Tique visual local (time, e no fallback também progresso/docs/feed) ── */
  const haltTicks = approved || complete;
  const tickRef = useRef(0);
  useEffect(() => {
    if (haltTicks) return;
    const iv = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;
      setTick(t);
      if (!backendDown) return;
      // Modo fallback: replica a simulação do mockup no cliente.
      setFbDone(d => Math.min(86, d + 2));
      setFbDocs(prev => {
        const next = [...prev];
        const doingIdx = next.findIndex(d => d.status === "doing");
        if (doingIdx < 0) return next;
        next[doingIdx] = { ...next[doingIdx], status: "done" };
        const todoIdx = next.findIndex(d => d.status === "todo");
        if (todoIdx >= 0) next[todoIdx] = { ...next[todoIdx], status: "doing" };
        return next;
      });
      const ev = FB_LIVE[t % FB_LIVE.length];
      const hora = `14h${String(12 + t * 2).padStart(2, "0")}`;
      setFeed(prev =>
        [
          {
            id: `fb-${t}`,
            ator: ev[0],
            texto: ev[1],
            alerta: ev[2] ?? false,
            hora,
          },
          ...prev,
        ].slice(0, 8)
      );
    }, 2600);
    return () => clearInterval(iv);
  }, [haltTicks, backendDown]);

  /* ── Feed incremental do servidor (guarda o maior id visto) ──
     Merge durante o render (padrão "adjusting state when props change",
     sem refs — react-hooks/refs). */
  const evData = eventosQ.data;
  const [seenId, setSeenId] = useState<number | null>(null);
  const [prevEvData, setPrevEvData] = useState(evData);
  if (evData !== prevEvData) {
    setPrevEvData(evData);
    if (evData && evData.length > 0) {
      const maxId = Math.max(...evData.map(e => e.id));
      if (seenId === null) {
        // primeira carga: marca a baseline sem inundar o feed seed
        setSeenId(maxId);
        setSinceId(maxId);
      } else if (maxId > seenId) {
        const novos = evData
          .filter(e => e.id > seenId)
          .sort((a, b) => a.id - b.id)
          .map<FeedItem>(e => ({
            id: `ev-${e.id}`,
            ator: e.ator,
            texto: e.texto,
            alerta: e.alerta,
            hora: fmtHora(asDate(e.criadoEm)),
          }));
        setSeenId(maxId);
        setSinceId(maxId);
        setFeed(prev => [...novos, ...prev].slice(0, 8));
      }
    }
  }

  /* ── Documentos da trilha do portal (ids > 5, status todo/doing/done) ── */
  const docs: DocView[] = useMemo(() => {
    if (backendDown || !docsQ.data) return fbDocs;
    const list = docsQ.data
      .filter(
        d =>
          d.id > 5 &&
          (d.status === "todo" || d.status === "doing" || d.status === "done")
      )
      .slice(0, 8)
      .map<DocView>(d => ({
        id: d.id,
        oldName: d.nomeOriginal,
        newName: d.nomeFinal ?? d.nomeOriginal,
        status: d.status as DocStatus,
      }));
    return list.length > 0 ? list : fbDocs;
  }, [backendDown, docsQ.data, fbDocs]);

  /* ── Overlay final: abre 800ms depois do progresso chegar a 100% ── */
  const overlayShownRef = useRef(false);
  useEffect(() => {
    if (!complete || approved || overlayShownRef.current) return;
    const t = setTimeout(() => {
      overlayShownRef.current = true;
      setShowOverlay(true);
    }, 800);
    return () => clearTimeout(t);
  }, [complete, approved]);

  /* ── Barra do hero: preenche 0→pct 300ms após o mount ── */
  useEffect(() => {
    const t = setTimeout(() => setBarMounted(true), 300);
    return () => clearTimeout(t);
  }, []);

  function handleAprovar() {
    setApprovedLocal(true);
    setShowOverlay(false);
    if (loteDbId != null) aprovarMut.mutate({ id: loteDbId });
  }

  function handleBusca(e: React.FormEvent) {
    e.preventDefault();
    setBusca(termo.trim() || "nota do gesso do apto 302");
  }

  if (loteQ.isLoading) {
    return (
      <div className="min-h-[100dvh] bg-aj-cream">
        <PortalSkeleton />
      </div>
    );
  }

  const prazoTexto = lote
    ? fmtPrazo(asDate(lote.prazoEm))
    : "segunda, 18 de agosto";
  const recebidoHora = lote ? fmtHora(asDate(lote.recebidoEm)) : "08h14";

  return (
    <div className="min-h-[100dvh] bg-aj-cream">
      <div className="mx-auto flex w-full max-w-[1060px] flex-col gap-[22px] px-[22px] pb-20 pt-[26px]">
        {/* ── Topbar ── */}
        <header className="flex items-center justify-between gap-[14px]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <LogoTick variant="dark" className="text-[30px]" />
          </motion.div>
          <div className="flex items-center gap-[10px]">
            <motion.span
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 }}
              className={cn(
                "inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border px-[15px] py-2 text-[12.5px] font-black",
                approved
                  ? "border-[rgba(47,199,158,.4)] bg-aj-teal-soft text-aj-teal-dark"
                  : "border-aj-border bg-white text-aj-muted"
              )}
            >
              {approved ? "Aprovado ✓" : `Pedido nº ${numero}`}
            </motion.span>
            <motion.a
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.16 }}
              href="#"
              onClick={e => e.preventDefault()}
              className="whitespace-nowrap rounded-full bg-aj-whatsapp px-5 py-[10px] text-[14px] font-black text-white"
            >
              Falar no WhatsApp
            </motion.a>
          </div>
        </header>

        {/* ── Hero de status (fundo escuro) ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative flex flex-col gap-[18px] overflow-hidden rounded-[24px] bg-aj-dark px-[30px] pb-7 pt-[30px] text-aj-cream"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-3">
              {approved ? (
                <span className="inline-flex items-center gap-[9px] text-[13px] font-black uppercase tracking-[.1em] text-aj-teal-light">
                  ✓ Aprovado
                </span>
              ) : (
                <span className="inline-flex items-center gap-[9px] text-[13px] font-black uppercase tracking-[.1em] text-aj-teal-light">
                  <span className="h-[10px] w-[10px] animate-pulse-ring rounded-full bg-aj-teal" />
                  Trabalhando agora
                </span>
              )}
              <h1 className="max-w-[560px] text-[26px] font-black leading-[1.15] tracking-[-0.015em] min-[901px]:text-[34px]">
                {approved
                  ? "Pedido aprovado — valeu!"
                  : H1_WORDS.map((w, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.15 + i * 0.03 }}
                        className={cn(
                          "inline-block",
                          w === "ajeitando" && "text-aj-orange"
                        )}
                      >
                        {w}
                        {i < H1_WORDS.length - 1 ? " " : ""}
                      </motion.span>
                    ))}
              </h1>
            </div>
            <div className="min-w-[230px] rounded-[16px] border border-[rgba(251,246,238,.14)] bg-[rgba(251,246,238,.07)] px-[18px] py-[14px]">
              <div className="text-[11.5px] font-black uppercase tracking-[.1em] text-aj-sand">
                Prometido
              </div>
              <div className="mt-[3px] text-[19px] font-black">
                {prazoTexto}
              </div>
              <div className="mt-[2px] text-[12.5px] font-extrabold text-aj-teal-light">
                ⏱ vamos entregar antes do prazo
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-[9px]">
            <div className="flex justify-between text-[14px] font-extrabold text-[#E7DAC4]">
              <span>
                <b className="text-white">{done}</b> de{" "}
                <b className="text-white">{total}</b> documentos ajeitados
              </span>
              <span className="tabular-nums">{approved ? 100 : pct}%</span>
            </div>
            <div className="h-[14px] overflow-hidden rounded-full bg-[rgba(251,246,238,.12)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#F5820D,#2FC79E)] transition-[width] duration-1000"
                style={{
                  width: barMounted ? `${approved ? 100 : pct}%` : "0%",
                }}
              />
            </div>
            <div className="text-[12.5px] font-extrabold text-aj-sand">
              Recebeu hoje {recebidoHora} · tudo que já foi ajeitado já dá pra
              buscar aqui embaixo ↓
            </div>
          </div>
        </motion.section>

        {/* ── Time ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          className="text-[21px] font-black tracking-[-0.01em]"
        >
          Quem tá no seu time
        </motion.div>
        <div className="grid grid-cols-2 gap-[14px] min-[901px]:grid-cols-4">
          {TEAM.map((m, i) => {
            const working = !haltTicks && (tick + i) % 4 < 2;
            const taskIdx =
              tick === 0 ? 0 : Math.floor((tick + i) / 2) % m.tasks.length;
            return (
              <TeamCard
                key={m.id}
                m={m}
                index={i}
                working={working}
                task={m.tasks[taskIdx]}
                count={teamCount(m.base, i, tick)}
              />
            );
          })}
        </div>

        {/* ── Feed + documentos ── */}
        <div className="grid items-start gap-[18px] min-[901px]:grid-cols-[1.05fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
            className="rounded-[18px] border border-aj-border bg-white px-[22px] py-5"
          >
            <div className="mb-[6px] flex items-center gap-[9px] text-[15.5px] font-black">
              Acontecendo agora
            </div>
            <div className="flex max-h-[380px] flex-col overflow-hidden">
              {feed.map(f => (
                <div
                  key={f.id}
                  className={cn(
                    "flex animate-slidein gap-3",
                    f.alerta
                      ? "my-[6px] rounded-[12px] bg-aj-actbg px-3 py-[11px]"
                      : "border-b border-aj-feedline px-[2px] py-[11px]"
                  )}
                >
                  <FeedAvatar ator={f.ator} />
                  <div>
                    <RichText
                      text={f.texto}
                      className={cn(
                        "text-[13.5px] font-bold leading-[1.45]",
                        f.alerta ? "text-aj-ink" : "text-aj-muted"
                      )}
                    />
                    <div className="mt-[2px] text-[11.5px] font-extrabold tabular-nums text-aj-faint">
                      {f.hora}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
            className="rounded-[18px] border border-aj-border bg-white px-[22px] py-5"
          >
            <div className="mb-[6px] flex items-center gap-[9px] text-[15.5px] font-black">
              Seus documentos
              <span className="ml-auto text-[12px] font-black text-aj-faint">
                mostrando {docs.length} de {total}
              </span>
            </div>
            <div className="flex flex-col">
              {docs.map(d => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 border-b border-aj-feedline px-[2px] py-[10px]"
                >
                  <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border border-aj-border bg-aj-cream text-[12px] font-black text-aj-faint">
                    📄
                  </div>
                  <div className="min-w-0 flex-1">
                    <motion.div
                      key={d.status}
                      initial={
                        d.status !== "todo"
                          ? { backgroundColor: "rgba(47,199,158,.28)" }
                          : false
                      }
                      animate={{ backgroundColor: "rgba(47,199,158,0)" }}
                      transition={{ duration: 0.6 }}
                      className="truncate rounded-md px-1 text-[13.5px] font-extrabold"
                    >
                      {d.newName}
                    </motion.div>
                    <div className="truncate px-1 text-[11.5px] font-bold text-aj-faint">
                      {d.oldName}
                    </div>
                  </div>
                  <DocState status={d.status} />
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Busca demo ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
          className="flex flex-col gap-3 rounded-[18px] border border-aj-border bg-white p-[22px]"
        >
          <div className="text-[21px] font-black tracking-[-0.01em]">
            Enquanto o time trabalha, você já pode perguntar
          </div>
          <form
            onSubmit={handleBusca}
            className="flex items-center gap-[10px] rounded-full border-[1.5px] border-aj-border bg-aj-cream px-5 py-[13px] transition-shadow focus-within:border-aj-orange focus-within:[box-shadow:0_0_0_3px_rgba(245,130,13,.18)]"
          >
            <span aria-hidden="true">🔎</span>
            <input
              value={termo}
              onChange={e => setTermo(e.target.value)}
              placeholder="nota do gesso do apto 302"
              aria-label="Buscar nos seus documentos"
              className="w-full bg-transparent text-[14.5px] font-bold text-aj-ink outline-none placeholder:text-aj-faint"
            />
          </form>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={busca}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="rounded-[14px] border border-[rgba(47,199,158,.35)] bg-aj-teal-soft px-4 py-[13px] text-[13.5px] font-bold leading-[1.5] text-[#14694F]"
            >
              Achei “<b className="text-[#0E4B37]">{busca}</b>”:{" "}
              <b className="text-[#0E4B37]">
                2026-08-NF-MAT-GESSOPAR-LITORAL-R4280.pdf
              </b>{" "}
              — Nota da Gessopar, R$ 4.280,00, entregue no apto 302 dia 14/08.{" "}
              <b className="text-[#0E4B37]">Abrir arquivo →</b>
            </motion.div>
          </AnimatePresence>
          <div className="text-[12.5px] font-bold text-aj-faint">
            Funciona pelo WhatsApp também. Qualquer papel, sempre.
          </div>
        </motion.section>

        {/* ── Preview do estado final ── */}
        <button
          onClick={() => {
            overlayShownRef.current = true;
            setShowOverlay(true);
          }}
          className="mx-auto cursor-pointer text-[13px] font-extrabold text-aj-faint underline"
        >
          ver como fica quando o pedido termina →
        </button>
      </div>

      <Footer />

      <DoneOverlay
        open={showOverlay}
        total={total}
        onClose={() => setShowOverlay(false)}
        onAprovar={handleAprovar}
      />
    </div>
  );
}
