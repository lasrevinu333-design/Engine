import { managerDefinition } from './routes';
import { createCapacitorRuntimePorts } from '../../runtime/capacitor';
import {
  managerAuthHeaders,
  managerNotifications,
  readManagerShellAuth,
  installManagerNativeTransport,
} from '../../runtime/manager-notifications';

installManagerNativeTransport();
export const definition = managerDefinition;
export const runtime = createCapacitorRuntimePorts(
  readManagerShellAuth,
  managerAuthHeaders,
  managerNotifications,
);
