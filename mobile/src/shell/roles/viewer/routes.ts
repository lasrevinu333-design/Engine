import type { EditionDefinition } from '../../core/types';

export const viewerDefinition: EditionDefinition = {
  edition: 'viewer',
  roleMarker: 'MZ_ROLE_VIEWER_ONLY',
  title: 'Memphis Zoo Viewer',
  subtitle: 'Public operations overview',
  homeRouteId: 'viewer.dashboard',
  themeColor: '#0a2342',
  routes: [
    { id: 'viewer.dashboard', path: '/dashboard', label: 'Dashboard', shortLabel: 'Dashboard', description: 'Open the current public operations dashboard.', legacyTarget: './index.html#dashboard', navigation: true },
    { id: 'viewer.events', path: '/events', label: 'Events', shortLabel: 'Events', description: 'Open the current public events view.', legacyTarget: './index.html#events', navigation: true },
  ],
};
