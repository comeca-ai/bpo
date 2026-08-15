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
