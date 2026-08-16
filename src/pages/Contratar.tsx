import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock,
  FolderSearch,
  Loader2,
  Mic,
  Square,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import LogoTick from "@/components/LogoTick";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────
   Contratar — /contratar?agentes=N&skills=M&preco=X
   Fluxo do Combinado:
   1) resumo do plano (vem da landing pelos query params)
   2) formulário: nome, empresa, WhatsApp + "Descreva o trabalho"
      (texto) ou "Ou mande um áudio" (gravação MediaRecorder ou
      upload, anexado em base64; transcrição simulada)
   3) "Estruturar meu pedido" → trpc.propostas.estruturar →
      Cartão do Combinado (escopo, prazo/SLA, como recebe, como
      valida, o que NÃO entra)
   4) "Firmar o combinado" → trpc.propostas.criar → sucesso
      "Combinado enviado! A Ajeita analisa e aceita em até 4h úteis."
   Resiliência: backend fora → estruturação local (heurística) e
   "salvo localmente, tente novamente" — a página nunca quebra.
   ──────────────────────────────────────────────────────────── */

const BASE = 230;
const POR_AGENTE = 300;
const POR_SKILL = 160;
const SETUP = 490;
const MAX_AUDIO_MB = 15;

const fmt = (n: number) => n.toLocaleString("pt-BR");

/* ── Tipos ── */

type Combinado = {
  escopo: string[];
  prazo: string;
  sla: string;
  comoRecebe: string[];
  comoValida: string[];
  foraDeEscopo: string[];
};

type AudioAnexo = {
  dataUrl: string; // base64 (data URL)
  nome: string;
  origem: "gravacao" | "upload";
  duracaoSeg: number | null;
};

type Fase = "form" | "combinado" | "sucesso";

/* O router `propostas` é entregue pela branch backend (api/router.ts).
   O cast mantém o type-check verde antes do merge; em runtime o proxy do
   tRPC resolve o caminho e qualquer falha cai no fallback local. */
type Mutacao<I, O> = {
  mutate: (
    input: I,
    opts?: { onSuccess?: (data: O) => void; onError?: () => void },
  ) => void;
  mutateAsync: (input: I) => Promise<O>;
  isPending: boolean;
};
type PropostasApi = {
  propostas: {
    estruturar: { useMutation: () => Mutacao<{ descricao: string }, unknown> };
    criar: { useMutation: () => Mutacao<Record<string, unknown>, unknown> };
  };
};

/* ── Fallback local: heurística simples de estruturação ── */

function push(cond: RegExp, texto: string, desc: string, alvo: string[]) {
  if (cond.test(desc)) alvo.push(texto);
}

function estruturarLocal(descricao: string): Combinado {
  const d = descricao.toLowerCase();
  const escopo: string[] = [];
  push(
    /nota|nf-e?|fiscal/,
    "Notas fiscais lidas, nomeadas e arquivadas por obra/fornecedor e por mês",
    d,
    escopo,
  );
  push(
    /contrato/,
    "Contratos identificados por parte e por obra, com nome padronizado",
    d,
    escopo,
  );
  push(/obra/, "Estrutura de pastas por obra e por mês, do jeito que você pediu", d, escopo);
  push(
    /holerite|folha|funcion[aá]rio|prestador|di[aá]ria|equipe/,
    "Documentos de equipe e prestadores separados, com vencimentos marcados",
    d,
    escopo,
  );
  push(
    /boleto|recibo|comprovante|venda|contador/,
    "Recibos, boletos e comprovantes prontos pro contador todo mês",
    d,
    escopo,
  );
  push(
    /\bano|hist[oó]rico|acumulad/,
    "Acervo histórico (anos acumulados) entra em trilha dedicada, sem travar o dia a dia",
    d,
    escopo,
  );
  if (escopo.length === 0) {
    escopo.push("Cada documento lido, nomeado no padrão combinado e guardado na pasta certa");
    escopo.push("Qualquer papel localizado em segundos, direto pelo WhatsApp");
  } else {
    escopo.push("Busca de qualquer documento em segundos, direto pelo WhatsApp");
  }

  const foraDeEscopo = [
    "Contabilidade e impostos — seguem com seu contador",
    "Assinatura digital e parecer jurídico — seguem com seu advogado",
  ];
  if (/laudo|art\b/.test(d)) foraDeEscopo.push("Emissão de laudos e ART (só organizamos os que já existem)");

  return {
    escopo,
    prazo: "Primeira leva organizada em 48h úteis",
    sla: "Pedidos de busca respondidos em até 2h úteis",
    comoRecebe: [
      "Pasta no Drive organizada por obra e por mês, com nome padrão em tudo",
      "Busca direto no WhatsApp: você pergunta e recebe o papel na hora",
    ],
    comoValida: [
      "Primeira leva entra no seu portal para aprovação item a item",
      "Só paga se aprovar — combinado é combinado",
    ],
    foraDeEscopo,
  };
}

