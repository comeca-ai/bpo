import { trpc } from '@/providers/trpc';

/**
 * Estado compartilhado do console ops — wrapper sobre o backend tRPC.
 * A OpsSidebar consome (badge da fila na nav + quota do rodapé);
 * os dados vêm de `metricas.ops` do lote demo (#482), com polling.
 * Enquanto o backend não responde (loading/erro), devolve o fallback
 * da seed para manter a UI estável.
 */
export type OpsState = {
  queueLeft: number;
  validatedToday: number;
};

export const LOTE_DEMO_NUMERO = 482;

const FALLBACK: OpsState = { queueLeft: 5, validatedToday: 187 };

export function useOpsState(): OpsState {
  const loteQ = trpc.lotes.porNumero.useQuery(
    { numero: LOTE_DEMO_NUMERO },
    { refetchInterval: 3000, retry: 1 },
  );
  const loteId = loteQ.data?.lote.id ?? 0;
  const metQ = trpc.metricas.ops.useQuery(
    { loteId },
    { enabled: loteId > 0, refetchInterval: 3000, retry: 1 },
  );
  if (!metQ.data) return FALLBACK;
  return { queueLeft: metQ.data.fila, validatedToday: metQ.data.validadosHoje };
}
