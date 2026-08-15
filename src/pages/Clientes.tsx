import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { trpc } from '@/providers/trpc';
import { cn } from '@/lib/utils';
import { LiveDot, OpsTopbar, Pill, Rise, Skeleton } from '@/components/gestao/bits';
import type { ClienteCard as ClienteCardData, ClienteExtras } from '@/components/gestao/fallback-data';
import {
  CLIENTES_FALLBACK,
  clienteAvatar,
  extrasDoCliente,
  fmtConcordancia,
  fmtThreshold,
} from '@/components/gestao/fallback-data';

/* ---------- tipos + parse seguro dos JSON strings da API ---------- */

type ContextoApi = {
  clienteId: number;
  versao: number;
  namingPattern: string;
  docTypes: string; // JSON array de strings
  taxonomy: string;
  dictionary: string; // JSON array de {termo, significado}
  routingRules: string; // JSON array de strings
  confidenceThreshold: number; // 0-100
  sampleRate: number; // %
  concordancia: number; // milésimos: 972 = 97,2%
};

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type DocTypeChip = { nome: string; count: number | null };
type DictRow = { termo: string; significado: string; origem?: string };
type Rule = { cond: string; acoes: string[] };

/** View-model do painel: API (quando responde) mesclada aos extras editoriais do design. */
type ContextVM = {
  versao: number;
  concordancia: number;
  threshold: number;
  sampleRate: number;
  ativoDesde: string;
  feedbacks: number;
  namingPattern: string | null;
  docTypes: DocTypeChip[];
  foraEscopo: string | null;
  taxonomyTree: string[] | null;
  taxonomyText: string;
  dictionary: DictRow[];
  rules: Rule[];
  example: { from: string; to: string } | null;
  thresholdNote: string;
  sampleNote: string;
  contextoJovem: string | null;
  timeline: ClienteExtras['timeline'];
};

function splitRule(rule: string): Rule {
  const [cond, rest] = rule.split('→').map((p) => p.trim());
  return { cond: cond ?? rule, acoes: (rest ?? '').split('+').map((p) => p.trim()).filter(Boolean) };
}

function countFor(nome: string, counts: Record<string, number>): number | null {
  const n = nome.toLowerCase();
  for (const key of Object.keys(counts)) if (n.includes(key)) return counts[key];
  return null;
}

function buildVM(api: ContextoApi | null | undefined, extras: ClienteExtras): ContextVM {
  if (!api) {
    return {
      versao: extras.versao,
      concordancia: extras.concordancia,
      threshold: extras.threshold,
      sampleRate: extras.sampleRate,
      ativoDesde: extras.ativoDesde,
      feedbacks: extras.feedbacks,
      namingPattern: extras.namingPattern,
      docTypes: extras.docTypes.map((nome) => ({ nome, count: countFor(nome, extras.docCounts) })),
      foraEscopo: extras.foraEscopo,
      taxonomyTree: extras.taxonomyTree,
      taxonomyText: extras.taxonomyText,
      dictionary: extras.dictionary,
      rules: extras.routingRules.map(splitRule),
      example: extras.example,
      thresholdNote: extras.thresholdNote,
      sampleNote: extras.sampleNote,
      contextoJovem: extras.contextoJovem,
      timeline: extras.timeline,
    };
  }
  const apiDocs = parseJson<string[]>(api.docTypes, []);
  const apiDict = parseJson<{ termo: string; significado: string }[]>(api.dictionary, []);
  const apiRules = parseJson<string[]>(api.routingRules, []);
  return {
    versao: api.versao,
    concordancia: api.concordancia,
    threshold: api.confidenceThreshold,
    sampleRate: api.sampleRate,
    ativoDesde: extras.ativoDesde,
    feedbacks: extras.feedbacks,
    namingPattern: api.namingPattern || extras.namingPattern,
    docTypes: (apiDocs.length ? apiDocs : extras.docTypes).map((nome) => ({
      nome,
      count: countFor(nome, extras.docCounts),
    })),
    foraEscopo: extras.foraEscopo,
    taxonomyTree: extras.taxonomyTree,
    taxonomyText: api.taxonomy || extras.taxonomyText,
    dictionary: (apiDict.length ? apiDict : extras.dictionary).map((d) => {
      const origem = extras.dictionary.find(
        (e) =>
          e.termo.toLowerCase().includes(d.termo.toLowerCase()) ||
          d.termo.toLowerCase().includes(e.termo.toLowerCase()),
      )?.origem;
      return { ...d, origem };
    }),
    rules: (apiRules.length ? apiRules : extras.routingRules).map(splitRule),
    example: extras.example,
    thresholdNote: extras.thresholdNote,
    sampleNote: extras.sampleNote,
    contextoJovem: api.sampleRate >= 10 ? extras.contextoJovem ?? 'contexto jovem — amostra 10%' : extras.contextoJovem,
    timeline: extras.timeline,
  };
}

