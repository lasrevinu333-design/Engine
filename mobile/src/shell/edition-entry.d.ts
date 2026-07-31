declare module '@memphis-zoo/edition-entry' {
  import type { EditionDefinition, RuntimePorts } from './core/types';

  export const definition: EditionDefinition;
  export const runtime: RuntimePorts;
}

declare const __MZ_SHELL_PROOF__: boolean;
