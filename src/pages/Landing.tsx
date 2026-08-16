import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import LogoVitrine from "@/components/vitrine/LogoVitrine";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────
   Landing pública — réplica fiel de mockups/landing-original.html
   Hero "A papelada bagunçada entra pelo WhatsApp. Sai tudo ajeitado.",
   como funciona em 3 passos, preço com slider de agentes (1–5) +
   skills, nichos e footer escuro. Copy verbatim do mockup.

   Fórmula de preço (mesma do mockup):
   mensal = BASE R$230 + R$300/agente + R$160/skill · setup R$490
   ──────────────────────────────────────────────────────────── */

const BASE = 230;
const POR_AGENTE = 300;
const POR_SKILL = 160;
const SETUP = 490;

const WHATSAPP_URL =
  "https://wa.me/5500000000000?text=Oi%20Ajeita!%20Quero%20ajeitar%20minha%20papelada.";

const SKILLS = [
  {
    id: "caixa",
    name: "Caixa de documentos",
    desc: "A bagunça acumulada vira arquivo organizado e buscável",
  },
  {
    id: "solicitacao",
    name: "Solicitação de documentos",
    desc: "Alguém pede um papel, a gente responde com ele na hora",
  },
  {
    id: "venda",
    name: "Documentos de venda",
    desc: "Nota, recibo e comprovante prontos pro contador",
  },
  {
    id: "pessoas",
    name: "Documentos de pessoas",
    desc: "Equipe, diária e prestador — nada vencido, nada perdido",
  },
  {
    id: "obra",
    name: "Documentos de obra",
    desc: "Cada nota e medição na pasta da obra certa",
  },
] as const;

type SkillId = (typeof SKILLS)[number]["id"];

const HINTS: Record<number, string> = {
  1: "Um agente resolve a papelada de um MEI ou negócio pequeno.",
  2: "Dois agentes: bom para comércio ou prestador com movimento diário.",
  3: "Três agentes: imobiliária ou construtora com uma obra tocando.",
  4: "Quatro agentes: mais de uma frente de papel ao mesmo tempo.",
  5: "Cinco agentes: operação cheia — várias obras, lojas ou carteiras.",
};

const PASSOS = [
  {
    n: "1",
    cor: "bg-aj-orange",
    titulo: "Manda a bagunça",
    texto:
      "Pelo WhatsApp mesmo: foto de nota, PDF de contrato, print, pasta inteira do Drive. Do jeito que estiver.",
  },
  {
    n: "2",
    cor: "bg-aj-orange",
    titulo: "Nossos agentes ajeitam",
    texto:
      "Cada documento é lido, nomeado e guardado no lugar certo. A IA faz o volume; uma pessoa da equipe confere o resultado.",
  },
  {
    n: "3",
    cor: "bg-aj-teal",
    titulo: "Ache em 10 segundos",
    texto:
      "\u201CCadê a nota do gesso do apto 302?\u201D — pergunta no WhatsApp e recebe o papel na hora. Qualquer papel, sempre.",
  },
];

const NICHOS = [
  {
    titulo: "Construção e obra",
    texto: "Notas de material, medições, ART, diário de obra — por obra e por fornecedor.",
  },
  {
    titulo: "Imobiliária",
    texto: "Contratos, laudos e documentos de inquilino respondidos sem caçar pasta.",
  },
  {
    titulo: "Comércio de bairro",
    texto: "Nota de fornecedor, boleto e comprovante prontos pro contador todo mês.",
  },
  {
    titulo: "Prestador e rural",
    texto: "Documento de gente, de terra e de máquina — tudo no lugar, nada vencido.",
  },
];

const fmt = (n: number) => n.toLocaleString("pt-BR");

/** Entrada suave padrão da vitrine (fade + subida, sem scroll-trigger pesado). */
const entrada = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.4, ease: "easeOut" as const, delay },
});