/* ---------- acordeão (altura animada .3s, chevron gira 180°) ---------- */

function Accordion({
  title,
  tag,
  defaultOpen = false,
  children,
}: {
  title: string;
  tag?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-[16px] border border-aj-border bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-[10px] px-[20px] py-[15px] text-left"
      >
        <span className="text-[14.5px] font-black">{title}</span>
        {tag && (
          <span className="rounded-full border border-aj-border bg-aj-cream px-[10px] py-[3px] text-[11px] font-black text-aj-muted">
            {tag}
          </span>
        )}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="ml-auto text-[13px] font-black text-aj-faint"
        >
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-aj-feedline px-[20px] pb-[18px] pt-[14px]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- gauge de concordância (anel SVG 56px, arco desenha 0→pct) ---------- */

function Gauge({ pct }: { pct: number }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-[12px]">
      <div className="relative h-[56px] w-[56px] shrink-0">
        <svg width={56} height={56} viewBox="0 0 56 56">
          <circle cx={28} cy={28} r={r} fill="none" stroke="#F1E8D8" strokeWidth={6} />
          <motion.circle
            key={pct}
            cx={28}
            cy={28}
            r={r}
            fill="none"
            stroke="#2FC79E"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, pct))) }}
            transition={{ duration: 1, ease: 'easeOut' }}
            transform="rotate(-90 28 28)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[15px] font-black [font-variant-numeric:tabular-nums]">
          {(pct * 100).toFixed(1).replace('.', ',')}
        </span>
      </div>
      <span className="max-w-[110px] text-[11px] font-extrabold leading-[1.35] text-aj-faint">
        concordância IA↔humano
      </span>
    </div>
  );
}

/* ---------- card de cliente (coluna esquerda) ---------- */

function ClienteCard({
  cliente,
  selected,
  loteAtivo,
  compact = false,
  onClick,
}: {
  cliente: ClienteCardData;
  selected: boolean;
  loteAtivo: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const extras = extrasDoCliente(cliente.id, cliente.nome);
  const ctxQ = trpc.clientes.contexto.useQuery({ clienteId: cliente.id }, { retry: 1, staleTime: 30_000 });
  const ctx = !ctxQ.isError && ctxQ.data ? (ctxQ.data as ContextoApi) : null;
  const versao = ctx?.versao ?? extras.versao;
  const concord = ctx?.concordancia ?? extras.concordancia;
  const jovem = (ctx?.sampleRate ?? extras.sampleRate) >= 10;

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-[16px] border bg-white px-[16px] py-[15px] text-left transition-[border-color,box-shadow,background-color] duration-[.25s]',
        selected
          ? 'border-aj-orange bg-aj-page [box-shadow:0_0_0_4px_rgba(245,130,13,.07)]'
          : 'border-aj-border hover:border-aj-faint',
        compact ? 'w-[240px] shrink-0' : 'w-full',
      )}
    >
      <div className="flex items-center gap-[11px]">
        <span
          className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px] text-[14px] font-black"
          style={{ backgroundColor: cliente.avatarBg, color: cliente.avatarFg }}
        >
          {cliente.iniciais}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-black">{cliente.nome}</div>
          <div className="truncate text-[12px] font-extrabold text-aj-faint">
            {cliente.segmento} · {cliente.cidade}
          </div>
        </div>
      </div>
      <div className="mt-[11px] flex flex-wrap items-center gap-[7px]">
        <span className="rounded-full border border-aj-border bg-white px-[10px] py-[3px] text-[11px] font-black text-aj-muted">
          contexto v{versao}
        </span>
        <span className="text-[11.5px] font-extrabold text-aj-teal-dark [font-variant-numeric:tabular-nums]">
          concordância {fmtConcordancia(concord)}
        </span>
        {loteAtivo && (
          <span className="inline-flex items-center gap-[5px] rounded-full border border-[rgba(47,199,158,.4)] bg-aj-teal-soft px-[9px] py-[3px] text-[10px] font-black text-aj-teal-dark">
            <LiveDot className="h-[7px] w-[7px]" />
            lote em trabalho
          </span>
        )}
      </div>
      {jovem && (
        <div className="mt-[8px] text-[11.5px] font-extrabold text-aj-orange">
          contexto jovem — amostra {ctx?.sampleRate ?? extras.sampleRate}%
        </div>
      )}
    </motion.button>
  );
}

