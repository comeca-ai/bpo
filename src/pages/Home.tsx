import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MascotAvatar from '@/components/MascotAvatar';
import type { MascotId } from '@/components/MascotAvatar';
import { setOpsState } from '@/lib/ops-store';
import { cn } from '@/lib/utils';

/* ---------- tipos e helpers de texto rico ---------- */

type Seg = { t: string; b?: boolean; hl?: 'o' | 't' };
const s = (t: string): Seg => ({ t });
const bd = (t: string): Seg => ({ t, b: true });
const ho = (t: string): Seg => ({ t, hl: 'o' });
const ht = (t: string): Seg => ({ t, hl: 't' });
const plain = (segs: Seg[]) => segs.map((g) => g.t).join('');

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

/* ---------- dados seed (verbatim do mockup aprovado) ---------- */

type QueueItem = {
  file: string;
  from: string;
  conf: number;
  page: Seg[][];
  rows: [string, string][];
  doubt: string;
  rnOld: string;
  rnNew: string;
};

const QUEUE: QueueItem[] = [
  {
    file: 'IMG_20260814_1432.jpg',
    from: 'WhatsApp · Pedro (mestre de obras)',
    conf: 0.71,
    page: [
      [s('GESSOPAR MATERIAIS LTDA · '), ho('CNPJ 12.345.678/0001-90')],
      [s('NOTA FISCAL Nº '), ho('8.412'), s(' · '), ho('14/08/2026')],
      [s('Gesso acartonado 42un · TOTAL '), ht('R$ 4.280,00')],
      [s('Entrega: '), ht('Obra Litoral Plaza — apto 302')],
    ],
    rows: [
      ['Tipo', 'NF de material'],
      ['Obra', 'Litoral Plaza'],
      ['Valor', 'R$ 4.280,00'],
    ],
    doubt:
      '⚠ “Gessopar” ou “Gesso Pará”? Dicionário v7 tem os dois. E entra no resumo de custo do apto 302?',
    rnOld: 'IMG_20260814_1432.jpg',
    rnNew: '2026-08-NF-MAT-GESSOPAR-LITORAL-R4280.pdf',
  },
  {
    file: 'WhatsApp Image 2026-08-13 at 17.52.jpeg',
    from: 'WhatsApp · Pedro',
    conf: 0.66,
    page: [
      [s('DIÁRIO DE OBRA — LITORAL PLAZA')],
      [s('Dia '), ho('13/08'), s(' (ou 18?) · 14 pedreiros')],
      [s('Laje do 2º pavimento concretada ✓')],
      [s('Assinatura '), ho('ilegível')],
    ],
    rows: [
      ['Tipo', 'Diário de obra'],
      ['Obra', 'Litoral Plaza'],
      ['Data', '13/08? (baixa certeza)'],
    ],
    doubt: '⚠ Data ambígua: “13” ou “18”? Cruzando com o diário anterior, 13/08 é o provável.',
    rnOld: 'WhatsApp Image 2026-08-13 at 17.52.jpeg',
    rnNew: '2026-08-DIARIO-OBRA-LITORAL-DIA13.pdf',
  },
  {
    file: 'holerite antonio julho.pdf',
    from: 'E-mail · cliente',
    conf: 0.88,
    page: [
      [s('RECIBO DE PAGAMENTO — '), ho('ANTÔNIO S.')],
      [s('Ref. '), ho('07/2026'), s(' · R$ 2.400,00')],
      [s('Função: pedreiro — Litoral Plaza')],
    ],
    rows: [
      ['Tipo', 'Holerite (fora do escopo)'],
      ['Pessoa', 'Antônio S.'],
      ['Valor', 'R$ 2.400,00'],
    ],
    doubt:
      '⚠ Confiança alta, MAS holerite é “docs de pessoas” — fora do escopo contratado. Guardar à parte e sugerir add-on.',
    rnOld: 'holerite antonio julho.pdf',
    rnNew: '(fora de escopo — pasta “_revisar” por enquanto)',
  },
  {
    file: 'nota 8413 torta.jpeg',
    from: 'WhatsApp · Pedro',
    conf: 0.58,
    page: [
      [s('Imagem torta ~30° · sombra no rodapé')],
      [s('Nº '), ho('8.413'), s(' · fornecedor ilegível')],
      [s('Total '), ho('R$ 9?0,00')],
    ],
    rows: [
      ['Tipo', 'NF de material (provável)'],
      ['Legibilidade', '58%'],
      ['Valor', 'incerto'],
    ],
    doubt: '⚠ Abaixo de 0,75 em foto: regra v7 diz pedir 2ª foto antes de decidir.',
    rnOld: 'nota 8413 torta.jpeg',
    rnNew: '(aguardando 2ª foto do mestre de obras)',
  },
  {
    file: 'contrato pedreiro FINAL final2.pdf',
    from: 'Drive · pasta “contratos”',
    conf: 0.81,
    page: [
      [s('CONTRATO DE PRESTAÇÃO DE SERVIÇO')],
      [s('Contratante: '), ho('Sol Nascente')],
      [s('Contratado: '), ho('“Seu Zé”'), s(' — José Ferreira MEI?')],
      [s('Vigência '), ho('01/08 a 30/11/2026')],
    ],
    rows: [
      ['Tipo', 'Contrato MO'],
      ['Parte', 'José Ferreira MEI (dicionário v7)'],
      ['Vigência', 'até 30/11/2026'],
    ],
    doubt:
      '⚠ “Seu Zé” = José Ferreira MEI (dicionário v7). Confirma? Se sim, gera alerta de vencimento p/ 30/11.',
    rnOld: 'contrato pedreiro FINAL final2.pdf',
    rnNew: '2026-08-CONTRATO-MO-JOSE-FERREIRA-LITORAL.pdf',
  },
];

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
type FeedItem = { id: number; who: FeedWho; segs: Seg[]; alert?: boolean; minute: number };

