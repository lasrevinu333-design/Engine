import type { EditionDefinition } from '../../core/types';

export const managerDefinition: EditionDefinition = {
  edition: 'manager',
  roleMarker: 'MZ_ROLE_MANAGER_ONLY',
  title: 'Memphis Zoo Ops',
  subtitle: 'Leadership field operations',
  homeRouteId: 'manager.today',
  themeColor: '#071827',
  routes: [
    { id: 'manager.today', path: '/today', label: 'Today', shortLabel: 'Today', description: 'Open the current manager operations launcher.', legacyTarget: './index.html', navigation: true },
    { id: 'manager.messages', path: '/messages', label: 'Messages', shortLabel: 'Messages', description: 'Open manager and employee conversations.', legacyTarget: './messages.html?hub=manager', navigation: true },
    { id: 'manager.schedule', path: '/schedule', label: 'Schedule', shortLabel: 'Schedule', description: 'Open staffing, assignments, absences, and coverage.', legacyTarget: './schedule-weekly.html', navigation: true },
    { id: 'manager.locations', path: '/locations', label: 'Locations', shortLabel: 'Locations', description: 'Open current location status and cleaning detail.', legacyTarget: './dashboard.html', navigation: true },
    { id: 'manager.more', path: '/more', label: 'More', shortLabel: 'More', description: 'Open the current manager tools catalog.', legacyTarget: './index.html#more', navigation: true },
    { id: 'manager.events', path: '/events', label: 'Events', shortLabel: 'Events', description: 'Open published operational events.', legacyTarget: './events.html?hub=manager', navigation: false },
    { id: 'manager.eventsInput', path: '/events-input', label: 'Events Input', shortLabel: 'Events', description: 'Open event creation and updates.', legacyTarget: './events-admin.html?hub=manager', navigation: false },
    { id: 'manager.insights', path: '/insights', label: 'Insights & Inspections', shortLabel: 'Insights', description: 'Open cleaning analytics and inspections.', legacyTarget: './operational-insights.html', navigation: false },
    { id: 'manager.guestIssues', path: '/guest-issues', label: 'Guest Issues', shortLabel: 'Issues', description: 'Open location-specific guest cleanliness reports.', legacyTarget: './guest-issues.html', navigation: false },
    { id: 'manager.moxie', path: '/moxie', label: 'Moxie', shortLabel: 'Moxie', description: 'Open the private manager workspace.', legacyTarget: './moxie-mobile.html', navigation: false },
    { id: 'manager.notifications', path: '/notifications', label: 'Notification Settings', shortLabel: 'Alerts', description: 'Open current manager notification settings.', legacyTarget: './notifications.html', navigation: false },
    { id: 'manager.phoneAssignments', path: '/phone-assignments', label: 'Phone Assignments', shortLabel: 'Phones', description: 'Open employee phone assignment controls.', legacyTarget: './phone-assignments.html', navigation: false },
    { id: 'manager.access', path: '/manager-access', label: 'Manager Access', shortLabel: 'Access', description: 'Open leadership enrollment management.', legacyTarget: './manager-access.html', navigation: false },
    { id: 'manager.deviceSecurity', path: '/device-security', label: 'Device Security', shortLabel: 'Security', description: 'Open enrolled-device review and revocation.', legacyTarget: './device-security.html', navigation: false },
    { id: 'manager.feedback', path: '/feedback', label: 'Feedback', shortLabel: 'Feedback', description: 'Open product and operational feedback.', legacyTarget: './system-feedback.html?hub=manager', navigation: false },
    { id: 'manager.diagnostics', path: '/diagnostics', label: 'Diagnostics', shortLabel: 'Diagnostics', description: 'Open the current read-only system console.', legacyTarget: './gemini-admin.html', navigation: false },
  ],
};
