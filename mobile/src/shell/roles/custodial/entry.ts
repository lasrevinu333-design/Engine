import { CustodialNativeVault } from '@memphis-zoo/custodial-native-vault';
import { custodialDefinition } from './routes';
import { createCapacitorRuntimePorts } from '../../runtime/capacitor';
import {
  custodialRequestMetadata,
  readCustodialShellAuth,
} from '../../runtime/custodial-auth';
import { noopNotifications } from '../../runtime/noop-notifications';

export const definition = custodialDefinition;
const baseRuntime = createCapacitorRuntimePorts(
  readCustodialShellAuth,
  custodialRequestMetadata,
  noopNotifications,
);
export const runtime = {
  ...baseRuntime,
  nfcTransitions: {
    async report(stage: string, outcome: string) {
      await CustodialNativeVault.reportNfcTransitionDiagnostic({ stage, outcome }).catch(() => {});
    },
  },
};