const FEED_SEED: { who: FeedWho; segs: Seg[] }[] = [
  {
    who: 'bia',
    segs: [s('Triagem: '), bd('12 fotos'), s(' do WhatsApp classificadas (conf. média 0,94)')],
  },
  { who: 'sys', segs: [s('OCR concluído: '), bd('34 escaneados'), s(' · custo R$ 1,36')] },
  { who: 'lia', segs: [s('Índice: '), bd('apto 302'), s(' agora tem 9 documentos ligados')] },
];

const AMBIENT: { who: FeedWho; segs: Seg[] }[] = [
  { who: 'bia', segs: [s('Duplicado detectado: nota '), bd('8.412'), s(' enviada 2× — fundida')] },
  { who: 'tom', segs: [s('Pasta '), bd('/Obras/Litoral-Plaza/medições'), s(' criada no Drive')] },
  { who: 'lia', segs: [bd('Cartão-resumo'), s(' da medição parcial 2 gerado')] },
  { who: 'pedro', segs: [s('Pedro conferiu a amostra de 5% — '), bd('sem divergências')] },
  { who: 'sys', segs: [s('Governança: concordância 97,2% · threshold mantido em 0,90')] },
  { who: 'tom', segs: [bd('3 recibos'), s(' do Seu Zé renomeados no padrão v7')] },
  { who: 'bia', segs: [s('Foto de fachada → tipo '), bd('“registro de obra”'), s(' (conf. 0,93)')] },
  { who: 'lia', segs: [s('Busca testada: “ART da laje” responde em '), bd('1,8s')] },
];

/* ---------- micro-componentes ---------- */

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

/* ---------- página: Console Ops ---------- */

