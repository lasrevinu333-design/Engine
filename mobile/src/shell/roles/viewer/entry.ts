import { viewerDefinition } from './routes';
import { createViewerRuntimePorts } from '../../runtime/viewer';

export const definition = viewerDefinition;
export const runtime = createViewerRuntimePorts();
