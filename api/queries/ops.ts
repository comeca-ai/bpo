import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "./connection";
import {
  clientes,
  contextProfiles,
  documentos,
  eventos,
  lotes,
  organizadores,
  validacoes,
} from "../../db/schema";

// ── Lotes ─────────────────────────────────────────────────
export async function listLotes() {
  const db = getDb();
  const rows = await db
    .select({ lote: lotes, clienteNome: clientes.nome })
    .from(lotes)
    .leftJoin(clientes, eq(lotes.clienteId, clientes.id))
    .orderBy(desc(lotes.numero));
  return rows.map((r) => ({ ...r.lote, clienteNome: r.clienteNome ?? "" }));
}

export async function getLotePorNumero(numero: number) {
  const db = getDb();
  const [row] = await db
    .select({ lote: lotes, cliente: clientes })
    .from(lotes)
    .leftJoin(clientes, eq(lotes.clienteId, clientes.id))
    .where(eq(lotes.numero, numero));
  return row ?? null;
}

export async function getLote(id: number) {
  const db = getDb();
  const [row] = await db
    .select({ lote: lotes, cliente: clientes })
    .from(lotes)
    .leftJoin(clientes, eq(lotes.clienteId, clientes.id))
    .where(eq(lotes.id, id));
  return row ?? null;
}

// ── Documentos ────────────────────────────────────────────
export async function docsDoLote(loteId: number) {
  const db = getDb();
  return db
    .select()
    .from(documentos)
    .where(eq(documentos.loteId, loteId))
    .orderBy(asc(documentos.id));
}

// ── Fila de validação (HITL) ──────────────────────────────
export async function filaValidacao(loteId: number) {
  const db = getDb();
  const rows = await db
    .select({ doc: documentos, val: validacoes })
    .from(validacoes)
    .innerJoin(documentos, eq(validacoes.documentoId, documentos.id))
    .where(and(eq(documentos.loteId, loteId), eq(validacoes.decisao, "pendente")))
    .orderBy(asc(validacoes.id));
  return rows.map((r) => ({ ...r.doc, validacaoId: r.val.id, motivo: r.val.motivo }));
}

export async function decidirValidacao(input: {
  documentoId: number;
  decisao: "aprovado" | "corrigido" | "segunda_foto";
  nomeFinalCorrigido?: string;
  organizadorNome: string;
}) {
  const db = getDb();
  const [val] = await db
    .select()
    .from(validacoes)
    .where(and(eq(validacoes.documentoId, input.documentoId), eq(validacoes.decisao, "pendente")));
  if (!val) throw new Error("Validação não encontrada ou já decidida");

  await db
    .update(validacoes)
    .set({ decisao: input.decisao, decididoPor: input.organizadorNome, decididoEm: new Date() })
    .where(eq(validacoes.id, val.id));

  const novoStatus = input.decisao === "segunda_foto" ? "todo" : "done";
  await db
    .update(documentos)
    .set({
      status: novoStatus as "todo" | "done",
      ...(input.nomeFinalCorrigido ? { nomeFinal: input.nomeFinalCorrigido } : {}),
    })
    .where(eq(documentos.id, input.documentoId));

  // Atualiza contadores do lote + organizador
  const [doc] = await db.select().from(documentos).where(eq(documentos.id, input.documentoId));
  if (doc) {
    await db
      .update(lotes)
      .set({ docsAjeitados: sql`${lotes.docsAjeitados} + 1` })
      .where(eq(lotes.id, doc.loteId));
  }
  await db
    .update(organizadores)
    .set({ validadosHoje: sql`${organizadores.validadosHoje} + 1` })
    .where(eq(organizadores.nome, input.organizadorNome));

  // Audit trail
  const verbo =
    input.decisao === "aprovado" ? "aprovou" : input.decisao === "corrigido" ? "corrigiu" : "pediu 2ª foto de";
  await addEvento(doc.loteId, "me", `<b>Você</b> ${verbo} <b>${doc.nomeOriginal}</b>`, input.decisao !== "aprovado");

  // Fila zerada? → lote pronto para entrega
  const restantes = await filaValidacao(doc.loteId);
  if (restantes.length === 0) {
    await db.update(lotes).set({ status: "pronto_entrega" }).where(eq(lotes.id, doc.loteId));
    await addEvento(doc.loteId, "sys", "Fila de validação <b>zerada</b> · lote pronto para entrega");
  }
  return { ok: true, restantes: restantes.length };
}

// ── Entrega / aprovação ───────────────────────────────────
export async function entregarLote(loteId: number) {
  const db = getDb();
  await db
    .update(lotes)
    .set({ status: "entregue", entregueEm: new Date() })
    .where(eq(lotes.id, loteId));
  await addEvento(
    loteId,
    "sys",
    "<b>Lote entregue</b> · Drive atualizado + WhatsApp enviado ao cliente · cobrança liberada após aprovação",
    true
  );
  return { ok: true };
}