/* ── Normalização defensiva da resposta do backend ── */

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((it) => {
      if (typeof it === "string") return it;
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        return String(o.texto ?? o.item ?? o.descricao ?? "");
      }
      return String(it ?? "");
    })
    .filter((s) => s.trim().length > 0);
}

function normalizeCombinado(raw: unknown): Combinado | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const escopo = asStringArray(r.escopo ?? r.escopoEntendido);
  if (escopo.length === 0) return null;
  const local = estruturarLocal("");
  return {
    escopo,
    prazo: typeof r.prazo === "string" && r.prazo.trim() ? r.prazo : local.prazo,
    sla: typeof r.sla === "string" && r.sla.trim() ? r.sla : local.sla,
    comoRecebe: asStringArray(r.comoRecebe).length ? asStringArray(r.comoRecebe) : (typeof r.entrega === "string" && r.entrega.trim() ? [r.entrega] : local.comoRecebe),
    comoValida: asStringArray(r.comoValida).length ? asStringArray(r.comoValida) : (typeof r.validacao === "string" && r.validacao.trim() ? [r.validacao] : local.comoValida),
    foraDeEscopo: asStringArray(r.foraDeEscopo ?? r.naoEntra).length
      ? asStringArray(r.foraDeEscopo ?? r.naoEntra)
      : local.foraDeEscopo,
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("falha ao ler áudio"));
    reader.readAsDataURL(blob);
  });
}

function formatSeg(seg: number) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const entrada = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" as const, delay },
});

/* ── Página ── */

