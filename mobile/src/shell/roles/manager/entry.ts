import { managerDefinition } from './routes';
import { createCapacitorRuntimePorts } from '../../runtime/capacitor';
import {
  managerAuthHeaders,
  managerNotifications,
  readManagerShellAuth,
} from '../../runtime/manager-notifications';

export const definition = managerDefinition;
export const runtime = createCapacitorRuntimePorts(
  readManagerShellAuth,
  managerAuthHeaders,
  managerNotifications,
);