export async function aprovarLote(loteId: number) {
  const db = getDb();
  await db.update(lotes).set({ status: "aprovado" }).where(eq(lotes.id, loteId));
  await addEvento(loteId, "sys", "<b>Cliente aprovou a entrega</b> · cobrança liberada ✓", true);
  return { ok: true };
}

// ── Eventos (feed / audit trail) ──────────────────────────
export async function addEvento(
  loteId: number,
  ator: "bia" | "tom" | "lia" | "pedro" | "sys" | "me",
  texto: string,
  alerta = false
) {
  const db = getDb();
  await db.insert(eventos).values({ loteId, ator, texto, alerta });
}

export async function feedDoLote(loteId: number, sinceId = 0) {
  const db = getDb();
  return db
    .select()
    .from(eventos)
    .where(and(eq(eventos.loteId, loteId), gt(eventos.id, sinceId)))
    .orderBy(desc(eventos.id))
    .limit(12);
}

// ── Clientes + Contexto ───────────────────────────────────
export async function listClientes() {
  const db = getDb();
  return db.select().from(clientes).orderBy(asc(clientes.nome));
}

export async function contextoDoCliente(clienteId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(contextProfiles)
    .where(eq(contextProfiles.clienteId, clienteId))
    .orderBy(desc(contextProfiles.versao));
  return row ?? null;
}

// ── Métricas ops ──────────────────────────────────────────
export async function metricasOps(loteId: number) {
  const db = getDb();
  const [lote] = await db.select().from(lotes).where(eq(lotes.id, loteId));
  const fila = await filaValidacao(loteId);
  const [org] = await db.select().from(organizadores).limit(1);
  return {
    docsAjeitados: lote?.docsAjeitados ?? 0,
    qtdArquivos: lote?.qtdArquivos ?? 0,
    fila: fila.length,
    autoAprovacaoPct: 87,
    custoPorDoc: 0.04,
    validadosHoje: org?.validadosHoje ?? 0,
  };
}

// ── Propostas (o "Combinado" — fluxo de aceite) ───────────

export type Combinado = {
  escopo: string[];
  sla: string;
  entrega: string;
  validacao: string;
  foraDeEscopo: string[];
};

