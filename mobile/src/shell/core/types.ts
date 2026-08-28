export type AppEdition = 'manager' | 'custodial' | 'viewer';

export interface ShellRoute {
  id: string;
  path: `/${string}`;
  label: string;
  shortLabel: string;
  description: string;
  legacyTarget: string;
  navigation: boolean;
}

export interface EditionDefinition {
  edition: AppEdition;
  roleMarker: string;
  title: string;
  subtitle: string;
  homeRouteId: string;
  themeColor: string;
  routes: readonly ShellRoute[];
}

export type DeviceIdentitySource =
  | 'credential'
  | 'stored'
  | 'explicit'
  | 'fully'
  | 'generated'
  | 'unconfigured';

export interface DeviceIdentity {
  canonicalId: string;
  source: DeviceIdentitySource;
  configured: boolean;
  conflicts: readonly string[];
}

export interface DeviceIdentityInput {
  edition: AppEdition;
  credentialDeviceId?: string | null;
  storedDeviceIds?: readonly (string | null | undefined)[];
  explicitDeviceId?: string | null;
  fullyDeviceName?: string | null;
  fullyDeviceId?: string | null;
  generatedUuid?: string | null;
}

export type ExternalRouteResolution =
  | {
      kind: 'shell';
      routeId: string;
      path: string;
    }
  | {
      kind: 'legacy';
      routeId: string | null;
      target: string;
    };

export interface NetworkSnapshot {
  connected: boolean;
  connectionType: string;
}

export interface AuthSnapshot {
  state: 'authenticated' | 'enrolled' | 'unenrolled' | 'anonymous' | 'quarantined' | 'unavailable' | 'unknown';
  displayName: string;
  role: string;
  deviceId?: string;
  reason?: string;
}

export interface NotificationSnapshot {
  supported: boolean;
  permission: 'granted' | 'denied' | 'prompt' | 'unavailable';
}

export interface ReleaseIdentity {
  edition: AppEdition;
  buildId: string;
  sourceCommit: string;
  schemaVersion: number | null;
}

export interface RemovableListener {
  remove(): Promise<void> | void;
}

export interface RuntimePorts {
  platform: 'browser' | 'capacitor';
  auth: {
    read(): Promise<AuthSnapshot> | AuthSnapshot;
    headers(): Promise<Record<string, string>>;
  };
  deepLinks: {
    getLaunchUrl(): Promise<string | null>;
    addUrlListener(listener: (url: string) => void): Promise<RemovableListener>;
    addBackListener(listener: () => void): Promise<RemovableListener>;
    handleRootBack(edition: AppEdition): Promise<void>;
  };
  nfcTransitions: {
    report(stage: string, outcome: string): Promise<void>;
  };
  network: {
    getStatus(): Promise<NetworkSnapshot>;
    addListener(listener: (status: NetworkSnapshot) => void): Promise<RemovableListener>;
  };
  notifications: {
    read(): Promise<NotificationSnapshot>;
    install(): Promise<void>;
  };
}