/* ---------- tokens do padrão de nomeação ---------- */

function NamingTokens({ pattern }: { pattern: string }) {
  const suffix = pattern.endsWith('.pdf') ? '.pdf' : null;
  const core = suffix ? pattern.slice(0, -4) : pattern;
  const parts = core.split('-');
  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      {parts.map((p, i) => {
        const variable = p.startsWith('{');
        return (
          <span key={i} className="flex items-center gap-[6px]">
            {i > 0 && <span className="text-[12px] font-black text-aj-faint">·</span>}
            <span
              className={cn(
                'rounded-full px-[11px] py-[5px] text-[12px] font-black',
                variable
                  ? 'border border-[rgba(47,199,158,.4)] bg-aj-teal-soft text-aj-teal-dark'
                  : 'border border-aj-border bg-aj-cream text-aj-muted',
              )}
            >
              {p}
            </span>
          </span>
        );
      })}
      {suffix && (
        <span className="flex items-center gap-[6px]">
          <span className="text-[12px] font-black text-aj-faint">+</span>
          <span className="rounded-full border border-aj-border bg-aj-cream px-[11px] py-[5px] text-[12px] font-black text-aj-muted">
            {suffix}
          </span>
        </span>
      )}
    </div>
  );
}

/* ---------- slider visual do threshold ---------- */

function ThresholdSlider({ value }: { value: number }) {
  return (
    <div className="relative mt-[14px]">
      <div className="h-[8px] rounded-full bg-aj-rail" />
      <motion.div
        key={value}
        className="absolute top-[-4px] h-[16px] w-[16px] rounded-full border-[3px] border-white bg-aj-orange [box-shadow:0_1px_4px_rgba(46,39,33,.25)]"
        initial={{ left: '95%' }}
        animate={{ left: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ marginLeft: -8 }}
      />
      <div className="mt-[7px] flex justify-between text-[10.5px] font-extrabold text-aj-faint [font-variant-numeric:tabular-nums]">
        <span>0,75</span>
        <span>0,90</span>
        <span>0,95</span>
      </div>
    </div>
  );
}

/* ---------- painel ContextProfile ---------- */

