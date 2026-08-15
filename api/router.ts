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
  listClientes,
  listLotes,
  metricasOps,
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
});

export type AppRouter = typeof appRouter;
