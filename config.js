window.MZ_CONFIG = {
  app: {
    name: "Memphis Zoo Custodial System",
    frontendVersion: "release-2026.04.25.1"
  },
  backend: {
    baseUrl: "https://memphis-zoo-mcp.onrender.com"
  },
  contracts: {
    scan: "scan.v1",
    dashboard: "dashboard.v1",
    messaging: "messaging.v1",
    schedule: "schedule.v1",
    events: "events.v1"
  },
  endpoints: {
    version: "/version",
    dashboardAttendance: "/dashboard-api/current-attendance",
    dashboardSummary: "/dashboard-api/summary",
    dashboardCanary: "/dashboard-api/canary",
    dashboardCloseTicket: "/dashboard-api/close-ticket",
    dashboardEvents: "/dashboard-api/events",
    adminEvents: "/admin-api/events",
    messagingBase: "/messaging-api",
    messagingMeByDevice: "/messaging-api/me/by-device",
    scheduleBase: "/schedule-api",
    scheduleMyDay: "/schedule-api/my-day",
    scanHealth: "/scan-api/health",
    scanRpc: "/scan-api/rpc"
  },
  storage: {
    deviceId: "mz_scan_device_id",
    messagingUserId: "mz_messaging_user_id",
    hiddenThreads: "mz_hidden_threads",
    queueDbName: "mz_scan_queue",
    queueStoreName: "actions"
  },
  polling: {
    attendanceMs: 30000,
    dashboardMs: 30000,
    eventsMs: 30000,
    messagesMs: 5000,
    threadMs: 2000,
    queueSyncMs: 10000,
    clockMs: 1000
  },
  devices: {
    dashboardDeviceId: "dashboard-display",
    canaryDeviceId: "canary-check",
    devFallbackDeviceId: "1e74fe4c-dc20b3b9"
  },
  assets: {
    dashboardAvatar: "./Dashboard_Avatar.webp?v=release-2026.04.25.1",
    memphisAvatar: "./memphis_avatar_optimized.webp?v=release-2026.04.25.1",
    schedulerIcon: "./scheduler_icon_optimized.webp?v=release-2026.04.25.1",
    eventIcon: "./Event_Icon_Optimized_Perfect.webp?v=release-2026.04.25.1",
    zooLogo: "./Zoo_Logo.png?v=release-2026.04.25.1",
    dashboardBg: "./dashboard-bg_optimized.webp?v=release-2026.04.22.8"
  },
  features: {
    enableMessaging: true,
    enableEvents: true,
    enableOfflineQueue: true,
    enableDebugPanel: true
  }
};
