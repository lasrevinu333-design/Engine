import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bindHardwareBackLifecycle,
  buildLegacyHandoffUrl,
  resolveHardwareBackAction,
} from './legacy-handoff';
import { measureViewport } from './viewport';
import { bindNetworkLifecycle } from '../providers/network';
import { bindDeepLinkLifecycle } from '../providers/deep-links';
import { managerDefinition } from '../roles/manager/routes';
import type { ExternalRouteResolution, NetworkSnapshot, RemovableListener, RuntimePorts } from './types';
import type { AuthSnapshot } from './types';
import { authSnapshotForRuntime, bindAuthLifecycle } from '../providers/auth';

describe('shell foundation contracts', () => {
  it('keeps compatibility handoffs on origin and injects enrolled Custodial identity', () => {
    expect(buildLegacyHandoffUrl(
      'https://localhost/app-shell.html?shell=proof#/today',
      './messages.html?hub=employee',
      'custodial',
      'kiosk-4',
    )).toBe('https://localhost/messages.html?hub=employee&device=KIOSK_04');
    expect(() => buildLegacyHandoffUrl(
      'https://localhost/app-shell.html',
      'https://attacker.example/private.html',
      'manager',
      'ops-app-1234567890123456',
    )).toThrow(/Unsafe compatibility target/);
    expect(buildLegacyHandoffUrl(
      'https://localhost/app-shell.html',
      './messages.html?hub=employee',
      'custodial',
      'manager-device',
    )).toBe('https://localhost/messages.html?hub=employee');
  });

  it('defines deterministic hardware Back behavior', () => {
    expect(resolveHardwareBackAction('manager.messages', 'manager.today')).toBe('pop');
    expect(resolveHardwareBackAction('manager.today', 'manager.today')).toBe('home');
  });

  it('derives keyboard occlusion from the visual viewport without guessed insets', () => {
    expect(measureViewport(915, 560, 0, 1)).toEqual({
      viewportHeight: 560,
      viewportOffsetTop: 0,
      keyboardHeight: 355,
      keyboardOpen: true,
      scale: 1,
    });
    expect(measureViewport(800, 800, 0, 2)).toEqual({
      viewportHeight: 800,
      viewportOffsetTop: 0,
      keyboardHeight: 0,
      keyboardOpen: false,
      scale: 2,
    });
  });
});

