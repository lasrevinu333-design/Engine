import { custodialDefinition } from './routes';
import { createCapacitorRuntimePorts } from '../../runtime/capacitor';
import {
  custodialAuthHeaders,
  readCustodialShellAuth,
} from '../../runtime/custodial-auth';
import { noopNotifications } from '../../runtime/noop-notifications';

export const definition = custodialDefinition;
export const runtime = createCapacitorRuntimePorts(
  readCustodialShellAuth,
  custodialAuthHeaders,
  noopNotifications,
);