export default function Contratar() {
  const [params] = useSearchParams();

  /* Resumo do plano vindo da landing */
  const { agentes, skills, preco } = useMemo(() => {
    const a = Math.min(5, Math.max(1, parseInt(params.get("agentes") ?? "", 10) || 2));
    const s = Math.max(1, parseInt(params.get("skills") ?? "", 10) || 1);
    const p = parseInt(params.get("preco") ?? "", 10);
    return {
      agentes: a,
      skills: s,
      preco: Number.isFinite(p) && p > 0 ? p : BASE + a * POR_AGENTE + s * POR_SKILL,
    };
  }, [params]);

  /* Formulário */
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [descricao, setDescricao] = useState("");

  /* Áudio */
  const [audio, setAudio] = useState<AudioAnexo | null>(null);
  const [gravando, setGravando] = useState(false);
  const [segGravados, setSegGravados] = useState(0);
  const [audioErro, setAudioErro] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const inicioRef = useRef(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  /* Fluxo */
  const [fase, setFase] = useState<Fase>("form");
  const [combinado, setCombinado] = useState<Combinado | null>(null);
  const [usouFallback, setUsouFallback] = useState(false);
  const [formErro, setFormErro] = useState<string | null>(null);
  const [firmarAviso, setFirmarAviso] = useState<string | null>(null);

  const estruturarMut = (trpc as unknown as PropostasApi).propostas.estruturar.useMutation();
  const criarMut = (trpc as unknown as PropostasApi).propostas.criar.useMutation();

  /* Limpeza do gravador ao desmontar */
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    };
  }, []);

  const montarDescricao = () => {
    const partes = [descricao.trim()];
    if (audio) partes.push("[áudio anexado pelo cliente — nosso time transcreve e estrutura]");
    return partes.filter(Boolean).join("\n");
  };

  async function iniciarGravacao() {
    setAudioErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const dur = Math.max(1, Math.round((Date.now() - inicioRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        blobToDataUrl(blob)
          .then((dataUrl) =>
            setAudio({
              dataUrl,
              nome: `audio-ajeita-${new Date().toISOString().slice(0, 19)}.webm`,
              origem: "gravacao",
              duracaoSeg: dur,
            }),
          )
          .catch(() => setAudioErro("Não consegui anexar o áudio gravado. Tente de novo."));
      };
      inicioRef.current = Date.now();
      rec.start();
      setSegGravados(0);
      timerRef.current = window.setInterval(() => setSegGravados((s) => s + 1), 1000);
      setGravando(true);
    } catch {
      setAudioErro("Não consegui acessar o microfone. Pode anexar um arquivo de áudio aqui embaixo.");
    }
  }

  function pararGravacao() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setGravando(false);
  }

  function onUploadAudio(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAudioErro(null);
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setAudioErro(`Áudio muito grande (máx. ${MAX_AUDIO_MB} MB). Manda um trecho mais curto.`);
      return;
    }
    blobToDataUrl(file)
      .then((dataUrl) => setAudio({ dataUrl, nome: file.name, origem: "upload", duracaoSeg: null }))
      .catch(() => setAudioErro("Não consegui ler esse arquivo. Tenta outro formato de áudio."));
  }

  function estruturar() {
    const desc = montarDescricao();
    if (!desc) {
      setFormErro("Descreva o trabalho ou mande um áudio — a gente estrutura a partir daí.");
      return;
    }
    setFormErro(null);
    estruturarMut.mutate(
      { descricao: desc, temAudio: Boolean(audio) },
      {
        onSuccess: (raw) => {
          const c = normalizeCombinado(raw);
          if (c) {
            setCombinado(c);
            setUsouFallback(false);
          } else {
            setCombinado(estruturarLocal(desc));
            setUsouFallback(true);
          }
          setFase("combinado");
        },
        onError: () => {
          setCombinado(estruturarLocal(desc));
          setUsouFallback(true);
          setFase("combinado");
        },
      },
    );
  }

  async function firmar() {
    if (!combinado) return;
    if (!nome.trim() || !whatsapp.trim()) {
      setFirmarAviso("Preencha seu nome e seu WhatsApp para a gente te chamar no aceite.");
      return;
    }
    setFirmarAviso(null);
    const payload: Record<string, unknown> = {
      nome: nome.trim(),
      empresa: empresa.trim(),
      whatsapp: whatsapp.trim(),
      descricao: montarDescricao(),
      audioBase64: audio?.dataUrl ?? null,
      agentes,
      skills,
      precoMensal: preco,
      setupInicial: SETUP,
      combinado,
    };
    try {
      await criarMut.mutateAsync(payload);
      setFase("sucesso");
    } catch {
      try {
        localStorage.setItem(
          "ajeita:combinado-pendente",
          JSON.stringify({ ...payload, salvoEm: new Date().toISOString() }),
        );
      } catch {
        /* storage indisponível — segue o aviso */
      }
      setFirmarAviso(
        "Sem conexão com o servidor agora — seu combinado foi salvo localmente. Tente firmar novamente.",
      );
    }
  }

  const agentsLabel = agentes === 1 ? "1 agente" : `${agentes} agentes`;
  const agentsCost = BASE + agentes * POR_AGENTE;
  const skillsCost = skills * POR_SKILL;

  /* ── Tela de sucesso ── */
  if (fase === "sucesso") {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-aj-cream text-aj-ink">
        <HeaderContratar />
        <main className="mx-auto flex w-full max-w-[680px] flex-1 items-center px-6 py-16">
          <motion.div
            {...entrada()}
            className="flex w-full flex-col items-center gap-5 rounded-[24px] border border-aj-border bg-white p-8 text-center md:p-12"
          >
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-aj-teal-soft"
            >
              <Check className="h-8 w-8 text-aj-teal-dark" strokeWidth={3} />
            </motion.span>
            <h1 className="text-[32px] font-black tracking-[-0.01em]">Combinado enviado!</h1>
            <p className="max-w-[440px] text-[16px] font-bold leading-[1.55] text-aj-muted">
              A Ajeita analisa e aceita em até 4h úteis. Te chamamos no WhatsApp.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <span className="rounded-full border border-aj-border bg-aj-cream px-4 py-2 text-[13px] font-extrabold text-aj-ink">
                {agentsLabel} + {skills} {skills === 1 ? "skill" : "skills"}
              </span>
              <span className="rounded-full border border-aj-orange/30 bg-aj-actbg px-4 py-2 text-[13px] font-extrabold text-aj-orange">
                R$ {fmt(preco)}/mês
              </span>
            </div>
            <Link
              to="/"
              className="mt-2 rounded-full bg-aj-orange px-7 py-3.5 text-[15px] font-black text-white transition-colors duration-150 hover:bg-aj-orange-hover"
            >
              Voltar para o início
            </Link>
          </motion.div>
        </main>
      </div>
    );
  }

  /* ── Formulário + Cartão do Combinado ── */
  return (
    <div className="flex min-h-[100dvh] flex-col bg-aj-cream text-aj-ink">
      <HeaderContratar />

      <main className="mx-auto grid w-full max-w-[1060px] flex-1 items-start gap-7 px-6 py-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-7">
          {/* Título */}
          <motion.div {...entrada()} className="flex flex-col gap-2">
            <h1 className="text-[32px] font-black tracking-[-0.01em]">
              Conta pra gente a sua bagunça
            </h1>
            <p className="max-w-[560px] text-[15px] font-bold leading-[1.55] text-aj-muted">
              A gente devolve um combinado fechado: o que entra, o que não entra, prazo e como você
              valida. Sem letra miúda.
            </p>
          </motion.div>

          {/* Formulário */}
          <motion.section
            {...entrada(0.06)}
            className="flex flex-col gap-5 rounded-[20px] border border-aj-border bg-white p-6 md:p-7"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Seu nome">
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Maria do Socorro"
                  className="w-full rounded-xl border border-aj-border bg-aj-page px-4 py-3 text-[15px] font-bold text-aj-ink outline-none transition-colors placeholder:font-bold placeholder:text-aj-faint focus:border-aj-orange"
                />
              </Campo>
              <Campo label="Empresa">
                <input
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Construtora Sol Nascente"
                  className="w-full rounded-xl border border-aj-border bg-aj-page px-4 py-3 text-[15px] font-bold text-aj-ink outline-none transition-colors placeholder:font-bold placeholder:text-aj-faint focus:border-aj-orange"
                />
              </Campo>
            </div>
            <Campo label="Seu WhatsApp" hint="É por lá que a gente te chama quando o combinado for aceito.">
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="(83) 99999-0000"
                inputMode="tel"
                className="w-full rounded-xl border border-aj-border bg-aj-page px-4 py-3 text-[15px] font-bold text-aj-ink outline-none transition-colors placeholder:font-bold placeholder:text-aj-faint focus:border-aj-orange"
              />
            </Campo>

            {/* Descreva o trabalho */}
            <Campo label="Descreva o trabalho">
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={6}
                placeholder="Ex.: tenho 3 anos de nota fiscal e contrato da obra espalhados, preciso organizado por obra e por mês, queria achar qualquer um em segundos…"
                className="w-full resize-y rounded-xl border border-aj-border bg-aj-page px-4 py-3 text-[15px] font-bold leading-[1.55] text-aj-ink outline-none transition-colors placeholder:font-bold placeholder:text-aj-faint focus:border-aj-orange"
              />
            </Campo>

            {/* Ou mande um áudio */}
            <div className="flex flex-col gap-3">
              <span className="text-[13px] font-black uppercase tracking-[0.08em] text-aj-faint">
                Ou mande um áudio
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {!gravando ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={iniciarGravacao}
                    className="flex items-center gap-2 rounded-full border-[1.5px] border-aj-border bg-white px-5 py-3 text-[14px] font-black text-aj-ink transition-colors duration-150 hover:border-aj-ink"
                  >
                    <Mic className="h-4 w-4 text-aj-orange" strokeWidth={2.5} />
                    Gravar áudio
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={pararGravacao}
                    className="flex items-center gap-2 rounded-full bg-aj-danger px-5 py-3 text-[14px] font-black text-white"
                  >
                    <Square className="h-4 w-4" strokeWidth={2.5} />
                    Parar · {formatSeg(segGravados)}
                  </motion.button>
                )}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 rounded-full border-[1.5px] border-aj-border bg-white px-5 py-3 text-[14px] font-black text-aj-ink transition-colors duration-150 hover:border-aj-ink"
                >
                  <Upload className="h-4 w-4 text-aj-teal-dark" strokeWidth={2.5} />
                  Anexar arquivo de áudio
                </motion.button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*"
                  onChange={onUploadAudio}
                  className="hidden"
                  aria-label="Anexar arquivo de áudio"
                />
              </div>

              {gravando && (
                <div className="flex items-center gap-2.5 text-[13px] font-extrabold text-aj-danger">
                  <span className="h-2.5 w-2.5 animate-pulse-ring rounded-full bg-aj-danger" />
                  Gravando… fala à vontade, conta a bagunça do seu jeito.
                </div>
              )}

              {audio && !gravando && (
                <div className="flex items-center gap-3 rounded-xl border border-aj-teal/40 bg-aj-teal-soft px-4 py-3">
                  <Check className="h-5 w-5 shrink-0 text-aj-teal-dark" strokeWidth={3} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-extrabold text-aj-teal-dark">
                      {audio.origem === "gravacao" ? "Áudio gravado" : audio.nome}
                      {audio.duracaoSeg ? ` · ${formatSeg(audio.duracaoSeg)}` : ""}
                    </span>
                    <span className="text-[12px] font-bold text-aj-muted">
                      áudio recebido — nosso time transcreve e estrutura
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAudio(null)}
                    aria-label="Remover áudio"
                    className="rounded-full p-1.5 text-aj-muted transition-colors hover:bg-white hover:text-aj-danger"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              )}

              {audioErro && (
                <p className="rounded-xl bg-aj-danger-soft px-4 py-3 text-[13px] font-extrabold text-aj-danger">
                  {audioErro}
                </p>
              )}
            </div>

            {formErro && (
              <p className="rounded-xl bg-aj-danger-soft px-4 py-3 text-[13px] font-extrabold text-aj-danger">
                {formErro}
              </p>
            )}

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={estruturar}
              disabled={estruturarMut.isPending}
              className={cn(
                "flex items-center justify-center gap-2 rounded-full bg-aj-orange px-7 py-4 text-[16px] font-black text-white transition-colors duration-150",
                estruturarMut.isPending
                  ? "cursor-wait opacity-80"
                  : "hover:bg-aj-orange-hover",
              )}
            >
              {estruturarMut.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
              {estruturarMut.isPending ? "Estruturando seu pedido…" : "Estruturar meu pedido"}
            </motion.button>
          </motion.section>

          {/* Skeleton enquanto estrutura */}
          {estruturarMut.isPending && (
            <div className="flex animate-pulse flex-col gap-4 rounded-[20px] border border-aj-border bg-white p-6 md:p-7">
              <div className="h-5 w-48 rounded-full bg-aj-rail" />
              <div className="h-4 w-full rounded-full bg-aj-rail" />
              <div className="h-4 w-5/6 rounded-full bg-aj-rail" />
              <div className="h-4 w-4/6 rounded-full bg-aj-rail" />
              <div className="mt-2 h-11 w-full rounded-full bg-aj-rail" />
            </div>
          )}

          {/* Cartão do Combinado */}
          <AnimatePresence>
            {fase === "combinado" && combinado && !estruturarMut.isPending && (
              <motion.section
                key="combinado"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-col gap-5 rounded-[20px] border border-aj-border bg-white p-6 md:p-7"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-[20px] font-black">O Combinado</h2>
                  <span className="rounded-full bg-aj-actbg px-3.5 py-1.5 text-[11.5px] font-black text-aj-orange">
                    proposta de escopo
                  </span>
                  {usouFallback && (
                    <span className="rounded-full border border-aj-border bg-white px-3.5 py-1.5 text-[11.5px] font-black text-aj-muted">
                      estruturação local · nosso time revisa no aceite
                    </span>
                  )}
                </div>

                <BlocoCombinado
                  titulo="Escopo que a gente entendeu"
                  icon={<Check className="h-4 w-4 text-aj-teal-dark" strokeWidth={3} />}
                >
                  <ul className="flex flex-col gap-2">
                    {combinado.escopo.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-aj-teal"
                          strokeWidth={3}
                        />
                        <span className="text-[14px] font-bold leading-[1.5] text-aj-ink">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </BlocoCombinado>

                <BlocoCombinado
                  titulo="Prazo e SLA propostos"
                  icon={<Clock className="h-4 w-4 text-aj-orange" strokeWidth={2.5} />}
                >
                  <div className="flex flex-wrap gap-2.5">
                    <span className="rounded-full bg-aj-actbg px-4 py-2 text-[13px] font-extrabold text-aj-orange">
                      {combinado.prazo}
                    </span>
                    <span className="rounded-full border border-aj-border bg-aj-cream px-4 py-2 text-[13px] font-extrabold text-aj-ink">
                      {combinado.sla}
                    </span>
                  </div>
                </BlocoCombinado>

                <div className="grid gap-5 sm:grid-cols-2">
                  <BlocoCombinado
                    titulo="Como você recebe"
                    icon={
                      <FolderSearch className="h-4 w-4 text-aj-orange" strokeWidth={2.5} />
                    }
                  >
                    <ul className="flex flex-col gap-2">
                      {combinado.comoRecebe.map((item) => (
                        <li key={item} className="text-[14px] font-bold leading-[1.5] text-aj-muted">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </BlocoCombinado>
                  <BlocoCombinado
                    titulo="Como você valida"
                    icon={<BadgeCheck className="h-4 w-4 text-aj-teal-dark" strokeWidth={2.5} />}
                  >
                    <ul className="flex flex-col gap-2">
                      {combinado.comoValida.map((item) => (
                        <li key={item} className="text-[14px] font-bold leading-[1.5] text-aj-muted">
                          · {item}
                        </li>
                      ))}
                    </ul>
                  </BlocoCombinado>
                </div>

                <BlocoCombinado
                  titulo="O que NÃO entra"
                  icon={<XCircle className="h-4 w-4 text-aj-danger" strokeWidth={2.5} />}
                >
                  <ul className="flex flex-col gap-2">
                    {combinado.foraDeEscopo.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-aj-danger/70" strokeWidth={2.5} />
                        <span className="text-[14px] font-bold leading-[1.5] text-aj-muted">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </BlocoCombinado>

                {firmarAviso && (
                  <p className="rounded-xl border border-aj-orange/30 bg-aj-actbg px-4 py-3 text-[13px] font-extrabold text-aj-orange">
                    {firmarAviso}
                  </p>
                )}

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={firmar}
                  disabled={criarMut.isPending}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-full bg-aj-teal px-7 py-4 text-[16px] font-black text-white transition-colors duration-150",
                    criarMut.isPending ? "cursor-wait opacity-80" : "hover:bg-aj-teal-hover",
                  )}
                >
                  {criarMut.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
                  {criarMut.isPending ? "Firmando…" : "Firmar o combinado"}
                </motion.button>
                <p className="text-center text-[13px] font-bold text-aj-faint">
                  A Ajeita analisa e aceita em até 4h úteis. Combinado é combinado.
                </p>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Resumo do plano (cartão escuro) */}
        <motion.aside
          {...entrada(0.12)}
          className="flex flex-col gap-5 self-start rounded-[20px] bg-aj-dark p-6 text-aj-cream md:p-7 lg:sticky lg:top-6"
        >
          <span className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-aj-sand">
            Seu plano
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[20px] font-extrabold text-aj-sand">R$</span>
            <span className="text-[52px] font-black leading-none text-white [font-variant-numeric:tabular-nums]">
              {fmt(preco)}
            </span>
            <span className="text-[16px] font-extrabold text-aj-sand">/mês</span>
          </div>
          <div className="flex flex-col gap-2 border-t border-aj-cream/15 pt-4 text-[14px] font-bold text-aj-border">
            <div className="flex justify-between gap-3">
              <span>{agentsLabel} + coordenação</span>
              <span className="[font-variant-numeric:tabular-nums]">R$ {fmt(agentsCost)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>
                {skills} {skills === 1 ? "skill ativa" : "skills ativas"}
              </span>
              <span className="[font-variant-numeric:tabular-nums]">R$ {fmt(skillsCost)}</span>
            </div>
            <div className="flex justify-between gap-3 text-aj-sand">
              <span>Organização inicial (uma vez)</span>
              <span className="[font-variant-numeric:tabular-nums]">R$ {fmt(SETUP)}</span>
            </div>
          </div>
          <div className="rounded-xl border border-aj-teal/40 bg-aj-teal/[0.14] px-3.5 py-3 text-[13px] font-extrabold leading-[1.45] text-aj-teal-light">
            Primeira leva organizada em 48h. Se não aprovar, não paga nada.
          </div>
          <p className="text-center text-[12px] font-bold text-aj-faint">
            Quer mudar o time?{" "}
            <Link to="/#preco" className="text-aj-teal-light underline">
              Volta e ajusta o preço
            </Link>
            .
          </p>
        </motion.aside>
      </main>
    </div>
  );
}

/* ── Sub-componentes locais ── */

function HeaderContratar() {
  return (
    <header className="border-b border-aj-border bg-aj-cream">
      <div className="mx-auto flex w-full max-w-[1060px] items-center justify-between px-6 py-5">
        <Link to="/" aria-label="Ajeita — página inicial">
          <LogoTick variant="dark" />
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-[13.5px] font-extrabold text-aj-muted transition-colors hover:text-aj-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          voltar
        </Link>
      </div>
    </header>
  );
}

function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-black uppercase tracking-[0.08em] text-aj-faint">
        {label}
      </span>
      {children}
      {hint && <span className="text-[12px] font-bold text-aj-faint">{hint}</span>}
    </label>
  );
}

function BlocoCombinado({
  titulo,
  icon,
  children,
}: {
  titulo: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-aj-feedline pt-4">
      <span className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.1em] text-aj-faint">
        {icon}
        {titulo}
      </span>
      {children}
    </div>
  );
}
