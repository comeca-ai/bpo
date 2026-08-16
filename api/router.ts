import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  aprovarLote,
  contextoDoCliente,
  decidirValidacao,
  docsDoLote,
  entregarLote,
  feedDoLote,
  filaValidacao,
  getLote,
  getLotePorNumero,
  aceitarProposta,
  criarProposta,
  estruturarProposta,
  listClientes,
  listLotes,
  listPropostas,
  metricasOps,
  recusarProposta,
  simTick,
} from "./queries/ops";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  lotes: createRouter({
    list: publicQuery.query(() => listLotes()),
    get: publicQuery.input(z.object({ id: z.number() })).query(({ input }) => getLote(input.id)),
    porNumero: publicQuery
      .input(z.object({ numero: z.number() }))
      .query(({ input }) => getLotePorNumero(input.numero)),
    entregar: publicQuery
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => entregarLote(input.id)),
    aprovar: publicQuery
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => aprovarLote(input.id)),
  }),

  documentos: createRouter({
    porLote: publicQuery
      .input(z.object({ loteId: z.number() }))
      .query(({ input }) => docsDoLote(input.loteId)),
  }),

  validacao: createRouter({
    fila: publicQuery
      .input(z.object({ loteId: z.number() }))
      .query(({ input }) => filaValidacao(input.loteId)),
    decidir: publicQuery
      .input(
        z.object({
          documentoId: z.number(),
          decisao: z.enum(["aprovado", "corrigido", "segunda_foto"]),
          nomeFinalCorrigido: z.string().optional(),
          organizadorNome: z.string().default("Nizan Jhon"),
        })
      )
      .mutation(({ input }) => decidirValidacao(input)),
  }),

  eventos: createRouter({
    porLote: publicQuery
      .input(z.object({ loteId: z.number(), sinceId: z.number().default(0) }))
      .query(({ input }) => feedDoLote(input.loteId, input.sinceId)),
  }),

  clientes: createRouter({
    list: publicQuery.query(() => listClientes()),
    contexto: publicQuery
      .input(z.object({ clienteId: z.number() }))
      .query(({ input }) => contextoDoCliente(input.clienteId)),
  }),

  metricas: createRouter({
    ops: publicQuery.input(z.object({ loteId: z.number() })).query(({ input }) => metricasOps(input.loteId)),
  }),

  sim: createRouter({
    tick: publicQuery.input(z.object({ loteId: z.number() })).mutation(({ input }) => simTick(input.loteId)),
  }),

  propostas: createRouter({
    estruturar: publicQuery
      .input(z.object({ descricao: z.string(), temAudio: z.boolean() }))
      .mutation(({ input }) => estruturarProposta(input.descricao, input.temAudio)),
    criar: publicQuery
      .input(
        z.object({
          nome: z.string().min(1),
          empresa: z.string().min(1),
          whatsapp: z.string().min(1),
          descricao: z.string().default(""),
          combinadoJson: z.string(),
          agentes: z.number().int().min(1).default(2),
          skills: z.number().int().min(0).default(1),
          precoMensal: z.number().int().min(0).default(990),
          temAudio: z.boolean().default(false),
        })
      )
      .mutation(({ input }) => criarProposta(input)),
    list: publicQuery.query(() => listPropostas()),
    aceitar: publicQuery
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => aceitarProposta(input.id)),
    recusar: publicQuery
      .input(z.object({ id: z.number(), motivo: z.string().default("") }))
      .mutation(({ input }) => recusarProposta(input.id, input.motivo)),
  }),
});

export type AppRouter = typeof appRouter;
