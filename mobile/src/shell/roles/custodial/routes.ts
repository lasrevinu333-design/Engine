import type { EditionDefinition } from '../../core/types';

export const custodialDefinition: EditionDefinition = {
  edition: 'custodial',
  roleMarker: 'MZ_ROLE_CUSTODIAL_ONLY',
  title: 'Memphis Zoo Custodial',
  subtitle: 'Assigned-area field operations',
  homeRouteId: 'custodial.today',
  themeColor: '#063038',
  routes: [
    { id: 'custodial.today', path: '/today', label: 'Today', shortLabel: 'Today', description: 'Open assigned areas and current shift status.', legacyTarget: './index.html', navigation: true },
    { id: 'custodial.messages', path: '/messages', label: 'Messages', shortLabel: 'Messages', description: 'Open employee and manager conversations.', legacyTarget: './messages.html?hub=employee', navigation: true },
    { id: 'custodial.schedule', path: '/schedule', label: 'Schedule', shortLabel: 'Schedule', description: 'Open read-only assignments and coverage changes.', legacyTarget: './employee-schedule.html?hub=employee', navigation: true },
    { id: 'custodial.report', path: '/report', label: 'Report', shortLabel: 'Report', description: 'Open maintenance, supply, cleanliness, and app feedback.', legacyTarget: './system-feedback.html?hub=employee', navigation: true },
    { id: 'custodial.events', path: '/events', label: 'Events', shortLabel: 'Events', description: 'Open operational events affecting assigned areas.', legacyTarget: './events.html?hub=employee', navigation: false },
    { id: 'custodial.legacyHub', path: '/legacy-hub', label: 'Employee Hub', shortLabel: 'Hub', description: 'Open the current employee launcher.', legacyTarget: './employee-hub.html?hub=employee', navigation: false },
    { id: 'custodial.cleaning', path: '/cleaning', label: 'Cleaning Session', shortLabel: 'Cleaning', description: 'Open the ambient NFC cleaning workflow.', legacyTarget: './scan.html', navigation: false },
  ],
};