function ContextPanel({ cliente, vm }: { cliente: ClienteCardData; vm: ContextVM }) {
  const ativoDesde = vm.ativoDesde;
  return (
    <div className="flex min-w-0 flex-col gap-[14px]">
      {/* header do painel */}
      <div className="flex flex-wrap items-center gap-[14px] rounded-[18px] border border-aj-border bg-white px-[22px] py-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-[9px]">
            <h2 className="text-[17px] font-black">ContextProfile — {cliente.nome}</h2>
            <Pill tone="orange" className="px-[11px] py-[4px] text-[11.5px]">
              v{vm.versao}
            </Pill>
            <Pill tone="green" className="px-[11px] py-[4px] text-[11.5px]">
              ativo desde {ativoDesde}
            </Pill>
          </div>
          <p className="mt-[6px] text-[12.5px] font-bold text-aj-muted">
            {vm.docTypes.length} tipos de doc · {vm.dictionary.length} termos no dicionário ·{' '}
            {vm.rules.length} regras de roteamento · {vm.feedbacks} feedbacks viraram regra
          </p>
        </div>
        <div className="ml-auto">
          <Gauge pct={vm.concordancia / 1000} />
        </div>
      </div>

      {/* 1. padrão de nomeação */}
      <Accordion title="Padrão de nomeação" tag="naming_pattern" defaultOpen>
        {vm.namingPattern ? (
          <>
            <NamingTokens pattern={vm.namingPattern} />
            {vm.example && (
              <div className="mt-[12px] flex flex-wrap items-center gap-[10px] rounded-[11px] bg-aj-cream px-[14px] py-[11px]">
                <span className="text-[12.5px] font-extrabold text-aj-muted">{vm.example.from}</span>
                <span className="text-[14px] font-black text-aj-faint">↓</span>
                <span className="text-[12.5px] font-black text-aj-ink">{vm.example.to}</span>
              </div>
            )}
            <p className="mt-[10px] text-[11.5px] font-bold text-aj-faint">
              conflitos e ambiguidades baixam a confiança do item.
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-[8px]">
            <span className="rounded-full border border-dashed border-aj-border bg-aj-chipout px-[12px] py-[6px] text-[12px] font-extrabold text-aj-faint">
              padrão em construção — os primeiros lotes ainda estão alimentando o contexto
            </span>
          </div>
        )}
      </Accordion>

      {/* 2. tipos de documento */}
      <Accordion title="Tipos de documento" tag={`${vm.docTypes.length} mapeados`} defaultOpen>
        <div className="flex flex-wrap gap-[7px]">
          {vm.docTypes.map((d) => (
            <span
              key={d.nome}
              className="rounded-full border border-[rgba(47,199,158,.4)] bg-aj-teal-soft px-[12px] py-[6px] text-[12px] font-extrabold text-aj-teal-dark"
            >
              {d.nome}
              {d.count != null && <b className="ml-[5px] [font-variant-numeric:tabular-nums]">· {d.count}</b>}
            </span>
          ))}
          {vm.foraEscopo && (
            <span className="rounded-full border border-dashed border-aj-border bg-aj-chipout px-[12px] py-[6px] text-[12px] font-extrabold text-aj-faint">
              {vm.foraEscopo}
            </span>
          )}
        </div>
      </Accordion>

      {/* 3. taxonomia */}
      <Accordion title="Taxonomia de pastas" tag="taxonomy">
        <div className="rounded-[11px] bg-aj-cream px-[16px] py-[13px]">
          {vm.taxonomyTree ? (
            vm.taxonomyTree.map((line, i) => (
              <div
                key={i}
                className="whitespace-pre text-[12.5px] font-extrabold leading-[1.75] text-aj-ink"
              >
                {line}
              </div>
            ))
          ) : (
            <div className="text-[12.5px] font-extrabold leading-[1.6] text-aj-ink">{vm.taxonomyText}</div>
          )}
        </div>
      </Accordion>

      {/* 4. dicionário */}
      <Accordion title="Dicionário" tag={`${vm.dictionary.length} termos`}>
        {vm.dictionary.length === 0 ? (
          <p className="text-[12.5px] font-bold text-aj-faint">
            dicionário ainda vazio — os apelidos do cliente entram aqui a cada validação.
          </p>
        ) : (
          <div>
            {vm.dictionary.map((d, i) => (
              <div
                key={d.termo}
                className={cn(
                  'flex flex-wrap items-baseline gap-[8px] py-[9px]',
                  i > 0 && 'border-t border-aj-feedline',
                )}
              >
                <span className="text-[13px] font-extrabold text-aj-muted">“{d.termo}”</span>
                <span className="text-[12px] font-black text-aj-faint">→</span>
                <span className="text-[13px] font-black text-aj-ink">{d.significado}</span>
                {d.origem && (
                  <span className="ml-auto text-[11px] font-bold text-aj-faint">{d.origem}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Accordion>

      {/* 5. regras de roteamento */}
      <Accordion title="Regras de roteamento" tag={`${vm.rules.length} ativas`}>
        <div className="flex flex-col gap-[9px]">
          {vm.rules.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-[7px]">
              <span className="rounded-full border border-aj-border bg-aj-cream px-[11px] py-[5px] text-[12px] font-extrabold text-aj-muted">
                {r.cond}
              </span>
              <span className="text-[13px] font-black text-aj-faint">→</span>
              {r.acoes.map((a, j) => (
                <span key={j} className="flex items-center gap-[7px]">
                  {j > 0 && <span className="text-[12px] font-black text-aj-faint">+</span>}
                  <span className="rounded-full border border-[rgba(47,199,158,.4)] bg-aj-teal-soft px-[11px] py-[5px] text-[12px] font-extrabold text-aj-teal-dark">
                    {a}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </Accordion>

      {/* 6. política de confiança */}
      <Accordion title="Política de confiança" tag="confidence_policy">
        <div className="grid grid-cols-1 gap-[14px] min-[900px]:grid-cols-2">
          <div className="rounded-[13px] border border-aj-border bg-white px-[16px] py-[14px]">
            <div className="text-[11px] font-black uppercase tracking-[.1em] text-aj-faint">
              Threshold de auto-aprovação
            </div>
            <div className="mt-[6px] text-[26px] font-black leading-none [font-variant-numeric:tabular-nums]">
              {fmtThreshold(vm.threshold)}
            </div>
            <ThresholdSlider value={vm.threshold} />
            <p className="mt-[8px] text-[11.5px] font-bold text-aj-faint">{vm.thresholdNote}</p>
          </div>
          <div className="rounded-[13px] border border-aj-border bg-white px-[16px] py-[14px]">
            <div className="text-[11px] font-black uppercase tracking-[.1em] text-aj-faint">
              Amostra humana (sample_rate)
            </div>
            <div className="mt-[6px] text-[26px] font-black leading-none [font-variant-numeric:tabular-nums]">
              {vm.sampleRate}%
            </div>
            <div className="mt-[14px] h-[8px] overflow-hidden rounded-full bg-aj-rail">
              <motion.i
                key={vm.sampleRate}
                className="block h-full rounded-full bg-[linear-gradient(90deg,#2FC79E,#F5820D)]"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min(100, vm.sampleRate * 5)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <p className="mt-[8px] text-[11.5px] font-bold text-aj-faint">{vm.sampleNote}</p>
          </div>
        </div>
        <div className="mt-[12px] rounded-[12px] border border-[rgba(47,199,158,.4)] bg-aj-teal-soft px-[14px] py-[10px] text-[12.5px] font-extrabold text-aj-teal-dark">
          concordância {fmtConcordancia(vm.concordancia)} nos últimos 30 dias — threshold mantido
          {vm.contextoJovem ? ` · ${vm.contextoJovem}` : ''}
        </div>
      </Accordion>

      {/* 7. feedback que vira regra */}
      <Accordion title="Feedback que vira regra" tag="histórico de versões">
        <div className="relative ml-[5px] flex flex-col gap-[14px] border-l-2 border-aj-border pl-[18px]">
          {vm.timeline.map((t, i) => (
            <motion.div
              key={t.versao}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: 'easeOut' }}
              className="relative"
            >
              <span
                className={cn(
                  'absolute left-[-25px] top-[4px] h-[10px] w-[10px] rounded-full bg-aj-teal',
                  t.atual && 'animate-pulse-ring',
                )}
              />
              <div className="flex flex-wrap items-center gap-[8px]">
                <b className="text-[13px] font-black text-aj-ink">{t.versao}</b>
                <span className="text-[11px] font-extrabold text-aj-faint [font-variant-numeric:tabular-nums]">
                  {t.data}
                </span>
                {t.atual && (
                  <Pill tone="orange" className="px-[9px] py-[2px] text-[10px]">
                    atual
                  </Pill>
                )}
              </div>
              <p className="mt-[2px] text-[13px] font-bold leading-[1.45] text-aj-muted">{t.texto}</p>
            </motion.div>
          ))}
        </div>
      </Accordion>
    </div>
  );
}

/* ---------- página: Clientes e contexto ---------- */

export default function Clientes() {
  const clientesQ = trpc.clientes.list.useQuery(undefined, { retry: 1, staleTime: 30_000 });
  const lotesQ = trpc.lotes.list.useQuery(undefined, { retry: 1, staleTime: 30_000 });

  const [selId, setSelId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const clientes: ClienteCardData[] = useMemo(() => {
    if (!clientesQ.isError && clientesQ.data && clientesQ.data.length) {
      return clientesQ.data.map((c) => {
        const av = clienteAvatar(c.nome);
        return {
          id: c.id,
          nome: c.nome,
          cidade: c.cidade,
          segmento: c.segmento,
          iniciais: av.iniciais,
          avatarBg: av.bg,
          avatarFg: av.fg,
        };
      });
    }
    return CLIENTES_FALLBACK;
  }, [clientesQ.data, clientesQ.isError]);

  // clientes com lote em trabalho (dados reais; fallback: Sol Nascente)
  const ativos = useMemo(() => {
    const set = new Set<string>();
    if (!lotesQ.isError && lotesQ.data) {
      for (const l of lotesQ.data) {
        if (['recebido', 'processando', 'em_validacao', 'pronto_entrega'].includes(l.status))
          set.add(l.clienteNome);
      }
    } else {
      set.add('Construtora Sol Nascente');
    }
    return set;
  }, [lotesQ.data, lotesQ.isError]);

  const q = search.trim().toLowerCase();
  const visiveis = q
    ? clientes.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          c.cidade.toLowerCase().includes(q) ||
          c.segmento.toLowerCase().includes(q),
      )
    : clientes;

  const sel =
    clientes.find((c) => c.id === selId) ??
    clientes.find((c) => c.nome.toLowerCase().includes('sol nascente')) ??
    clientes[0];

  const extras = sel ? extrasDoCliente(sel.id, sel.nome) : null;

  return (
    <div className="flex min-w-0 flex-col gap-[18px] px-[30px] pb-[60px] pt-6">
      <OpsTopbar
        placeholder="Buscar cliente, cidade, segmento…"
        search={search}
        onSearch={setSearch}
      />

      {/* TÍTULO */}
      <Rise delay={0.05} y={12}>
        <h1 className="text-[26px] font-black tracking-[-0.02em]">Clientes e contexto</h1>
        <p className="mt-[2px] text-[13.5px] font-extrabold text-aj-muted">
          o contexto é o ativo — cada correção vira regra e o lote seguinte sai mais barato
        </p>
      </Rise>

      <div className="grid grid-cols-1 items-start gap-[18px] min-[1151px]:grid-cols-[340px_1fr]">
        {/* COLUNA ESQUERDA — lista (trilho horizontal no mobile) */}
        <Rise delay={0.12} y={14} className="min-w-0">
          {clientesQ.isLoading ? (
            <div className="flex flex-col gap-[12px]">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[104px] rounded-[16px]" />
              ))}
            </div>
          ) : (
            <>
              {/* desktop: lista vertical */}
              <div className="hidden flex-col gap-[12px] min-[1151px]:flex">
                {visiveis.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.35, ease: 'easeOut' }}
                  >
                    <ClienteCard
                      cliente={c}
                      selected={sel?.id === c.id}
                      loteAtivo={ativos.has(c.nome)}
                      onClick={() => setSelId(c.id)}
                    />
                  </motion.div>
                ))}
                {visiveis.length === 0 && (
                  <p className="px-2 py-6 text-center text-[13px] font-bold text-aj-faint">
                    Nenhum cliente com esse filtro.
                  </p>
                )}
                {/* novo cliente */}
                <div className="rounded-[16px] border border-dashed border-aj-border bg-transparent p-[10px]">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setToast(true)}
                    className="w-full cursor-pointer rounded-[11px] border-[1.5px] border-aj-border bg-white px-[16px] py-[11px] text-[12.5px] font-black text-aj-muted transition-colors hover:border-aj-ink hover:text-aj-ink"
                  >
                    + Novo cliente — setup R$ 490 · 2–4h de mapeamento
                  </motion.button>
                </div>
              </div>

              {/* mobile: trilho horizontal */}
              <div className="flex gap-[12px] overflow-x-auto pb-[4px] min-[1151px]:hidden">
                {visiveis.map((c) => (
                  <ClienteCard
                    key={c.id}
                    cliente={c}
                    compact
                    selected={sel?.id === c.id}
                    loteAtivo={ativos.has(c.nome)}
                    onClick={() => setSelId(c.id)}
                  />
                ))}
              </div>
            </>
          )}
        </Rise>

        {/* COLUNA DIREITA — painel ContextProfile */}
        <div className="min-w-0">
          {clientesQ.isLoading || !sel || !extras ? (
            <div className="flex flex-col gap-[14px]">
              <Skeleton className="h-[120px] rounded-[18px]" />
              <Skeleton className="h-[64px] rounded-[16px]" />
              <Skeleton className="h-[64px] rounded-[16px]" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={sel.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <PanelComDados cliente={sel} extras={extras} />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* toast local */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-[26px] left-1/2 z-50 -translate-x-1/2 rounded-full bg-aj-dark px-[22px] py-[12px] text-[13px] font-black text-aj-cream [box-shadow:0_10px_32px_rgba(46,39,33,.3)]"
          >
            Setup de contexto em breve 🛠
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Painel do cliente selecionado — busca o contexto via tRPC com fallback estático. */
function PanelComDados({ cliente, extras }: { cliente: ClienteCardData; extras: ClienteExtras }) {
  const ctxQ = trpc.clientes.contexto.useQuery({ clienteId: cliente.id }, { retry: 1, staleTime: 30_000 });
  const vm = buildVM(!ctxQ.isError ? (ctxQ.data as ContextoApi | null | undefined) : null, extras);
  if (ctxQ.isLoading) {
    return (
      <div className="flex flex-col gap-[14px]">
        <Skeleton className="h-[120px] rounded-[18px]" />
        <Skeleton className="h-[64px] rounded-[16px]" />
        <Skeleton className="h-[64px] rounded-[16px]" />
      </div>
    );
  }
  return <ContextPanel cliente={cliente} vm={vm} />;
}