export default function Home() {
  const [feed, setFeed] = useState<FeedItem[]>(() =>
    FEED_SEED.map((f, i) => ({ id: i + 1, who: f.who, segs: f.segs, minute: 15 + i })),
  );
  const minuteRef = useRef(14 + FEED_SEED.length);
  const idRef = useRef(FEED_SEED.length);
  const tickRef = useRef(0);

  const [tick, setTick] = useState(0);
  const [qi, setQi] = useState(0);
  const [docsDone, setDocsDone] = useState(79);
  const [queueLeft, setQueueLeft] = useState(QUEUE.length);
  const [validated, setValidated] = useState(187);
  const [delivered, setDelivered] = useState(false);
  const [scopeVisible, setScopeVisible] = useState(false);
  const [scopeSuggested, setScopeSuggested] = useState(false);
  const [editDraft, setEditDraft] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const addFeed = useCallback((who: FeedWho, segs: Seg[], alert = false) => {
    minuteRef.current += 1;
    const item: FeedItem = { id: ++idRef.current, who, segs, alert, minute: minuteRef.current };
    setFeed((prev) => [item, ...prev].slice(0, 9));
  }, []);

  /* sincroniza badge da nav + quota do rodapé da sidebar */
  useEffect(() => {
    setOpsState({ queueLeft, validatedToday: validated });
  }, [queueLeft, validated]);

  /* motor de tiques: feed ambiente + time respirando (3.4s) */
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
      const ev = AMBIENT[tickRef.current % AMBIENT.length];
      addFeed(ev.who, ev.segs);
    }, 3400);
    return () => clearInterval(id);
  }, [addFeed]);

  /* alerta de fora-de-escopo (~7s) */
  useEffect(() => {
    const id = setTimeout(() => {
      setScopeVisible(true);
      addFeed(
        'sys',
        [bd('Escopo:'), s(' 4 holerites detectados — tipo não mapeado no plano (guardados em “_revisar”)')],
        true,
      );
    }, 7000);
    return () => clearTimeout(id);
  }, [addFeed]);

  const queueDone = queueLeft <= 0;
  const item = qi < QUEUE.length ? QUEUE[qi] : null;

  const resolveItem = (action: 'ok' | 'fix' | 'rej') => {
    if (!item) return;
    if (action === 'ok') {
      const name = item.rnNew.length < 40 ? item.rnNew : item.file;
      addFeed('me', [bd('Você'), s(' aprovou '), bd(name), s(' em 9s')]);
    }
    if (action === 'fix') {
      addFeed('me', [
        bd('Você'),
        s(' corrigiu '),
        bd(item.file),
        s(' → feedback virou regra no contexto v7'),
      ]);
    }
    if (action === 'rej') {
      addFeed(
        'me',
        [bd('Você'), s(' pediu '), bd('2ª foto'), s(` de “${item.file}” — WhatsApp enviado ao Pedro`)],
        true,
      );
    }
    const nextLeft = Math.max(queueLeft - 1, 0);
    setValidated((v) => v + 1);
    setDocsDone((d) => d + 1);
    setQueueLeft(nextLeft);
    setEditDraft(null);
    if (nextLeft === 0) {
      addFeed('sys', [s('Fila de validação '), bd('zerada'), s(' · lote pronto para entrega')]);
    }
    setTimeout(() => setQi((i) => i + 1), 250);
  };

  const deliver = () => {
    setDelivered(true);
    addFeed(
      'sys',
      [
        bd('Lote #482 entregue'),
        s(' · Drive atualizado + WhatsApp enviado ao cliente · cobrança liberada após aprovação'),
      ],
      true,
    );
  };

  const q = search.trim().toLowerCase();
  const visibleFeed = q ? feed.filter((it) => plain(it.segs).toLowerCase().includes(q)) : feed;

  const steps = [
    { lines: ['Recebido', '08h14'], state: 'done' as const },
    { lines: ['OCR', '34 escaneados'], state: 'done' as const },
    { lines: ['IA classificou', '86/86'], state: 'done' as const },
    {
      lines: ['Validação', queueDone ? 'zerada ✓' : `${queueLeft} pendentes`],
      state: (queueDone ? 'done' : 'now') as 'done' | 'now',
    },
    { lines: ['Entrega', 'Drive + índice'], state: (delivered ? 'done' : 'todo') as 'done' | 'todo' },
  ];

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
              Lote #482 — Construtora Sol Nascente
            </div>
            <div className="text-[14px] font-extrabold text-aj-muted">
              João Pessoa · PB · plano 3 agentes + 2 skills · R$ 1.450/mês
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
              “Organiza as notas e os contratos da obra Litoral Plaza e monta o resumo de custo por
              apartamento.”
              <small className="mt-[6px] block text-[11.5px] font-extrabold text-aj-faint">
                recebido pelo WhatsApp · sáb 16/08, 08h14 · 86 arquivos
              </small>
            </div>
            <div className="mt-[10px] text-[12.5px] font-bold text-aj-faint">
              Contexto do cliente: <b className="text-aj-ink">v7</b> · 7 tipos de doc mapeados
            </div>
          </div>

          <div className="border-b border-aj-rail px-6 py-[18px] last:border-b-0 min-[1151px]:border-b-0 min-[1151px]:border-r min-[1151px]:last:border-r-0">
            <div className="mb-2 flex items-center gap-[7px] text-[11px] font-black uppercase tracking-[.1em] text-aj-faint">
              ⏱ Prazo
            </div>
            <div className="text-[14.5px] font-extrabold leading-[1.5]">
              Entrega: <span className="text-aj-orange">seg 18/08, 08h14</span>
            </div>
            <div className="mb-[6px] mt-2 h-[10px] overflow-hidden rounded-full bg-aj-rail">
              <motion.i
                className="block h-full rounded-full bg-[linear-gradient(90deg,#2FC79E,#F5820D)]"
                initial={{ width: '0%' }}
                animate={{ width: '34%' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-[12px] font-extrabold text-aj-faint">
              <span>34% do tempo usado</span>
              <span>31h restantes</span>
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
              <span className="mb-[5px] mr-[5px] inline-flex rounded-full border border-[rgba(47,199,158,.4)] bg-aj-teal-soft px-[11px] py-1 text-[12px] font-extrabold text-aj-teal-dark">
                Docs de obra
              </span>
              <span className="mb-[5px] mr-[5px] inline-flex rounded-full border border-[rgba(47,199,158,.4)] bg-aj-teal-soft px-[11px] py-1 text-[12px] font-extrabold text-aj-teal-dark">
                Caixa de documentos
              </span>
              <span className="mb-[5px] mr-[5px] inline-flex rounded-full border border-aj-border bg-aj-cream px-[11px] py-1 text-[12px] font-extrabold text-aj-muted">
                + resumo de custo por apto
              </span>
            </div>
            <div>
              <span className="mb-[5px] mr-[5px] inline-flex rounded-full border border-dashed border-aj-border bg-aj-chipout px-[11px] py-1 text-[12px] font-extrabold text-aj-faint">
                fora: holerites/folha
              </span>
              <span className="mb-[5px] mr-[5px] inline-flex rounded-full border border-dashed border-aj-border bg-aj-chipout px-[11px] py-1 text-[12px] font-extrabold text-aj-faint">
                fora: lançamento contábil
              </span>
              <span className="mb-[5px] mr-[5px] inline-flex rounded-full border border-dashed border-aj-border bg-aj-chipout px-[11px] py-1 text-[12px] font-extrabold text-aj-faint">
                fora: assinatura/parecer
              </span>
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
                  addFeed('me', [
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
                <span className="text-[16px] text-aj-faint">/86</span>
              </>
            ),
            delta: delivered
              ? '86/86 entregues · pasta + índice no Drive'
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
            value: <CountUp value={87} format={(n) => `${Math.round(n)}%`} />,
            delta: 'threshold 0,90 · concordância 97,2%',
            up: true,
          },
          {
            label: 'Custo por doc',
            value: <CountUp value={0.04} format={(n) => `R$ ${n.toFixed(2).replace('.', ',')}`} />,
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
                      14h{String(it.minute).padStart(2, '0')} · registrado no audit trail
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {visibleFeed.length === 0 && (
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
            {!queueDone && <Pill tone="orange">{`item ${qi + 1} de ${QUEUE.length}`}</Pill>}
            <span className="ml-auto text-[12px] font-extrabold text-aj-faint">meta ≤ 15s/doc</span>
          </div>

          <AnimatePresence mode="wait">
            {!queueDone && item && (
              <motion.div
                key={qi}
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
                      onClick={() => resolveItem('ok')}
                      className="flex-1 cursor-pointer rounded-full border-none bg-aj-teal px-[18px] py-[13px] font-[inherit] text-[14px] font-black text-white transition-colors duration-150 hover:bg-aj-teal-hover"
                    >
                      ✓ Aprovar
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setEditDraft(item.rnNew)}
                      className="flex-1 cursor-pointer rounded-full border-[1.5px] border-aj-border bg-white px-[18px] py-[13px] font-[inherit] text-[14px] font-black text-aj-ink transition-colors duration-150 hover:border-aj-ink"
                    >
                      ✎ Corrigir
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => resolveItem('rej')}
                      className="flex-1 cursor-pointer rounded-full border-[1.5px] border-aj-danger bg-white px-[18px] py-[13px] font-[inherit] text-[14px] font-black text-aj-danger transition-colors duration-150"
                    >
                      ✕ 2ª foto
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex gap-[9px]">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => resolveItem('fix')}
                      className="flex-1 cursor-pointer rounded-full border-none bg-aj-orange px-[18px] py-[13px] font-[inherit] text-[14px] font-black text-white transition-colors duration-150 hover:bg-aj-orange-hover"
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
                disabled={delivered}
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
