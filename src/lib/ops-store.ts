import { useSyncExternalStore } from 'react';

/**
 * Mini store compartilhado do console ops.
 * A fila de validação (home) publica; a OpsSidebar consome
 * (badge da nav + quota do rodapé).
 */
export type OpsState = {
  queueLeft: number;
  validatedToday: number;
};

let state: OpsState = { queueLeft: 5, validatedToday: 187 };
const listeners = new Set<() => void>();

export function setOpsState(patch: Partial<OpsState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useOpsState(): OpsState {
  return useSyncExternalStore(subscribe, () => state);
}
