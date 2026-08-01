import { custodialDefinition } from './routes';
import { createCapacitorRuntimePorts } from '../../runtime/capacitor';
import {
  custodialRequestMetadata,
  readCustodialShellAuth,
} from '../../runtime/custodial-auth';
import { noopNotifications } from '../../runtime/noop-notifications';

export const definition = custodialDefinition;
export const runtime = createCapacitorRuntimePorts(
  readCustodialShellAuth,
  custodialRequestMetadata,
  noopNotifications,
);
