import type { EditionDefinition } from '../../core/types';

export const custodialDefinition: EditionDefinition = {
  edition: 'custodial',
  roleMarker: 'MZ_ROLE_CUSTODIAL_ONLY',
  title: 'Memphis Zoo Custodial',
  subtitle: 'Employee work phone',
  homeRouteId: 'custodial.home',
  themeColor: '#063038',
  routes: [
    { id: 'custodial.home', path: '/home', label: 'Home', shortLabel: 'Home', description: 'Open the employee Home screen.', legacyTarget: './index.html', navigation: false },
    { id: 'custodial.setup', path: '/setup', label: 'Phone Setup', shortLabel: 'Setup', description: 'Set up this employee phone.', legacyTarget: './index.html', navigation: false },
    { id: 'custodial.schedule', path: '/schedule', label: 'Schedule', shortLabel: 'Schedule', description: 'See the areas you are responsible for now.', legacyTarget: './employee-schedule.html?hub=employee', navigation: false },
    { id: 'custodial.messages', path: '/messages', label: 'Messages', shortLabel: 'Messages', description: 'Talk with another employee or a manager.', legacyTarget: './messages.html?hub=employee', navigation: false },
    { id: 'custodial.events', path: '/events', label: 'Events', shortLabel: 'Events', description: 'See zoo event information.', legacyTarget: './employee-events.html?hub=employee', navigation: false },
    { id: 'custodial.feedback', path: '/feedback', label: 'Feedback', shortLabel: 'Feedback', description: 'Get help with this phone or app.', legacyTarget: './employee-feedback.html?hub=employee', navigation: false },
    { id: 'custodial.cleaning', path: '/cleaning', label: 'Cleaning Session', shortLabel: 'Cleaning', description: 'Open the ambient NFC cleaning workflow.', legacyTarget: './scan.html', navigation: false },
  ],
};
