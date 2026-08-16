import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clock,
  Loader2,
  Mic,
  Square,
  Trash2,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import LogoTick from "@/components/LogoTick";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────
   Contratar — fluxo invertido (v3):
   1) "Conta a bagunça" — texto ou áudio PRIMEIRO (sem slider,
      sem resumo de plano; query params da landing são ignorados)
   2) "Nossa proposta" — a Ajeita propõe: N agentes + motivo,
      SLA e faixa de preço piso–teto (cartão escuro, estilo do
      cartão de preço da landing)
   3) Decisão — "✓ Aceitar o combinado" (pede nome/empresa/
      WhatsApp só aqui) ou "Quero ajustar" (volta pra descrição)
   Resiliência: backend fora → estruturação local (heurística
   duplicada client-side, mesma fórmula de faixa) e
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
  agentesSugeridos: number;
  skillsDetectadas: number;
  precoPiso: number;
  precoTeto: number;
  motivoPreco: string;
};

type AudioAnexo = {
  dataUrl: string; // base64 (data URL)
  nome: string;
  origem: "gravacao" | "upload";
  duracaoSeg: number | null;
};

type Fase = "contar" | "proposta" | "sucesso";

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
    estruturar: {
      useMutation: () => Mutacao<{ descricao: string; temAudio: boolean; audioBase64?: string | null }, unknown>;
    };
    criar: { useMutation: () => Mutacao<Record<string, unknown>, unknown> };
  };
};

/* ── Heurística local de faixa de preço (mesma do backend) ── */

function extrairVolumeLocal(texto: string): number {
  const m = texto.match(
    /(\d{1,5})\s*(notas?(?:\s+fiscais)?|docs?|documentos?|contratos?|arquivos?|recibos?|boletos?|fotos?|comprovantes?|holerites?|laudos?)/i,
  );
  return m ? parseInt(m[1], 10) : 0;
}

function agentesPorVolume(volume: number): number {
  if (volume <= 0) return 2; // volume não mencionado
  if (volume <= 500) return 1;
  if (volume <= 2000) return 2;
  if (volume <= 5000) return 3;
  if (volume <= 10000) return 4;
  return 5;
}

function motivoFaixa(volume: number, agentes: number, sla: string): string {
  if (volume > 0) {
    const prazoCurto = sla.replace(/^entrega\s+(em\s+|até\s+)?/i, "");
    return `${volume} docs em ${prazoCurto} dão ${agentes} ${
      agentes === 1 ? "agente" : "agentes"
    } tranquilo; se a bagunça for pior que o contado, sobe pro teto`;
  }
  return `sem o volume exato, a gente abre com ${agentes} agentes e uma margem maior — o número fecha na primeira leva`;
}

function calcularPropostaLocal(descricao: string, sla: string, skills: number) {
  const volume = extrairVolumeLocal(descricao);
  const agentes = agentesPorVolume(volume);
  const skillsOk = Math.max(1, skills);
  const urgente =
    /24h.*urgente/i.test(sla) || /\bhoje\b|\burgente\b|\bagora\b|\bpra\s+j[aá]\b/i.test(descricao);
  const piso = BASE + agentes * POR_AGENTE + skillsOk * POR_SKILL;
  const teto = Math.round(piso * (urgente ? 1.75 : volume === 0 ? 1.6 : 1.45));
  return { volume, agentes, skills: skillsOk, piso, teto, motivo: motivoFaixa(volume, agentes, sla) };
}

/* ── Fallback local: heurística simples de estruturação ── */

function push(cond: RegExp, texto: string, desc: string, alvo: string[]) {
  if (cond.test(desc)) alvo.push(texto);
}