/** Extrai volume de arquivos do texto ("86 notas", "120 docs", "40 contratos") */
export function extrairVolume(texto: string): number {
  const m = texto.match(/(\d{1,5})\s*(notas?(?:\s+fiscais)?|docs?|documentos?|contratos?|arquivos?|recibos?|boletos?|fotos?|comprovantes?|holerites?|laudos?)/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** SIMULAÇÃO da IA — heurística TS que estrutura o pedido em um "combinado" */
export function estruturarProposta(descricao: string, temAudio: boolean): Combinado {
  const texto = descricao.trim();

  // Áudio sem texto: estrutura genérica aguardando transcrição
  if (temAudio && texto.length === 0) {
    return {
      escopo: ["Organização documental (a transcrever do áudio)"],
      sla: "a combinar — aguardando transcrição do áudio",
      entrega: "a transcrever do áudio",
      validacao: "a transcrever do áudio",
      foraDeEscopo: ["a transcrever"],
    };
  }

  const lower = texto.toLowerCase();

  // ── Escopo: tipos de documento mencionados ──
  const escopo: string[] = [];
  const tipos: Array<[RegExp, string]> = [
    [/notas?(?:\s+fiscais)?|\bnf\b/, "Notas fiscais"],
    [/contratos?/, "Contratos"],
    [/recibos?/, "Recibos"],
    [/boletos?/, "Boletos"],
    [/holerites?|folha/, "Docs de pessoas"],
    [/laudos?|vistoria/, "Laudos e vistorias"],
    [/comprovantes?|pix/, "Comprovantes"],
    [/orçamentos?/, "Orçamentos"],
    [/di[aá]rio(?:\s+de\s+obra)?/, "Diário de obra"],
    [/fotos?|imagens?/, "Fotos e imagens"],
  ];
  for (const [re, label] of tipos) if (re.test(lower)) escopo.push(label);
  if (escopo.length === 0) escopo.push("Caixa de documentos");
  if (/resumo|relat[oó]rio|consolidado/.test(lower)) escopo.push("+ resumo consolidado");
  if (/planilha|controle/.test(lower)) escopo.push("+ planilha de controle");

  // ── SLA / prazo ──
  let sla = "entrega em 48h";
  if (/\bhoje\b|\burgente\b|\bagora\b|\bpra\s+j[aá]\b/.test(lower)) sla = "entrega em 24h (urgente)";
  else if (/amanh[ãa]/.test(lower)) sla = "entrega até amanhã";
  else if (/(\d+)\s*h(?:oras)?\b/.test(lower)) {
    const h = lower.match(/(\d+)\s*h(?:oras)?\b/);
    sla = `entrega em ${h?.[1]}h`;
  } else if (/semana/.test(lower)) sla = "entrega em até 7 dias";
  else if (/(\d+)\s*dias?/.test(lower)) {
    const d = lower.match(/(\d+)\s*dias?/);
    sla = `entrega em ${d?.[1]} dias`;
  }

  // ── Entrega ──
  const canais: string[] = [];
  if (/whats(?:app)?/.test(lower)) canais.push("WhatsApp");
  if (/drive/.test(lower)) canais.push("pasta no Drive");
  if (/e-?mail/.test(lower)) canais.push("e-mail");
  const entrega =
    canais.length > 0
      ? `Drive organizado + aviso no ${canais.join(" e ")}`
      : "pasta organizada no Drive + índice de busca";

  // ── Validação ──
  const validacao = /s[oó]\s+paga?\s+se\s+aprovar|aprova[cç][aã]o|conferir|validar|revisar/.test(lower)
    ? "humano confere tudo antes da entrega · cliente aprova no portal"
    : "amostra validada por humano · cliente aprova no portal (só paga se aprovar)";

  // ── Fora de escopo (o que o texto exclui ou pedidos clássicos fora) ──
  const foraDeEscopo: string[] = [];
  const sem = texto.match(/(?:sem|menos|exceto|n[ãa]o\s+(?:precisa|inclui|quero))\s+([^.,;]+)/i);
  if (sem) foraDeEscopo.push(sem[1].trim());
  if (!/holerite|folha/.test(lower)) foraDeEscopo.push("holerites/folha");
  if (!/cont[aá]bil|contador|lançamento/.test(lower)) foraDeEscopo.push("lançamento contábil");
  if (!/assinatura|parecer|jur[ií]dico/.test(lower)) foraDeEscopo.push("assinatura/parecer");

  return { escopo, sla, entrega, validacao, foraDeEscopo };
}

export async function criarProposta(input: {
  nome: string;
  empresa: string;
  whatsapp: string;
  descricao: string;
  combinado: unknown;
  agentes: number;
  skills: number;
  precoMensal: number;
  temAudio?: boolean;
  audioBase64?: string | null;
}) {
  const db = getDb();

  // Cliente novo (segmento/cidade ainda a mapear)
  const [insCli] = await db.insert(clientes).values({
    nome: input.empresa || input.nome,
    cidade: "—",
    segmento: "a mapear",
    planoAgentes: input.agentes,
    planoSkills: input.skills,
    precoMensal: input.precoMensal,
  });
  const clienteId = Number(insCli.insertId);

  const [maxRow] = await db
    .select({ maxNum: sql<number>`coalesce(max(${lotes.numero}), 0)` })
    .from(lotes);
  const numero = (maxRow?.maxNum ?? 0) + 1;

  const combinadoJson = typeof input.combinado === "string" ? input.combinado : JSON.stringify(input.combinado ?? {});
  const combinado = safeParseCombinado(combinadoJson);
  const temAudio = input.temAudio ?? Boolean(input.audioBase64);
  const volume = extrairVolume(input.descricao);
  const prazoEm = new Date(Date.now() + 48 * 36e5);
  const tituloBase = input.descricao.trim().replace(/\s+/g, " ");
  const titulo = tituloBase.length > 0
    ? tituloBase.slice(0, 90)
    : "Pedido por áudio (a transcrever)";

  const [insLote] = await db.insert(lotes).values({
    numero,
    clienteId,
    titulo,
    canal: "whatsapp",
    qtdArquivos: volume,
    status: "proposta",
    solicitadoTexto: input.descricao.trim() || "(pedido enviado por áudio — a transcrever)",
    escopoInclui: JSON.stringify(combinado.escopo),
    escopoFora: JSON.stringify(combinado.foraDeEscopo),
    clienteContato: `${input.nome} · ${input.whatsapp}`,
    combinado: combinadoJson,
    propostaOrigem: temAudio ? "audio" : "texto",
    docsAjeitados: 0,
    tempoUsadoPct: 0,
    prazoEm,
  });

  return { ok: true, loteId: Number(insLote.insertId), numero, clienteId };
}

function safeParseCombinado(raw: string): Combinado {
  try {
    const c = JSON.parse(raw) as Partial<Combinado>;
    return {
      escopo: Array.isArray(c.escopo) ? c.escopo : ["Caixa de documentos"],
      sla: typeof c.sla === "string" ? c.sla : "entrega em 48h",
      entrega: typeof c.entrega === "string" ? c.entrega : "Drive + índice",
      validacao: typeof c.validacao === "string" ? c.validacao : "cliente aprova no portal",
      foraDeEscopo: Array.isArray(c.foraDeEscopo) ? c.foraDeEscopo : [],
    };
  } catch {
    return {
      escopo: ["Caixa de documentos"],
      sla: "entrega em 48h",
      entrega: "Drive + índice",
      validacao: "cliente aprova no portal",
      foraDeEscopo: [],
    };
  }
}

export async function listPropostas() {
  const db = getDb();
  const rows = await db
    .select({ lote: lotes, clienteNome: clientes.nome, precoMensal: clientes.precoMensal })
    .from(lotes)
    .leftJoin(clientes, eq(lotes.clienteId, clientes.id))
    .where(eq(lotes.status, "proposta"))
    .orderBy(desc(lotes.id));
  return rows.map((r) => ({ ...r.lote, clienteNome: r.clienteNome ?? "", precoMensal: r.precoMensal ?? 0 }));
}

export async function aceitarProposta(loteId: number) {
  const db = getDb();
  const [lote] = await db.select().from(lotes).where(eq(lotes.id, loteId));
  if (!lote) throw new Error("Proposta não encontrada");
  if (lote.status !== "proposta") throw new Error("Este lote não é uma proposta pendente");
  await db.update(lotes).set({ status: "recebido", recebidoEm: new Date() }).where(eq(lotes.id, loteId));
  await addEvento(loteId, "sys", `Proposta aceita — <b>time alocado</b> · lote #${lote.numero} entrou no pipeline`, true);
  return { ok: true };
}

export async function recusarProposta(loteId: number, motivo: string) {
  const db = getDb();
  const [lote] = await db.select().from(lotes).where(eq(lotes.id, loteId));
  if (!lote) throw new Error("Proposta não encontrada");
  if (lote.status !== "proposta") throw new Error("Este lote não é uma proposta pendente");
  // Recusa simples e segura: remove a proposta (sem histórico de trabalho ainda)
  await db.delete(lotes).where(eq(lotes.id, loteId));
  console.info(`[propostas] recusada #${lote.numero} — motivo: ${motivo}`);
  return { ok: true };
}

// ── Simulação (motor de tiques — modo demo) ───────────────
const AMBIENT: Array<["bia" | "tom" | "lia" | "pedro" | "sys", string, boolean?]> = [
  ["bia", "Triagem: <b>12 fotos</b> do WhatsApp classificadas (conf. média 0,94)"],
  ["tom", "Pasta <b>/Obras/Litoral-Plaza/medições</b> criada no Drive"],
  ["lia", "<b>Cartão-resumo</b> da medição parcial 2 gerado"],
  ["pedro", "Pedro conferiu a amostra de 5% — <b>sem divergências</b>"],
  ["sys", "Governança: concordância 97,2% · threshold mantido em 0,90"],
  ["tom", "<b>3 recibos</b> do Seu Zé renomeados no padrão v7"],
  ["bia", "Duplicado detectado: nota <b>8.412</b> enviada 2× — fundida"],
  ["lia", "Busca testada: “ART da laje” responde em <b>1,8s</b>"],
];

export async function simTick(loteId: number) {
  const db = getDb();
  const [lote] = await db.select().from(lotes).where(eq(lotes.id, loteId));
  if (!lote) throw new Error("Lote não encontrado");

  // Só simula enquanto não entregue
  if (lote.status === "entregue" || lote.status === "aprovado") return { ok: true, done: true };

  // Evento ambiente rotativo
  const [countRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(eventos)
    .where(eq(eventos.loteId, loteId));
  const ev = AMBIENT[(countRow?.n ?? 0) % AMBIENT.length];
  await addEvento(loteId, ev[0], ev[1], ev[2] ?? false);

  // Avança docs do portal (todo → doing → done)
  const [doing] = await db
    .select()
    .from(documentos)
    .where(and(eq(documentos.loteId, loteId), eq(documentos.status, "doing")))
    .limit(1);
  if (doing) {
    await db.update(documentos).set({ status: "done" }).where(eq(documentos.id, doing.id));
    const [next] = await db
      .select()
      .from(documentos)
      .where(and(eq(documentos.loteId, loteId), eq(documentos.status, "todo")))
      .orderBy(asc(documentos.id))
      .limit(1);
    if (next) await db.update(documentos).set({ status: "doing" }).where(eq(documentos.id, next.id));
  }

  // Progresso do lote (limitado pelo total)
  if (lote.docsAjeitados < lote.qtdArquivos) {
    await db
      .update(lotes)
      .set({
        docsAjeitados: sql`least(${lotes.docsAjeitados} + 2, ${lote.qtdArquivos})`,
        tempoUsadoPct: sql`least(${lotes.tempoUsadoPct} + 1, 100)`,
      })
      .where(eq(lotes.id, loteId));
  }
  return { ok: true, done: false };
}