describe('native subscription failure ownership', () => {
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  };
  const offline: NetworkSnapshot = { connected: false, connectionType: 'none' };
  const online: NetworkSnapshot = { connected: true, connectionType: 'wifi' };
  const route = 'memphiszoo-manager://route/manager.schedule';
  const deepPorts = (
    overrides: Partial<RuntimePorts['deepLinks']> = {},
  ): RuntimePorts['deepLinks'] => ({
    getLaunchUrl: async () => null,
    addUrlListener: async () => ({ remove() {} }),
    addBackListener: async () => ({ remove() {} }),
    handleRootBack: async () => {},
    ...overrides,
  });
  const deepState = () => {
    let state = { ready: false, resolution: null as ExternalRouteResolution | null, sequence: 0 };
    const publish: Parameters<typeof bindDeepLinkLifecycle>[2] = vi.fn((update) => {
      state = update(state);
    });
    return { publish, read: () => state };
  };
  const expectFixedFailure = (report: ReturnType<typeof vi.fn>, message: string) => {
    expect(report).toHaveBeenCalledTimes(1);
    const error = report.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(message);
    expect(error.cause).toBeUndefined();
    expect(Object.keys(error)).toEqual([]);
  };

  it('contains a synchronous network read failure and reports only a fixed shell error', () => {
    const failures: Error[] = [];
    expect(() => bindNetworkLifecycle({
      getStatus: () => { throw new Error('UNIT_NATIVE_DETAIL'); },
      addListener: async () => ({ remove() {} }),
    }, () => {}, (error) => failures.push(error))).not.toThrow();
    expect(failures.map((error) => error.message)).toEqual(['Network setup failed.']);
  });

  it.each(['throw', 'reject'] as const)('contains active network read and registration failures: %s', async (mode) => {
    for (const operation of ['getStatus', 'addListener'] as const) {
      const publish = vi.fn();
      const report = vi.fn();
      const ports: RuntimePorts['network'] = {
        getStatus: async () => offline,
        addListener: async () => ({ remove() {} }),
      };
      const failure = () => {
        if (mode === 'throw') throw null;
        return Promise.reject('UNIT_NATIVE_DETAIL');
      };
      if (operation === 'getStatus') ports.getStatus = failure;
      else ports.addListener = failure;
      const close = bindNetworkLifecycle(ports, publish, report);
      await settle();
      expectFixedFailure(report, 'Network setup failed.');
      const before = publish.mock.calls.length;
      close();
      close();
      await settle();
      expect(publish).toHaveBeenCalledTimes(before);
      expect(report).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps ordinary offline and successful network events quiet and removes once', async () => {
    let emit!: (value: NetworkSnapshot) => void;
    const remove = vi.fn();
    const publish = vi.fn();
    const report = vi.fn();
    const close = bindNetworkLifecycle({
      getStatus: async () => offline,
      addListener: async (callback) => { emit = callback; return { remove }; },
    }, publish, report);
    await settle();
    emit(online);
    expect(publish.mock.calls).toEqual([[offline], [online]]);
    expect(report).not.toHaveBeenCalled();
    close();
    close();
    emit(offline);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('retains the first active network failure and removes a subsequently returned handle', async () => {
    const status = deferred<NetworkSnapshot>();
    const registration = deferred<RemovableListener>();
    const remove = vi.fn(() => Promise.reject('UNIT_CLEANUP_DETAIL'));
    let emit!: (value: NetworkSnapshot) => void;
    const report = vi.fn();
    const publish = vi.fn();
    const close = bindNetworkLifecycle({
      getStatus: () => status.promise,
      addListener: (callback) => { emit = callback; return registration.promise; },
    }, publish, report);
    status.reject('UNIT_READ_DETAIL');
    await settle();
    const first = report.mock.calls[0][0];
    registration.resolve({ remove });
    await settle();
    emit(online);
    close();
    expectFixedFailure(report, 'Network setup failed.');
    expect(report.mock.calls[0][0]).toBe(first);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it('suppresses both late network rejections after disposal', async () => {
    const status = deferred<NetworkSnapshot>();
    const registration = deferred<RemovableListener>();
    const report = vi.fn();
    const publish = vi.fn();
    const close = bindNetworkLifecycle({
      getStatus: () => status.promise,
      addListener: () => registration.promise,
    }, publish, report);
    close();
    status.reject(null);
    registration.reject('UNIT_LATE_DETAIL');
    await settle();
    expect(report).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it.each(['throw', 'reject'] as const)('does not replace an active network failure with established-handle cleanup: %s', async (mode) => {
    const status = deferred<NetworkSnapshot>();
    const remove = vi.fn(() => {
      if (mode === 'throw') throw null;
      return Promise.reject('UNIT_CLEANUP_DETAIL');
    });
    let emit!: (value: NetworkSnapshot) => void;
    const report = vi.fn();
    const publish = vi.fn();
    const close = bindNetworkLifecycle({
      getStatus: () => status.promise,
      addListener: async (callback) => { emit = callback; return { remove }; },
    }, publish, report);
    await settle();
    status.reject('UNIT_PRIMARY_DETAIL');
    await settle();
    expectFixedFailure(report, 'Network setup failed.');
    emit(online);
    close();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it('ignores a disposed network instance while its replacement publishes real offline data', async () => {
    const oldRead = deferred<NetworkSnapshot>();
    const oldRegistration = deferred<RemovableListener>();
    const oldPublish = vi.fn();
    const oldReport = vi.fn();
    const closeOld = bindNetworkLifecycle({
      getStatus: () => oldRead.promise,
      addListener: () => oldRegistration.promise,
    }, oldPublish, oldReport);
    closeOld();
    const currentPublish = vi.fn();
    const currentReport = vi.fn();
    const closeCurrent = bindNetworkLifecycle({
      getStatus: async () => offline,
      addListener: async () => ({ remove() {} }),
    }, currentPublish, currentReport);
    oldRead.reject('UNIT_RETIRED_READ');
    oldRegistration.reject('UNIT_RETIRED_REGISTRATION');
    await settle();
    expect(oldPublish).not.toHaveBeenCalled();
    expect(oldReport).not.toHaveBeenCalled();
    expect(currentPublish.mock.calls).toEqual([[offline]]);
    expect(currentReport).not.toHaveBeenCalled();
    closeCurrent();
  });

  it.each(['throw', 'reject'] as const)('contains late network handle cleanup: %s', async (mode) => {
    const status = deferred<NetworkSnapshot>();
    const registration = deferred<RemovableListener>();
    const remove = vi.fn(() => {
      if (mode === 'throw') throw null;
      return Promise.reject('UNIT_REMOVE_DETAIL');
    });
    const publish = vi.fn();
    const report = vi.fn();
    const close = bindNetworkLifecycle({
      getStatus: () => status.promise,
      addListener: () => registration.promise,
    }, publish, report);
    close();
    status.resolve(online);
    registration.resolve({ remove });
    await settle();
    close();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it.each(['throw', 'reject'] as const)('contains active deep-link registration failure: %s', async (mode) => {
    const launch = deferred<string | null>();
    const state = deepState();
    const report = vi.fn();
    const close = bindDeepLinkLifecycle(deepPorts({
      getLaunchUrl: () => launch.promise,
      addUrlListener: () => {
        if (mode === 'throw') throw null;
        return Promise.reject('UNIT_REGISTRATION_DETAIL');
      },
    }), managerDefinition, state.publish, report);
    await settle();
    launch.resolve(route);
    await settle();
    expectFixedFailure(report, 'Deep-link setup failed.');
    expect(state.publish).not.toHaveBeenCalled();
    close();
  });

  it.each(['throw', 'reject'] as const)('preserves the launch-URL fallback without inventing a route: %s', async (mode) => {
    const state = deepState();
    const report = vi.fn();
    const remove = vi.fn();
    const close = bindDeepLinkLifecycle(deepPorts({
      getLaunchUrl: () => {
        if (mode === 'throw') throw null;
        return Promise.reject('UNIT_LAUNCH_DETAIL');
      },
      addUrlListener: async () => ({ remove }),
    }), managerDefinition, state.publish, report);
    await settle();
    expect(state.read()).toEqual({ ready: true, resolution: null, sequence: 0 });
    expect(report).not.toHaveBeenCalled();
    close();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('uses the existing route normalizer for launch and listener events only while active', async () => {
    let emit!: (url: string) => void;
    const state = deepState();
    const report = vi.fn();
    const remove = vi.fn();
    const close = bindDeepLinkLifecycle(deepPorts({
      getLaunchUrl: async () => route,
      addUrlListener: async (callback) => { emit = callback; return { remove }; },
    }), managerDefinition, state.publish, report);
    await settle();
    expect(state.read()).toEqual({
      ready: true, sequence: 1,
      resolution: { kind: 'shell', routeId: 'manager.schedule', path: '/schedule' },
    });
    emit('https://attacker.example/private');
    expect(state.read().sequence).toBe(1);
    emit('memphiszoo-manager://route/manager.today');
    expect(state.read().sequence).toBe(2);
    expect(state.read().resolution).toEqual({ kind: 'shell', routeId: 'manager.today', path: '/today' });
    close();
    close();
    emit(route);
    expect(state.read().sequence).toBe(2);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(report).not.toHaveBeenCalled();
  });

  it.each(['throw', 'reject'] as const)('suppresses retired deep-link updates and contains late handle cleanup: %s', async (mode) => {
    const launch = deferred<string | null>();
    const registration = deferred<RemovableListener>();
    let emit!: (url: string) => void;
    const remove = vi.fn(() => {
      if (mode === 'throw') throw null;
      return Promise.reject('UNIT_LATE_REMOVE_DETAIL');
    });
    const state = deepState();
    const report = vi.fn();
    const close = bindDeepLinkLifecycle(deepPorts({
      getLaunchUrl: () => launch.promise,
      addUrlListener: (callback) => { emit = callback; return registration.promise; },
    }), managerDefinition, state.publish, report);
    close();
    launch.resolve(route);
    registration.resolve({ remove });
    await settle();
    emit(route);
    close();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(state.publish).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  it('ignores disposed deep-link failures while a distinct replacement remains current', async () => {
    const launch = deferred<string | null>();
    const registration = deferred<RemovableListener>();
    const oldState = deepState();
    const oldReport = vi.fn();
    const closeOld = bindDeepLinkLifecycle(deepPorts({
      getLaunchUrl: () => launch.promise,
      addUrlListener: () => registration.promise,
    }), managerDefinition, oldState.publish, oldReport);
    closeOld();
    const currentState = deepState();
    const currentReport = vi.fn();
    const closeCurrent = bindDeepLinkLifecycle(deepPorts({ getLaunchUrl: async () => route }),
      managerDefinition, currentState.publish, currentReport);
    launch.reject('UNIT_OLD_LAUNCH');
    registration.reject('UNIT_OLD_REGISTRATION');
    await settle();
    expect(oldState.publish).not.toHaveBeenCalled();
    expect(oldReport).not.toHaveBeenCalled();
    expect(currentState.read().sequence).toBe(1);
    expect(currentReport).not.toHaveBeenCalled();
    closeCurrent();
  });

  it.each(['throw', 'reject'] as const)('contains settled listener teardown errors for both providers: %s', async (mode) => {
    const removeNetwork = vi.fn(() => {
      if (mode === 'throw') throw 'UNIT_REMOVE_DETAIL';
      return Promise.reject(null);
    });
    const removeDeep = vi.fn(() => {
      if (mode === 'throw') throw 'UNIT_REMOVE_DETAIL';
      return Promise.reject(null);
    });
    const networkReport = vi.fn();
    const deepReport = vi.fn();
    const closeNetwork = bindNetworkLifecycle({
      getStatus: async () => offline,
      addListener: async () => ({ remove: removeNetwork }),
    }, vi.fn(), networkReport);
    const closeDeep = bindDeepLinkLifecycle(deepPorts({
      addUrlListener: async () => ({ remove: removeDeep }),
    }), managerDefinition, deepState().publish, deepReport);
    await settle();
    closeNetwork();
    closeDeep();
    closeNetwork();
    closeDeep();
    await settle();
    expect(removeNetwork).toHaveBeenCalledTimes(1);
    expect(removeDeep).toHaveBeenCalledTimes(1);
    expect(networkReport).not.toHaveBeenCalled();
    expect(deepReport).not.toHaveBeenCalled();
  });
});

describe('auth runtime display ownership', () => {
  type Observation = Parameters<Parameters<typeof bindAuthLifecycle>[1]>[0];
  const previousPrincipal: AuthSnapshot = Object.freeze({
    state: 'authenticated', displayName: 'UNIT previous principal', role: 'UNIT_PREVIOUS_ROLE',
  });
  const nextPrincipal: AuthSnapshot = Object.freeze({
    state: 'enrolled', displayName: 'UNIT next principal', role: 'UNIT_NEXT_ROLE',
  });
  const unknownSnapshot: AuthSnapshot = { state: 'unknown', displayName: '', role: '' };
  const runtimeWithRead = (read: RuntimePorts['auth']['read']): RuntimePorts => {
    const unused = () => { throw new Error('UNIT unexpected non-read port'); };
    return {
      platform: 'browser',
      auth: { read, headers: unused },
      deepLinks: { getLaunchUrl: unused, addUrlListener: unused, addBackListener: unused, handleRootBack: unused },
      network: { getStatus: unused, addListener: unused },
      notifications: { read: unused, install: unused },
    };
  };
  const observations = () => {
    let latest: Observation | null = null;
    const publish = vi.fn((next: Observation) => { latest = next; });
    return { publish, latest: () => latest };
  };
  const pendingRead = () => {
    let resolve!: (snapshot: AuthSnapshot) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<AuthSnapshot>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  };
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('immediately hides a prior runtime snapshot before successor read or setup', async () => {
    const source = observations();
    const previous = runtimeWithRead(() => previousPrincipal);
    const successorRead = vi.fn(() => new Promise<AuthSnapshot>(() => {}));
    const successor = runtimeWithRead(successorRead);
    const close = bindAuthLifecycle(previous, source.publish);
    await Promise.resolve();
    expect(authSnapshotForRuntime(previous, source.latest())).toBe(previousPrincipal);
    expect(authSnapshotForRuntime(successor, source.latest())).toBeNull();
    expect(successorRead).not.toHaveBeenCalled();
    close();
  });

  it('contains a synchronous read throw under the existing unknown fallback', () => {
    const source = observations();
    const read = vi.fn(() => { throw new Error('UNIT native detail'); });
    const runtime = runtimeWithRead(read);
    let close: (() => void) | undefined;
    expect(() => { close = bindAuthLifecycle(runtime, source.publish); }).not.toThrow();
    expect(authSnapshotForRuntime(runtime, source.latest())).toEqual(unknownSnapshot);
    expect(read).toHaveBeenCalledTimes(1);
    close?.();
  });

  it('keeps the original 3000ms pending-to-unknown fallback and permits its same live read to finish', async () => {
    const pending = pendingRead();
    const read = vi.fn(() => pending.promise);
    const runtime = runtimeWithRead(read);
    const source = observations();
    const close = bindAuthLifecycle(runtime, source.publish);
    expect(authSnapshotForRuntime(runtime, source.latest())).toBeNull();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(2_999);
    expect(authSnapshotForRuntime(runtime, source.latest())).toBeNull();
    vi.advanceTimersByTime(1);
    expect(authSnapshotForRuntime(runtime, source.latest())).toEqual(unknownSnapshot);
    expect(vi.getTimerCount()).toBe(0);
    pending.resolve(nextPrincipal);
    await Promise.resolve();
    expect(authSnapshotForRuntime(runtime, source.latest())).toBe(nextPrincipal);
    vi.advanceTimersByTime(3_000);
    expect(authSnapshotForRuntime(runtime, source.latest())).toBe(nextPrincipal);
    expect(read).toHaveBeenCalledTimes(1);
    close();
  });

  it.each([
    'authenticated', 'enrolled', 'unenrolled', 'anonymous', 'quarantined', 'unavailable', 'unknown',
  ] as const)('retains the exact live successful AuthSnapshot without role or readiness reinterpretation: %s', async (state) => {
    const snapshot: AuthSnapshot = Object.freeze({
      state, displayName: 'UNIT exact display', role: 'UNIT exact role',
      deviceId: 'UNIT device DATA', reason: 'UNIT reason DATA',
    });
    const read = vi.fn(async () => snapshot);
    const runtime = runtimeWithRead(read);
    const source = observations();
    const close = bindAuthLifecycle(runtime, source.publish);
    expect(authSnapshotForRuntime(runtime, source.latest())).toBeNull();
    await Promise.resolve();
    expect(authSnapshotForRuntime(runtime, source.latest())).toBe(snapshot);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(3_000);
    expect(authSnapshotForRuntime(runtime, source.latest())).toBe(snapshot);
    expect(read).toHaveBeenCalledTimes(1);
    close();
  });

  it.each([null, false, 'UNIT rejected native detail'])('contains active async rejection without exposing its payload: %s', async (reason) => {
    const read = vi.fn(() => Promise.reject(reason));
    const runtime = runtimeWithRead(read);
    const source = observations();
    const close = bindAuthLifecycle(runtime, source.publish);
    await Promise.resolve();
    await Promise.resolve();
    expect(authSnapshotForRuntime(runtime, source.latest())).toEqual(unknownSnapshot);
    expect(vi.getTimerCount()).toBe(0);
    expect(read).toHaveBeenCalledTimes(1);
    close();
  });

  it.each(['resolve', 'reject'] as const)('does not publish a disposed read or timer: %s', async (outcome) => {
    const pending = pendingRead();
    const read = vi.fn(() => pending.promise);
    const runtime = runtimeWithRead(read);
    const source = observations();
    const close = bindAuthLifecycle(runtime, source.publish);
    const originalObservation = source.latest();
    const countBeforeClose = source.publish.mock.calls.length;
    close();
    close();
    expect(vi.getTimerCount()).toBe(0);
    if (outcome === 'resolve') pending.resolve(previousPrincipal);
    else pending.reject('UNIT retired read detail');
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(3_000);
    expect(source.publish).toHaveBeenCalledTimes(countBeforeClose);
    expect(authSnapshotForRuntime(runtime, originalObservation)).toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('keeps a successor pending until its own result and clears only the retired instance timer', async () => {
    const previousPending = pendingRead();
    const nextPending = pendingRead();
    const previousRead = vi.fn(() => previousPending.promise);
    const nextRead = vi.fn(() => nextPending.promise);
    const previous = runtimeWithRead(previousRead);
    const successor = runtimeWithRead(nextRead);
    const source = observations();
    const closePrevious = bindAuthLifecycle(previous, source.publish);
    closePrevious();
    const closeSuccessor = bindAuthLifecycle(successor, source.publish);
    expect(vi.getTimerCount()).toBe(1);
    previousPending.resolve(previousPrincipal);
    await Promise.resolve();
    closePrevious();
    expect(vi.getTimerCount()).toBe(1);
    expect(authSnapshotForRuntime(successor, source.latest())).toBeNull();
    expect(authSnapshotForRuntime(previous, source.latest())).toBeNull();
    vi.advanceTimersByTime(3_000);
    expect(authSnapshotForRuntime(successor, source.latest())).toEqual(unknownSnapshot);
    nextPending.resolve(nextPrincipal);
    await Promise.resolve();
    expect(authSnapshotForRuntime(successor, source.latest())).toBe(nextPrincipal);
    expect(previousRead).toHaveBeenCalledTimes(1);
    expect(nextRead).toHaveBeenCalledTimes(1);
    closeSuccessor();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not resurrect a completed identity when cleanup and recreation reuse the same runtime object', async () => {
    const pending = pendingRead();
    const read = vi.fn<RuntimePorts['auth']['read']>()
      .mockReturnValueOnce(previousPrincipal)
      .mockReturnValueOnce(pending.promise);
    const runtime = runtimeWithRead(read);
    const source = observations();
    const closeFirst = bindAuthLifecycle(runtime, source.publish);
    await Promise.resolve();
    const firstObservation = source.latest();
    expect(authSnapshotForRuntime(runtime, firstObservation)).toBe(previousPrincipal);
    closeFirst();
    expect(authSnapshotForRuntime(runtime, firstObservation)).toBeNull();
    const closeSecond = bindAuthLifecycle(runtime, source.publish);
    expect(authSnapshotForRuntime(runtime, firstObservation)).toBeNull();
    expect(authSnapshotForRuntime(runtime, source.latest())).toBeNull();
    pending.resolve(nextPrincipal);
    await Promise.resolve();
    expect(authSnapshotForRuntime(runtime, source.latest())).toBe(nextPrincipal);
    expect(authSnapshotForRuntime(runtime, firstObservation)).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
    closeSecond();
  });

  it.each(['resolve', 'reject'] as const)('ignores the old pending read after same-runtime cleanup and recreation: %s', async (outcome) => {
    const first = pendingRead();
    const second = pendingRead();
    const read = vi.fn<RuntimePorts['auth']['read']>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const runtime = runtimeWithRead(read);
    const source = observations();
    const closeFirst = bindAuthLifecycle(runtime, source.publish);
    closeFirst();
    const closeSecond = bindAuthLifecycle(runtime, source.publish);
    second.resolve(nextPrincipal);
    await Promise.resolve();
    const currentObservation = source.latest();
    expect(authSnapshotForRuntime(runtime, currentObservation)).toBe(nextPrincipal);
    if (outcome === 'resolve') first.resolve(previousPrincipal);
    else first.reject('UNIT old same-runtime read');
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(3_000);
    expect(source.latest()).toBe(currentObservation);
    expect(authSnapshotForRuntime(runtime, source.latest())).toBe(nextPrincipal);
    expect(read).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    closeSecond();
  });

  it('rejects an already-queued retired timer callback without altering the successor timer', async () => {
    const schedule = vi.spyOn(globalThis, 'setTimeout');
    const firstPending = pendingRead();
    const secondPending = pendingRead();
    const first = runtimeWithRead(() => firstPending.promise);
    const second = runtimeWithRead(() => secondPending.promise);
    const source = observations();
    const closeFirst = bindAuthLifecycle(first, source.publish);
    const queuedCallback = schedule.mock.calls[0][0];
    closeFirst();
    const closeSecond = bindAuthLifecycle(second, source.publish);
    const currentObservation = source.latest();
    if (typeof queuedCallback !== 'function') throw new Error('Expected the actual scheduled callback');
    queuedCallback();
    expect(source.latest()).toBe(currentObservation);
    expect(authSnapshotForRuntime(second, source.latest())).toBeNull();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(3_000);
    expect(authSnapshotForRuntime(second, source.latest())).toEqual(unknownSnapshot);
    closeSecond();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears a successful read timer only once even after repeated disposal', async () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const runtime = runtimeWithRead(() => previousPrincipal);
    const source = observations();
    const close = bindAuthLifecycle(runtime, source.publish);
    await Promise.resolve();
    expect(authSnapshotForRuntime(runtime, source.latest())).toBe(previousPrincipal);
    expect(clear).toHaveBeenCalledTimes(1);
    close();
    close();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('never clears an expired fallback timer after its live late result or disposal', async () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const pending = pendingRead();
    const runtime = runtimeWithRead(() => pending.promise);
    const source = observations();
    const close = bindAuthLifecycle(runtime, source.publish);
    vi.advanceTimersByTime(3_000);
    expect(authSnapshotForRuntime(runtime, source.latest())).toEqual(unknownSnapshot);
    pending.resolve(nextPrincipal);
    await Promise.resolve();
    expect(authSnapshotForRuntime(runtime, source.latest())).toBe(nextPrincipal);
    close();
    close();
    expect(clear).not.toHaveBeenCalled();
  });
});

describe('hardware Back lifecycle ownership', () => {
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  const backOptions = () => ({
    deepLinks: {
      addBackListener: vi.fn<RuntimePorts['deepLinks']['addBackListener']>(async () => ({ remove() {} })),
      handleRootBack: vi.fn<RuntimePorts['deepLinks']['handleRootBack']>(async () => {}),
    },
    currentRouteId: 'manager.schedule',
    homeRouteId: 'manager.today',
    edition: managerDefinition.edition,
    onBack: vi.fn<() => void>(),
    isCurrent: () => true,
    reportFailure: vi.fn<(error: Error) => void>(),
  });
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  };
  const expectFixedFailure = (report: ReturnType<typeof backOptions>['reportFailure']) => {
    expect(report).toHaveBeenCalledTimes(1);
    const error = report.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Hardware Back failed.');
    expect(error.cause).toBeUndefined();
    expect(Object.keys(error)).toEqual([]);
  };

  it('contains a synchronous native Back registration failure', () => {
    const options = backOptions();
    options.deepLinks.addBackListener.mockImplementation(() => { throw new Error('UNIT native detail'); });
    let close: (() => void) | undefined;
    expect(() => { close = bindHardwareBackLifecycle(options); }).not.toThrow();
    expect(options.reportFailure).toHaveBeenCalledTimes(1);
    expect(options.reportFailure.mock.calls[0][0].message).toBe('Hardware Back failed.');
    close?.();
  });

  it('refuses a previous route callback before passive listener cleanup', async () => {
    const options = backOptions();
    let current = true;
    options.isCurrent = () => current;
    const close = bindHardwareBackLifecycle(options);
    await settle();
    current = false;
    options.deepLinks.addBackListener.mock.calls[0][0]();
    expect(options.onBack).not.toHaveBeenCalled();
    expect(options.deepLinks.handleRootBack).not.toHaveBeenCalled();
    expect(options.reportFailure).not.toHaveBeenCalled();
    close();
  });

  it('contains an active rejected native registration without a retry or native action', async () => {
    const options = backOptions();
    options.deepLinks.addBackListener.mockRejectedValue('UNIT native registration detail');
    const close = bindHardwareBackLifecycle(options);
    await settle();
    expectFixedFailure(options.reportFailure);
    expect(options.deepLinks.addBackListener).toHaveBeenCalledTimes(1);
    expect(options.onBack).not.toHaveBeenCalled();
    expect(options.deepLinks.handleRootBack).not.toHaveBeenCalled();
    close();
    close();
    expect(options.reportFailure).toHaveBeenCalledTimes(1);
  });

  it.each(['manager', 'custodial', 'viewer'] as const)('preserves normal home Back behavior for the original edition: %s', async (edition) => {
    const options = backOptions();
    const remove = vi.fn();
    options.edition = edition;
    options.currentRouteId = options.homeRouteId;
    options.deepLinks.addBackListener.mockResolvedValue({ remove });
    const close = bindHardwareBackLifecycle(options);
    await settle();
    const emit = options.deepLinks.addBackListener.mock.calls[0][0];
    emit();
    await settle();
    expect(options.deepLinks.handleRootBack.mock.calls).toEqual([[edition]]);
    expect(options.onBack).not.toHaveBeenCalled();
    expect(options.reportFailure).not.toHaveBeenCalled();
    close();
    close();
    emit();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(options.deepLinks.handleRootBack).toHaveBeenCalledTimes(1);
    expect(options.deepLinks.addBackListener).toHaveBeenCalledTimes(1);
  });

  it('preserves detail pop callback behavior and never invokes the native home action', async () => {
    const options = backOptions();
    const remove = vi.fn();
    options.deepLinks.addBackListener.mockResolvedValue({ remove });
    const close = bindHardwareBackLifecycle(options);
    await settle();
    const emit = options.deepLinks.addBackListener.mock.calls[0][0];
    emit();
    emit();
    await settle();
    expect(options.onBack).toHaveBeenCalledTimes(2);
    expect(options.deepLinks.handleRootBack).not.toHaveBeenCalled();
    expect(options.reportFailure).not.toHaveBeenCalled();
    close();
    emit();
    expect(options.onBack).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(options.deepLinks.addBackListener).toHaveBeenCalledTimes(1);
  });

  it.each(['throw', 'reject'] as const)('contains an active native root action failure and preserves it over cleanup failure: %s', async (mode) => {
    const options = backOptions();
    options.currentRouteId = options.homeRouteId;
    const remove = vi.fn(() => {
      if (mode === 'throw') throw 'UNIT cleanup detail';
      return Promise.reject('UNIT cleanup detail');
    });
    options.deepLinks.addBackListener.mockResolvedValue({ remove });
    options.deepLinks.handleRootBack.mockImplementation(() => {
      if (mode === 'throw') throw null;
      return Promise.reject('UNIT native action detail');
    });
    const close = bindHardwareBackLifecycle(options);
    await settle();
    const emit = options.deepLinks.addBackListener.mock.calls[0][0];
    expect(() => emit()).not.toThrow();
    await settle();
    expectFixedFailure(options.reportFailure);
    const first = options.reportFailure.mock.calls[0][0];
    emit();
    close();
    close();
    await settle();
    expect(options.reportFailure.mock.calls[0][0]).toBe(first);
    expect(options.reportFailure).toHaveBeenCalledTimes(1);
    expect(options.deepLinks.handleRootBack).toHaveBeenCalledTimes(1);
    expect(options.onBack).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it.each(['throw', 'reject'] as const)('contains a failing original pop callback without invoking native home: %s', async (mode) => {
    const options = backOptions();
    const remove = vi.fn();
    options.deepLinks.addBackListener.mockResolvedValue({ remove });
    options.onBack.mockImplementation(() => {
      if (mode === 'throw') throw false;
      return Promise.reject('UNIT pop callback detail');
    });
    const close = bindHardwareBackLifecycle(options);
    await settle();
    const emit = options.deepLinks.addBackListener.mock.calls[0][0];
    expect(() => emit()).not.toThrow();
    await settle();
    expectFixedFailure(options.reportFailure);
    emit();
    close();
    expect(options.onBack).toHaveBeenCalledTimes(1);
    expect(options.deepLinks.handleRootBack).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it.each(['throw', 'reject'] as const)('removes a handle arriving after disposal exactly once despite cleanup failure: %s', async (mode) => {
    const options = backOptions();
    const registration = deferred<RemovableListener>();
    const remove = vi.fn(() => {
      if (mode === 'throw') throw null;
      return Promise.reject('UNIT late cleanup detail');
    });
    options.deepLinks.addBackListener.mockReturnValue(registration.promise);
    const close = bindHardwareBackLifecycle(options);
    const emit = options.deepLinks.addBackListener.mock.calls[0][0];
    close();
    registration.resolve({ remove });
    await settle();
    emit();
    close();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(options.onBack).not.toHaveBeenCalled();
    expect(options.deepLinks.handleRootBack).not.toHaveBeenCalled();
    expect(options.reportFailure).not.toHaveBeenCalled();
  });

  it('ignores a rejected registration from a disposed instance', async () => {
    const options = backOptions();
    const registration = deferred<RemovableListener>();
    options.deepLinks.addBackListener.mockReturnValue(registration.promise);
    const close = bindHardwareBackLifecycle(options);
    close();
    registration.reject('UNIT retired registration detail');
    await settle();
    expect(options.reportFailure).not.toHaveBeenCalled();
    expect(options.onBack).not.toHaveBeenCalled();
    expect(options.deepLinks.handleRootBack).not.toHaveBeenCalled();
  });

  it.each(['dispose', 'replace'] as const)('ignores an already-dispatched root action rejection after its instance retires: %s', async (retirement) => {
    const options = backOptions();
    options.currentRouteId = options.homeRouteId;
    let current = true;
    options.isCurrent = () => current;
    const action = deferred<void>();
    const remove = vi.fn();
    options.deepLinks.addBackListener.mockResolvedValue({ remove });
    options.deepLinks.handleRootBack.mockReturnValue(action.promise);
    const close = bindHardwareBackLifecycle(options);
    await settle();
    const emit = options.deepLinks.addBackListener.mock.calls[0][0];
    emit();
    expect(options.deepLinks.handleRootBack).toHaveBeenCalledTimes(1);
    if (retirement === 'dispose') close();
    else current = false;
    action.reject('UNIT old action detail');
    await settle();
    emit();
    expect(options.reportFailure).not.toHaveBeenCalled();
    expect(options.deepLinks.handleRootBack).toHaveBeenCalledTimes(1);
    close();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('removes a late previous-route handle and leaves its replacement callback operational', async () => {
    const previous = backOptions();
    const registration = deferred<RemovableListener>();
    previous.deepLinks.addBackListener.mockReturnValue(registration.promise);
    let current = true;
    previous.isCurrent = () => current;
    const closePrevious = bindHardwareBackLifecycle(previous);
    current = false;
    const successor = backOptions();
    const closeSuccessor = bindHardwareBackLifecycle(successor);
    const remove = vi.fn();
    registration.resolve({ remove });
    await settle();
    previous.deepLinks.addBackListener.mock.calls[0][0]();
    successor.deepLinks.addBackListener.mock.calls[0][0]();
    expect(previous.onBack).not.toHaveBeenCalled();
    expect(previous.reportFailure).not.toHaveBeenCalled();
    expect(successor.onBack).toHaveBeenCalledTimes(1);
    expect(successor.reportFailure).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
    closePrevious();
    closeSuccessor();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('retains the first callback failure when the registration handle arrives later', async () => {
    const options = backOptions();
    const registration = deferred<RemovableListener>();
    options.deepLinks.addBackListener.mockReturnValue(registration.promise);
    options.onBack.mockImplementation(() => { throw new Error('UNIT primary pop detail'); });
    const close = bindHardwareBackLifecycle(options);
    const emit = options.deepLinks.addBackListener.mock.calls[0][0];
    emit();
    expectFixedFailure(options.reportFailure);
    const first = options.reportFailure.mock.calls[0][0];
    const remove = vi.fn(() => Promise.reject('UNIT secondary cleanup detail'));
    registration.resolve({ remove });
    await settle();
    emit();
    close();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(options.reportFailure).toHaveBeenCalledTimes(1);
    expect(options.reportFailure.mock.calls[0][0]).toBe(first);
    expect(options.onBack).toHaveBeenCalledTimes(1);
  });

  it.each(['throw', 'reject'] as const)('contains settled handle teardown without creating an active failure: %s', async (mode) => {
    const options = backOptions();
    const remove = vi.fn(() => {
      if (mode === 'throw') throw 'UNIT remove detail';
      return Promise.reject('UNIT remove detail');
    });
    options.deepLinks.addBackListener.mockResolvedValue({ remove });
    const close = bindHardwareBackLifecycle(options);
    await settle();
    close();
    close();
    await settle();
    options.deepLinks.addBackListener.mock.calls[0][0]();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(options.reportFailure).not.toHaveBeenCalled();
    expect(options.onBack).not.toHaveBeenCalled();
    expect(options.deepLinks.handleRootBack).not.toHaveBeenCalled();
  });
});
