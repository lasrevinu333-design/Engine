import type { EditionDefinition } from '../../core/types';

export const custodialDefinition: EditionDefinition = {
  edition: 'custodial',
  roleMarker: 'MZ_ROLE_CUSTODIAL_ONLY',
  title: 'Memphis Zoo Custodial',
  subtitle: 'Assigned-area field operations',
  homeRouteId: 'custodial.schedule',
  themeColor: '#063038',
  routes: [
    { id: 'custodial.schedule', path: '/schedule', label: 'Schedule', shortLabel: 'Schedule', description: 'Open assigned areas and current shift status.', legacyTarget: './index.html', navigation: true },
    { id: 'custodial.messages', path: '/messages', label: 'Messages', shortLabel: 'Messages', description: 'Open employee and manager conversations.', legacyTarget: './messages.html?hub=employee', navigation: true },
    { id: 'custodial.events', path: '/events', label: 'Events', shortLabel: 'Events', description: 'Open operational events affecting assigned areas.', legacyTarget: './events.html?hub=employee', navigation: true },
    { id: 'custodial.feedback', path: '/feedback', label: 'Feedback', shortLabel: 'Feedback', description: 'Open maintenance, supply, cleanliness, and app feedback.', legacyTarget: './system-feedback.html?hub=employee', navigation: true },
    { id: 'custodial.legacyHub', path: '/legacy-hub', label: 'Employee Hub', shortLabel: 'Hub', description: 'Open the current employee launcher.', legacyTarget: './employee-hub.html?hub=employee', navigation: false },
    { id: 'custodial.cleaning', path: '/cleaning', label: 'Cleaning Session', shortLabel: 'Cleaning', description: 'Open the ambient NFC cleaning workflow.', legacyTarget: './scan.html', navigation: false },
  ],
};