function estruturarLocal(descricao: string): Combinado {
  const soAudio =
    descricao.includes("[áudio anexado") &&
    descricao.replace(/\[áudio anexado[^\]]*\]/g, "").trim().length === 0;

  // Áudio sem texto: estrutura genérica aguardando transcrição
  if (soAudio) {
    return {
      escopo: ["Organização documental (a transcrever do áudio)"],
      prazo: "a combinar — aguardando transcrição do áudio",
      sla: "a combinar — aguardando transcrição do áudio",
      comoRecebe: ["a transcrever do áudio"],
      comoValida: ["a transcrever do áudio"],
      foraDeEscopo: ["a transcrever"],
      agentesSugeridos: 2,
      skillsDetectadas: 1,
      precoPiso: 830,
      precoTeto: 1490,
      motivoPreco: "vamos fechar o número exato depois de transcrever seu áudio",
    };
  }

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
  const skillsDetectadas = Math.max(1, escopo.length);
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
  if (/laudo|art\b/.test(d))
    foraDeEscopo.push("Emissão de laudos e ART (só organizamos os que já existem)");

  const urgente = /\bhoje\b|\burgente\b|\bagora\b|\bpra\s+j[aá]\b/.test(d);
  const prazo = urgente ? "Primeira leva organizada em 24h (urgente)" : "Primeira leva organizada em 48h úteis";
  const sla = urgente ? "entrega em 24h (urgente)" : "entrega em 48h";
  const faixa = calcularPropostaLocal(descricao, sla, skillsDetectadas);

  return {
    escopo,
    prazo,
    sla,
    comoRecebe: [
      "Pasta no Drive organizada por obra e por mês, com nome padrão em tudo",
      "Busca direto no WhatsApp: você pergunta e recebe o papel na hora",
    ],
    comoValida: [
      "Primeira leva entra no seu portal para aprovação item a item",
      "Só paga se aprovar — combinado é combinado",
    ],
    foraDeEscopo,
    agentesSugeridos: faixa.agentes,
    skillsDetectadas: faixa.skills,
    precoPiso: faixa.piso,
    precoTeto: faixa.teto,
    motivoPreco: faixa.motivo,
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

function asNum(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

function normalizeCombinado(raw: unknown, descricao: string): Combinado | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const escopo = asStringArray(r.escopo ?? r.escopoEntendido);
  if (escopo.length === 0) return null;
  const local = estruturarLocal(descricao || "placeholder");
  const sla =
    typeof r.sla === "string" && r.sla.trim() ? r.sla : local.sla;
  const skillsBruto = asNum(r.skillsDetectadas) ?? local.skillsDetectadas;
  const faixa = calcularPropostaLocal(descricao, sla, skillsBruto);
  return {
    escopo,
    prazo: typeof r.prazo === "string" && r.prazo.trim() ? r.prazo : local.prazo,
    sla,
    comoRecebe: asStringArray(r.comoRecebe).length
      ? asStringArray(r.comoRecebe)
      : typeof r.entrega === "string" && r.entrega.trim()
        ? [r.entrega]
        : local.comoRecebe,
    comoValida: asStringArray(r.comoValida).length
      ? asStringArray(r.comoValida)
      : typeof r.validacao === "string" && r.validacao.trim()
        ? [r.validacao]
        : local.comoValida,
    foraDeEscopo: asStringArray(r.foraDeEscopo ?? r.naoEntra).length
      ? asStringArray(r.foraDeEscopo ?? r.naoEntra)
      : local.foraDeEscopo,
    agentesSugeridos: asNum(r.agentesSugeridos) ?? faixa.agentes,
    skillsDetectadas: skillsBruto,
    precoPiso: asNum(r.precoPiso) ?? faixa.piso,
    precoTeto: asNum(r.precoTeto) ?? faixa.teto,
    motivoPreco:
      typeof r.motivoPreco === "string" && r.motivoPreco.trim() ? r.motivoPreco : faixa.motivo,
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
  /* Etapa 1 — a bagunça (texto ou áudio) */
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

  /* Etapa 3 — contato (só quando a pessoa vai aceitar) */
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [aceitando, setAceitando] = useState(false);

  /* Fluxo */
  const [fase, setFase] = useState<Fase>("contar");
  const [transcricao, setTranscricao] = useState<string | null>(null);
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
    return descricao.trim();
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
    if (!desc && !audio) {
      setFormErro("Descreva o trabalho ou mande um áudio — a gente propõe o combinado a partir daí.");
      return;
    }
    setFormErro(null);
    estruturarMut.mutate(
      { descricao: desc, temAudio: Boolean(audio), audioBase64: audio?.dataUrl ?? null },
      {
        onSuccess: (raw) => {
          const tr = (raw as { transcricao?: string } | null)?.transcricao;
          if (tr) {
            setTranscricao(tr);
            setDescricao((prev) => (prev.trim() ? prev : tr));
          }
          const c = normalizeCombinado(raw, desc || tr || "");
          if (c) {
            setCombinado(c);
            setUsouFallback(false);
          } else {
            setCombinado(estruturarLocal(desc));
            setUsouFallback(true);
          }
          setAceitando(false);
          setFase("proposta");
        },
        onError: () => {
          setCombinado(estruturarLocal(desc));
          setUsouFallback(true);
          setAceitando(false);
          setFase("proposta");
        },
      },
    );
  }

  async function firmar() {
    if (!combinado) return;
    if (!nome.trim() || !whatsapp.trim()) {
      setFirmarAviso("Preencha seu nome e seu WhatsApp para a gente confirmar o aceite.");
      return;
    }
    setFirmarAviso(null);
    const payload: Record<string, unknown> = {
      nome: nome.trim(),
      empresa: empresa.trim(),
      whatsapp: whatsapp.trim(),
      descricao: montarDescricao(),
      audioBase64: audio?.dataUrl ?? null,
      temAudio: Boolean(audio),
      agentes: combinado.agentesSugeridos,
      skills: combinado.skillsDetectadas,
      precoMensal: combinado.precoPiso,
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
        "Sem conexão com o servidor agora — seu aceite foi salvo localmente. Tente novamente.",
      );
    }
  }

  const agentsLabel = (n: number) => (n === 1 ? "1 agente" : `${n} agentes`);

  /* ── Tela de sucesso ── */
  if (fase === "sucesso" && combinado) {
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
            <h1 className="text-[32px] font-black tracking-[-0.01em]">Proposta aceita!</h1>
            <p className="max-w-[440px] text-[16px] font-bold leading-[1.55] text-aj-muted">
              A Ajeita confirma seu combinado em até 4h úteis no seu WhatsApp.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <span className="rounded-full border border-aj-border bg-aj-cream px-4 py-2 text-[13px] font-extrabold text-aj-ink">
                {agentsLabel(combinado.agentesSugeridos)} sugeridos
              </span>
              <span className="rounded-full border border-aj-orange/30 bg-aj-actbg px-4 py-2 text-[13px] font-extrabold text-aj-orange">
                R$ {fmt(combinado.precoPiso)}–{fmt(combinado.precoTeto)}/mês
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

  /* ── Etapas 1–3 ── */
  return (
    <div className="flex min-h-[100dvh] flex-col bg-aj-cream text-aj-ink">
      <HeaderContratar />

      <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-7 px-6 py-12">
        <AnimatePresence mode="wait">
          {fase === "contar" && (
            <motion.div
              key="contar"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex flex-col gap-7"
            >
              {/* Etapa 1 — Conta a bagunça */}
              <div className="flex flex-col gap-2">
                <h1 className="text-[32px] font-black tracking-[-0.01em] md:text-[38px]">
                  Conta pra gente: tá tudo espalhado como?
                </h1>
                <p className="max-w-[560px] text-[15px] font-bold leading-[1.55] text-aj-muted">
                  Escreve ou manda um áudio do seu jeito. A Ajeita devolve uma proposta fechada:
                  quantos agentes, o prazo e a faixa de preço — você só decide se aceita.
                </p>
              </div>

              <section className="flex flex-col gap-5 rounded-[20px] border border-aj-border bg-white p-6 md:p-7">
                <Campo label="Descreva o trabalho">
                  <textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={6}
                    autoFocus
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
                    estruturarMut.isPending ? "cursor-wait opacity-80" : "hover:bg-aj-orange-hover",
                  )}
                >
                  {estruturarMut.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
                  {estruturarMut.isPending
                    ? audio
                      ? "🎙️ Transcrevendo seu áudio e montando a proposta…"
                      : "Montando a proposta…"
                    : "Ver a proposta da Ajeita →"}
                </motion.button>
              </section>

              {/* Skeleton enquanto estrutura */}
              {estruturarMut.isPending && (
                <div className="flex animate-pulse flex-col gap-4 rounded-[20px] bg-aj-dark p-6 md:p-7">
                  <div className="h-5 w-48 rounded-full bg-white/15" />
                  <div className="h-4 w-full rounded-full bg-white/15" />
                  <div className="h-4 w-5/6 rounded-full bg-white/15" />
                  <div className="h-4 w-4/6 rounded-full bg-white/15" />
                  <div className="mt-2 h-11 w-full rounded-full bg-white/15" />
                </div>
              )}
            </motion.div>
          )}

          {fase === "proposta" && combinado && (
        <>
          {transcricao && (
            <div className="mx-auto w-full max-w-3xl rounded-[14px] border border-aj-teal/40 bg-aj-teal-soft p-4 text-left">
              <div className="text-[11px] font-black uppercase tracking-[.08em] text-[#1B8F6F]">
                🎙️ Ouvimos do seu áudio
              </div>
              <div className="mt-1 text-sm font-bold leading-relaxed text-aj-ink">
                “{transcricao}”
              </div>
            </div>
          )}
        
            <motion.div
              key="proposta"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="flex flex-col gap-7"
            >
              {/* Etapa 2 — Nossa proposta (cartão escuro, estilo do preço da landing) */}
              <div className="flex flex-col gap-2">
                <h1 className="text-[32px] font-black tracking-[-0.01em] md:text-[38px]">
                  Nossa proposta pra sua bagunça
                </h1>
                <p className="max-w-[560px] text-[15px] font-bold leading-[1.55] text-aj-muted">
                  A gente leu o que você contou e montou o combinado. Olha com calma — aceita ou
                  pede ajuste.
                </p>
              </div>

              <section className="flex flex-col gap-5 rounded-[20px] bg-aj-dark p-6 text-aj-cream md:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-aj-sand">
                    Nossa proposta
                  </span>
                  {usouFallback && (
                    <span className="rounded-full border border-aj-cream/25 px-3.5 py-1.5 text-[11.5px] font-black text-aj-sand">
                      estruturação local · nosso time revisa no aceite
                    </span>
                  )}
                </div>

                {/* Faixa de preço piso–teto */}
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-[20px] font-extrabold text-aj-sand">R$</span>
                  <span className="text-[52px] font-black leading-none text-white [font-variant-numeric:tabular-nums]">
                    {fmt(combinado.precoPiso)}
                  </span>
                  <span className="text-[22px] font-black text-aj-sand [font-variant-numeric:tabular-nums]">
                    – R$ {fmt(combinado.precoTeto)}/mês
                  </span>
                </div>
                <p className="text-[13.5px] font-bold leading-[1.5] text-aj-sand">
                  o número exato a gente fecha na primeira leva — se a bagunça for pior que o
                  contado, nunca passa do teto
                </p>

                {/* Agentes sugeridos + motivo */}
                <div className="flex items-start gap-3 rounded-xl border border-aj-cream/15 bg-white/[0.06] px-4 py-3.5">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-aj-teal-light" strokeWidth={2.5} />
                  <div className="flex flex-col gap-1">
                    <span className="text-[15px] font-black text-white">
                      {agentsLabel(combinado.agentesSugeridos)} sugeridos
                    </span>
                    <span className="text-[13px] font-bold leading-[1.5] text-aj-sand">
                      {combinado.motivoPreco}
                    </span>
                  </div>
                </div>

                {/* SLA */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex items-center gap-1.5 rounded-full bg-aj-orange px-4 py-2 text-[13px] font-extrabold text-white">
                    <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {combinado.sla}
                  </span>
                  <span className="rounded-full border border-aj-cream/25 px-4 py-2 text-[13px] font-extrabold text-aj-cream">
                    {combinado.prazo}
                  </span>
                </div>

                {/* Escopo entendido */}
                <div className="flex flex-col gap-2.5 border-t border-aj-cream/15 pt-4">
                  <span className="text-[12px] font-black uppercase tracking-[0.1em] text-aj-sand">
                    Escopo que a gente entendeu
                  </span>
                  <ul className="flex flex-col gap-2">
                    {combinado.escopo.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-aj-teal-light" strokeWidth={3} />
                        <span className="text-[14px] font-bold leading-[1.5] text-aj-cream">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* O que NÃO entra */}
                <div className="flex flex-col gap-2.5 border-t border-aj-cream/15 pt-4">
                  <span className="text-[12px] font-black uppercase tracking-[0.1em] text-aj-sand">
                    O que NÃO entra
                  </span>
                  <ul className="flex flex-col gap-2">
                    {combinado.foraDeEscopo.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-aj-danger/80" strokeWidth={2.5} />
                        <span className="text-[14px] font-bold leading-[1.5] text-aj-sand">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-aj-teal/40 bg-aj-teal/[0.14] px-3.5 py-3 text-[13px] font-extrabold leading-[1.45] text-aj-teal-light">
                  Organização inicial (uma vez): R$ {fmt(SETUP)} · Só paga se aprovar a primeira
                  leva.
                </div>
              </section>

              {/* Etapa 3 — decisão */}
              {!aceitando ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setAceitando(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-aj-orange px-7 py-4 text-[16px] font-black text-white transition-colors duration-150 hover:bg-aj-orange-hover"
                  >
                    ✓ Aceitar o combinado
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setFase("contar")}
                    className="flex items-center justify-center gap-2 rounded-full border-[1.5px] border-aj-border bg-white px-7 py-4 text-[16px] font-black text-aj-ink transition-colors duration-150 hover:border-aj-ink"
                  >
                    Quero ajustar
                  </motion.button>
                </div>
              ) : (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="flex flex-col gap-5 rounded-[20px] border border-aj-border bg-white p-6 md:p-7"
                >
                  <div className="flex flex-col gap-1">
                    <h2 className="text-[20px] font-black">Só falta seu contato</h2>
                    <p className="text-[14px] font-bold text-aj-muted">
                      É por aqui que a gente confirma o aceite e te chama quando começar.
                    </p>
                  </div>
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
                  <Campo
                    label="Seu WhatsApp"
                    hint="É por lá que a gente confirma seu combinado em até 4h úteis."
                  >
                    <input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="(83) 99999-0000"
                      inputMode="tel"
                      className="w-full rounded-xl border border-aj-border bg-aj-page px-4 py-3 text-[15px] font-bold text-aj-ink outline-none transition-colors placeholder:font-bold placeholder:text-aj-faint focus:border-aj-orange"
                    />
                  </Campo>

                  {firmarAviso && (
                    <p className="rounded-xl border border-aj-orange/30 bg-aj-actbg px-4 py-3 text-[13px] font-extrabold text-aj-orange">
                      {firmarAviso}
                    </p>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={firmar}
                      disabled={criarMut.isPending}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-full bg-aj-teal px-7 py-4 text-[16px] font-black text-white transition-colors duration-150",
                        criarMut.isPending ? "cursor-wait opacity-80" : "hover:bg-aj-teal-hover",
                      )}
                    >
                      {criarMut.isPending && <Loader2 className="h-5 w-5 animate-spin" />}
                      {criarMut.isPending ? "Enviando…" : "Confirmar aceite"}
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setAceitando(false)}
                      className="flex items-center justify-center gap-2 rounded-full border-[1.5px] border-aj-border bg-white px-7 py-4 text-[15px] font-black text-aj-ink transition-colors duration-150 hover:border-aj-ink"
                    >
                      Voltar
                    </motion.button>
                  </div>
                  <p className="text-center text-[13px] font-bold text-aj-faint">
                    A Ajeita confirma seu combinado em até 4h úteis. Combinado é combinado.
                  </p>
                </motion.section>
              )}
            </motion.div>
        </>
          )}
        </AnimatePresence>
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