export default function Landing() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState(2);
  const [on, setOn] = useState<Record<SkillId, boolean>>({
    caixa: true,
    solicitacao: false,
    venda: true,
    pessoas: false,
    obra: false,
  });

  const nSk = SKILLS.filter((s) => on[s.id]).length;
  const monthly = BASE + agents * POR_AGENTE + Math.max(nSk, 1) * POR_SKILL;
  const agentsCost = BASE + agents * POR_AGENTE;
  const skillsCost = Math.max(nSk, 1) * POR_SKILL;
  const agentsLabel = agents === 1 ? "1 agente" : `${agents} agentes`;

  const toggleSkill = (id: SkillId) => setOn((s) => ({ ...s, [id]: !s[id] }));

  const contarBagunca = () => {
    // Fluxo invertido: o slider é só noção de preço — a proposta sai
    // depois que o cliente conta a bagunça em /contratar.
    navigate("/contratar");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-aj-cream text-aj-ink">
      {/* Slider do mockup — pseudo-elementos de input[type=range] precisam de CSS,
          escopado na classe .vitrine-range para não vazar para o resto do app. */}
      <style>{`
        .vitrine-range{-webkit-appearance:none;appearance:none;width:100%;height:12px;border-radius:6px;background:#EFE4CF;outline:none}
        .vitrine-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:34px;height:34px;border-radius:50%;background:#F5820D;border:4px solid #FBF6EE;box-shadow:0 2px 8px rgba(46,39,33,0.25);cursor:pointer}
        .vitrine-range::-moz-range-thumb{width:34px;height:34px;border-radius:50%;background:#F5820D;border:4px solid #FBF6EE;box-shadow:0 2px 8px rgba(46,39,33,0.25);cursor:pointer}
      `}</style>

      {/* ── Header ── */}
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-6 py-5 md:px-12">
        <a href="/" aria-label="Ajeita — página inicial">
          <LogoVitrine variant="header" />
        </a>
        <motion.a
          whileTap={{ scale: 0.97 }}
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-aj-whatsapp px-[22px] py-3 text-[15px] font-black text-white transition-colors duration-150 hover:bg-[#1FB859]"
        >
          Chamar no WhatsApp
        </motion.a>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto flex w-full max-w-[1100px] flex-col items-start gap-7 px-6 pb-[72px] pt-14 md:px-12">
        <motion.h1
          {...entrada()}
          className="max-w-[760px] text-[40px] font-black leading-[1.08] tracking-[-0.02em] md:text-[56px]"
        >
          A papelada bagunçada entra pelo WhatsApp.
          <br />
          Sai tudo <span className="text-aj-orange">ajeitado</span>
          <span className="text-aj-teal">.</span>
        </motion.h1>
        <motion.p
          {...entrada(0.08)}
          className="max-w-[620px] text-[17px] font-bold leading-[1.5] text-aj-muted md:text-[20px]"
        >
          Você manda a bagunça — foto, PDF, print, o que for. A gente organiza tudo e você acha
          qualquer papel em 10 segundos. Feito com inteligência artificial, garantido por gente de
          verdade.
        </motion.p>
        <motion.div {...entrada(0.16)} className="flex flex-wrap items-center gap-3.5">
          <motion.a
            whileTap={{ scale: 0.97 }}
            href="#preco"
            className="rounded-full bg-aj-orange px-[30px] py-4 text-[17px] font-black text-white transition-colors duration-150 hover:bg-aj-orange-hover"
          >
            Ver meu preço agora
          </motion.a>
          <p className="text-[15px] font-extrabold text-aj-muted">
            Sem reunião. Sem proposta. O preço está aqui embaixo.
          </p>
        </motion.div>
        <motion.div {...entrada(0.24)} className="flex flex-wrap gap-2.5">
          {["Começa em 24 horas", "Só paga se aprovar", "Gente de verdade conferindo"].map(
            (pill) => (
              <span
                key={pill}
                className="rounded-full border border-aj-border bg-white px-4 py-2 text-[14px] font-extrabold text-aj-ink"
              >
                {pill}
              </span>
            ),
          )}
        </motion.div>
      </section>

      {/* ── Como funciona ── */}
      <section className="border-y border-aj-border bg-white">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-6 py-14 md:px-12">
          <motion.h2 {...entrada()} className="text-[32px] font-black tracking-[-0.01em]">
            Como funciona
          </motion.h2>
          <div className="grid gap-8 md:grid-cols-3 md:gap-6">
            {PASSOS.map((p, i) => (
              <motion.div key={p.n} {...entrada(0.08 * i)} className="flex flex-col gap-2.5">
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full text-[20px] font-black text-white",
                    p.cor,
                  )}
                >
                  {p.n}
                </span>
                <h3 className="text-[19px] font-black">{p.titulo}</h3>
                <p className="text-[15px] font-bold leading-[1.55] text-aj-muted">{p.texto}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Preço ── */}
      <section
        id="preco"
        className="mx-auto flex w-full max-w-[1100px] scroll-mt-6 flex-col gap-2 px-6 py-16 md:px-12"
      >
        <motion.h2 {...entrada()} className="text-[32px] font-black tracking-[-0.01em]">
          Monte seu time e veja o preço na hora
        </motion.h2>
        <motion.p {...entrada(0.06)} className="max-w-[640px] text-[17px] font-bold text-aj-muted">
          Arraste para escolher quantos agentes cuidam dos seus papéis e marque o que eles vão
          fazer. Sem letra miúda: o número que aparece é o que você paga.
        </motion.p>

        <div className="mt-7 grid items-stretch gap-7 lg:grid-cols-[1.4fr_1fr]">
          {/* Configurador */}
          <motion.div
            {...entrada(0.1)}
            className="flex flex-col gap-7 rounded-[20px] border border-aj-border bg-white p-6 md:p-8"
          >
            <div className="flex flex-col gap-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[18px] font-black">Quantos agentes no seu time?</h3>
                <span className="whitespace-nowrap text-[15px] font-extrabold text-aj-orange">
                  {agentsLabel}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={agents}
                onChange={(e) => setAgents(parseInt(e.target.value, 10))}
                className="vitrine-range"
                aria-label="Quantidade de agentes no time"
              />
              <div className="flex justify-between text-[13px] font-extrabold text-aj-faint">
                <span>1 agente</span>
                <span>5 agentes</span>
              </div>
              <p className="text-[14px] font-bold leading-[1.5] text-aj-muted">{HINTS[agents]}</p>
            </div>

            <div className="flex flex-col gap-3.5">
              <h3 className="text-[18px] font-black">O que eles vão ajeitar?</h3>
              <div className="flex flex-col gap-2.5">
                {SKILLS.map((sk) => {
                  const active = on[sk.id];
                  return (
                    <motion.button
                      key={sk.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleSkill(sk.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center gap-3.5 rounded-[14px] border-2 px-4 py-3.5 text-left transition-colors duration-150",
                        active
                          ? "border-aj-orange bg-aj-actbg"
                          : "border-aj-border bg-white hover:border-aj-faint",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-[16px] font-black text-white transition-colors duration-150",
                          active ? "bg-aj-teal" : "bg-aj-border",
                        )}
                      >
                        {active ? "✓" : ""}
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-black text-aj-ink">{sk.name}</span>
                        <span className="text-[13px] font-bold text-aj-muted">{sk.desc}</span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Cartão de preço (escuro, sticky) */}
          <motion.div
            {...entrada(0.16)}
            className="flex flex-col gap-5 self-start rounded-[20px] bg-aj-dark p-6 text-aj-cream md:p-8 lg:sticky lg:top-6"
          >
            <span className="text-[14px] font-extrabold uppercase tracking-[0.1em] text-aj-sand">
              Seu preço
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[22px] font-extrabold text-aj-sand">R$</span>
              <span className="text-[64px] font-black leading-none text-white [font-variant-numeric:tabular-nums]">
                {fmt(monthly)}
              </span>
              <span className="text-[18px] font-extrabold text-aj-sand">/mês</span>
            </div>
            <p className="-mt-2 text-[13px] font-bold text-aj-caption">
              estimativa — o preço final sai depois que você conta a bagunça
            </p>
            <div className="flex flex-col gap-2 border-t border-aj-cream/15 pt-4 text-[15px] font-bold text-aj-border">
              <div className="flex justify-between gap-3">
                <span>{agentsLabel} + coordenação</span>
                <span className="[font-variant-numeric:tabular-nums]">R$ {fmt(agentsCost)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>
                  {Math.max(nSk, 1)} {nSk <= 1 ? "skill ativa" : "skills ativas"}
                </span>
                <span className="[font-variant-numeric:tabular-nums]">R$ {fmt(skillsCost)}</span>
              </div>
              <div className="flex justify-between gap-3 text-aj-sand">
                <span>Organização inicial (uma vez)</span>
                <span className="[font-variant-numeric:tabular-nums]">R$ {fmt(SETUP)}</span>
              </div>
            </div>
            <div className="rounded-xl border border-aj-teal/40 bg-aj-teal/[0.14] px-3.5 py-3 text-[14px] font-extrabold leading-[1.45] text-aj-teal-light">
              Primeira leva organizada em 48h. Se não aprovar, não paga nada.
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={contarBagunca}
              className="rounded-full bg-aj-orange px-6 py-4 text-center text-[17px] font-black text-white transition-colors duration-150 hover:bg-aj-orange-hover"
            >
              Contar minha bagunça →
            </motion.button>
            <p className="text-center text-[13px] font-bold text-aj-faint">
              Sem contrato de fidelidade. Cancela quando quiser.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Nichos ── */}
      <section className="border-t border-aj-border bg-white">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-7 px-6 py-14 md:px-12">
          <motion.h2 {...entrada()} className="text-[32px] font-black tracking-[-0.01em]">
            Feito para quem toca o negócio na mão
          </motion.h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {NICHOS.map((n, i) => (
              <motion.div
                key={n.titulo}
                {...entrada(0.06 * i)}
                className="flex flex-col gap-2 rounded-2xl bg-aj-cream p-[22px]"
              >
                <h3 className="text-[17px] font-black">{n.titulo}</h3>
                <p className="text-[14px] font-bold leading-[1.5] text-aj-muted">{n.texto}</p>
              </motion.div>
            ))}
          </div>
          <motion.p {...entrada(0.2)} className="text-[15px] font-extrabold text-aj-muted">
            O que a gente <u>não</u> faz: contabilidade, assinatura digital e parecer jurídico.
            Papel organizado é conosco; o resto é com seu contador e seu advogado.
          </motion.p>
        </div>
      </section>

      {/* ── Footer escuro ── */}
      <footer className="bg-aj-dark">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-6 px-6 py-14 md:px-12">
          <div className="flex flex-col gap-6">
            <LogoVitrine variant="footer" />
            <p className="text-[15px] font-extrabold text-aj-sand">
              Manda a bagunça. Ache qualquer papel em 10 segundos.
            </p>
          </div>
          <motion.a
            whileTap={{ scale: 0.97 }}
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-aj-whatsapp px-[30px] py-4 text-[17px] font-black text-white transition-colors duration-150 hover:bg-[#1FB859]"
          >
            Chamar no WhatsApp
          </motion.a>
        </div>
        <div className="mx-auto max-w-[1100px] px-6 pb-7 text-[13px] font-bold text-aj-caption md:px-12">
          ajeita.ia.br — organização de documentos para pequenos negócios do Nordeste.
        </div>
      </footer>
    </div>
  );
}
