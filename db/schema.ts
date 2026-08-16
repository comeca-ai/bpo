import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  int,
  boolean,
  timestamp,
  bigint,
} from "drizzle-orm/mysql-core";

// ── Clientes ──────────────────────────────────────────────
export const clientes = mysqlTable("clientes", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 160 }).notNull(),
  cidade: varchar("cidade", { length: 120 }).notNull(),
  segmento: varchar("segmento", { length: 120 }).notNull(),
  planoAgentes: int("plano_agentes").notNull().default(2),
  planoSkills: int("plano_skills").notNull().default(1),
  precoMensal: int("preco_mensal").notNull().default(990), // R$ por mês
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

// ── ContextProfile — o "cérebro documental" (engenharia de contexto) ──
export const contextProfiles = mysqlTable("context_profiles", {
  id: serial("id").primaryKey(),
  clienteId: bigint("cliente_id", { mode: "number", unsigned: true }).notNull(),
  versao: int("versao").notNull().default(1),
  namingPattern: varchar("naming_pattern", { length: 255 }).notNull(),
  docTypes: text("doc_types").notNull(), // JSON array
  taxonomy: text("taxonomy").notNull(),
  dictionary: text("dictionary").notNull(), // JSON array de {termo, significado}
  routingRules: text("routing_rules").notNull(), // JSON array de strings
  confidenceThreshold: int("confidence_threshold").notNull().default(90), // 0-100
  sampleRate: int("sample_rate").notNull().default(5), // % amostra QA
  concordancia: int("concordancia").notNull().default(950), // milésimos: 972 = 97,2%
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

// ── Organizadores (humanos) ───────────────────────────────
export const organizadores = mysqlTable("organizadores", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 120 }).notNull(),
  papel: varchar("papel", { length: 120 }).notNull().default("Organizador"),
  validadosHoje: int("validados_hoje").notNull().default(0),
});

// ── Lotes (pedidos de trabalho) ───────────────────────────
export const lotes = mysqlTable("lotes", {
  id: serial("id").primaryKey(),
  numero: int("numero").notNull(), // ex.: 482
  clienteId: bigint("cliente_id", { mode: "number", unsigned: true }).notNull(),
  titulo: varchar("titulo", { length: 200 }).notNull(),
  canal: mysqlEnum("canal", ["whatsapp", "email", "drive", "upload"]).notNull(),
  qtdArquivos: int("qtd_arquivos").notNull(),
  status: mysqlEnum("status", [
    "proposta",
    "recebido",
    "processando",
    "em_validacao",
    "pronto_entrega",
    "entregue",
    "aprovado",
  ]).notNull().default("recebido"),
  solicitadoTexto: text("solicitado_texto").notNull(),
  escopoInclui: text("escopo_inclui").notNull(), // JSON array
  escopoFora: text("escopo_fora").notNull(), // JSON array
  // ── Fluxo de proposta (o "Combinado") ──
  clienteContato: varchar("cliente_contato", { length: 200 }), // nome + whatsapp de quem pediu
  combinado: text("combinado"), // JSON estruturado do pedido (escopo/sla/entrega/validação)
  propostaOrigem: mysqlEnum("proposta_origem", ["texto", "audio", "seed"]).notNull().default("seed"),
  docsAjeitados: int("docs_ajeitados").notNull().default(0),
  tempoUsadoPct: int("tempo_usado_pct").notNull().default(0), // % do prazo decorrido
  recebidoEm: timestamp("recebido_em").notNull().defaultNow(),
  prazoEm: timestamp("prazo_em").notNull(),
  entregueEm: timestamp("entregue_em"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

// ── Documentos ────────────────────────────────────────────
export const documentos = mysqlTable("documentos", {
  id: serial("id").primaryKey(),
  loteId: bigint("lote_id", { mode: "number", unsigned: true }).notNull(),
  nomeOriginal: varchar("nome_original", { length: 255 }).notNull(),
  nomeFinal: varchar("nome_final", { length: 255 }),
  tipo: varchar("tipo", { length: 80 }).notNull().default("indefinido"),
  origem: varchar("origem", { length: 160 }).notNull().default(""), // "WhatsApp · Pedro"
  confianca: int("confianca").notNull().default(0), // 0-100
  status: mysqlEnum("status", [
    "todo",          // na fila do portal / aguardando
    "doing",         // processando agora
    "auto",          // auto-aprovado pela IA
    "validacao",     // aguardando humano
    "done",          // ajeitado (validado ou entregue)
  ]).notNull().default("todo"),
  pageLines: text("page_lines"), // JSON array — linhas do "scan" (validação)
  metaRows: text("meta_rows"), // JSON array de [k,v] — decisão da IA
  duvida: text("duvida"), // dúvida declarada pelo agente
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

// ── Validações (HITL) ─────────────────────────────────────
export const validacoes = mysqlTable("validacoes", {
  id: serial("id").primaryKey(),
  documentoId: bigint("documento_id", { mode: "number", unsigned: true }).notNull(),
  motivo: mysqlEnum("motivo", ["baixa_confianca", "amostra", "escopo"]).notNull(),
  decisao: mysqlEnum("decisao", ["pendente", "aprovado", "corrigido", "segunda_foto"]).notNull().default("pendente"),
  decididoPor: varchar("decidido_por", { length: 120 }),
  decididoEm: timestamp("decidido_em"),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

// ── Eventos (audit trail / log ao vivo) ───────────────────
export const eventos = mysqlTable("eventos", {
  id: serial("id").primaryKey(),
  loteId: bigint("lote_id", { mode: "number", unsigned: true }).notNull(),
  ator: mysqlEnum("ator", ["bia", "tom", "lia", "pedro", "sys", "me"]).notNull(),
  texto: text("texto").notNull(), // pode conter <b>…</b> sanitizado no front
  alerta: boolean("alerta").notNull().default(false),
  criadoEm: timestamp("criado_em").notNull().defaultNow(),
});

// ── Types ─────────────────────────────────────────────────
export type Cliente = typeof clientes.$inferSelect;
export type ContextProfile = typeof contextProfiles.$inferSelect;
export type Organizador = typeof organizadores.$inferSelect;
export type Lote = typeof lotes.$inferSelect;
export type Documento = typeof documentos.$inferSelect;
export type Validacao = typeof validacoes.$inferSelect;
export type Evento = typeof eventos.$inferSelect;
