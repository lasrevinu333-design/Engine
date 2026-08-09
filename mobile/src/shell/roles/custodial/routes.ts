import type { EditionDefinition } from '../../core/types';

export const custodialDefinition: EditionDefinition = {
  edition: 'custodial',
  roleMarker: 'MZ_ROLE_CUSTODIAL_ONLY',
  title: 'Memphis Zoo Custodial',
  subtitle: 'Assigned-area field operations',
  homeRouteId: 'custodial.home',
  themeColor: '#063038',
  routes: [
    { id: 'custodial.home', path: '/home', label: 'Home', shortLabel: 'Home', description: 'Open the employee launcher.', legacyTarget: './employee-hub.html?hub=employee', navigation: false },
    { id: 'custodial.setup', path: '/setup', label: 'Phone Setup', shortLabel: 'Setup', description: 'Open protected manager-assisted phone setup and recovery.', legacyTarget: './index.html?setup=1', navigation: false },
    { id: 'custodial.messages', path: '/messages', label: 'Messages', shortLabel: 'Messages', description: 'Open employee conversations.', legacyTarget: './messages.html?hub=employee', navigation: false },
    { id: 'custodial.schedule', path: '/schedule', label: 'Schedule', shortLabel: 'Schedule', description: 'Open current assigned areas and coverage changes.', legacyTarget: './employee-schedule.html?hub=employee', navigation: false },
    { id: 'custodial.events', path: '/events', label: 'Events', shortLabel: 'Events', description: 'Open employee event notices.', legacyTarget: './employee-events.html?hub=employee', navigation: false },
    { id: 'custodial.feedback', path: '/feedback', label: 'Feedback', shortLabel: 'Feedback', description: 'Open employee feedback.', legacyTarget: './employee-feedback.html?hub=employee', navigation: false },
    { id: 'custodial.cleaning', path: '/cleaning', label: 'Cleaning Session', shortLabel: 'Cleaning', description: 'Open the ambient NFC cleaning workflow.', legacyTarget: './scan.html', navigation: false },
  ],
};
