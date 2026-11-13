// Exact shared synthetic public browser ports from the existing phone-wake fixture; no hardware/private native ACK proof.
const DEVICE_ID='KIOSK_04';
async function installKioskRuntime(context, {
  session = null, resumeView = '', fullyDeviceId = DEVICE_ID, verifiedEntryIds = [],
  rollbackFenceId = '', nativeOccurrencePending = false,
} = {}) {
  await context.addInitScript(({ deviceId, nativeDeviceId, seededSession, view, entryIds, initialFenceId, initialNativeOccurrence }) => {
    window.fully = {
      bindings: {},
      bind(event, source) { this.bindings[event] = source; },
      getDeviceId() { return nativeDeviceId; },
      getDeviceName() { return 'TAMMY'; },
    };
    localStorage.setItem('mz_scan_device_id', deviceId);
    localStorage.setItem('mz_employee_hub_device_id', deviceId);
    localStorage.setItem('memphisAssignedDeviceId', deviceId);
    const attestations = new Map(entryIds.map((entryId) => [entryId, {
      schema_version: 'scan-entry-attestation.v1',
      entry_id: entryId,
      entry_source: 'native-nfc',
      device_id: deviceId,
      location_code: 'TETM',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      client_session_id: null,
      action: null,
    }]));
    const completionTime = (clientSessionId) => {
      const key = `mz_test_native_completion_time:${clientSessionId}`;
      const endedAt = localStorage.getItem(key) || new Date().toISOString();
      localStorage.setItem(key, endedAt);
      return endedAt;
    };
    window.MemphisMobile = {
      nativeOfflineTimeAuthority: false,
      readCustodialHomeCache: () => ({
        schema_version: 'custodial-home-cache.v3',
        device_id: deviceId,
        cached_at: new Date().toISOString(),
        profile: { authenticated: true, canonical_device_id: deviceId, employee_name: 'Tammy Miller' },
      }),
      saveOfflineScanAuthoritySnapshot: async (snapshot) => {
        if (window.__nativeRollbackFenceId || window.__nativeOccurrencePending === true) {
          const error = new Error('Protected Custodial device security is unavailable.');
          error.code = 'custodial_native_offline_anchor_refused';
          throw error;
        }
        localStorage.setItem(`mz_scan_authority_snapshot:${deviceId}`, JSON.stringify(snapshot));
        return true;
      },
      loadOfflineAuthoritySnapshot: async (requestedDeviceId) => {
        if (requestedDeviceId !== deviceId) throw new Error('The protected device identity is unavailable for offline work admission.');
        const snapshot = JSON.parse(localStorage.getItem(`mz_scan_authority_snapshot:${deviceId}`) || 'null');
        if (!snapshot) throw new Error('The protected offline authority snapshot is unavailable.');
        return snapshot;
      },
      authorizeOfflineNewWork: async (requestedDeviceId, snapshotId) => {
        const snapshot = JSON.parse(localStorage.getItem(`mz_scan_authority_snapshot:${deviceId}`) || 'null');
        if (requestedDeviceId !== deviceId || snapshot?.snapshot_id !== snapshotId) {
          throw new Error('The protected offline authority did not authorize new work.');
        }
        if (window.__nativeOccurrencePending === true) {
          const error = new Error('Protected Custodial device security is unavailable.');
          error.code = 'custodial_native_queue_admission_refused';
          throw error;
        }
        if (window.__nativeRollbackFenceId) {
          const error = new Error('Protected Custodial device security is unavailable.');
          error.code = 'custodial_native_rollback_fence_active';
          throw error;
        }
        return { authorized: true };
      },
      getOfflineAuthorityState: async () => ({
        occurrences_awaiting_acknowledgement: window.__nativeOccurrencePending === true,
        rollback_fence_active: Boolean(window.__nativeRollbackFenceId),
        rollback_fence_id: window.__nativeRollbackFenceId || null,
      }),
      beginRollbackFence: async () => {
        if (window.__nativeOccurrencePending === true) throw new Error('Native work is still pending.');
        window.__nativeRollbackFenceId ||= '55555555-5555-4555-8555-555555555555';
        return { rollback_fence_active: true, rollback_fence_id: window.__nativeRollbackFenceId };
      },
      clearRollbackFence: async (_requestedDeviceId, requestedFenceId) => {
        if (requestedFenceId !== window.__nativeRollbackFenceId) throw new Error('Rollback fence mismatch.');
        window.__sessionCountWhenFenceCleared = Object.keys(localStorage).filter((key) => key.startsWith('session:')).length;
        window.__rollbackFenceClearCount = Number(window.__rollbackFenceClearCount || 0) + 1;
        window.__nativeRollbackFenceId = '';
        return { cleared: true };
      },
      verifyScanEntryAttestation: async (entryId) => {
        const record = attestations.get(entryId);
        if (!record) throw new Error('The native scan handoff is missing or expired.');
        return { ...record };
      },
      bindScanEntryAttestation: async (entryId, clientSessionId, locationCode, action) => {
        const record = attestations.get(entryId);
        if (!record || record.location_code !== locationCode || !['start', 'finish'].includes(action)
          || (record.client_session_id && record.client_session_id !== clientSessionId)
          || (record.action && record.action !== action)) {
          throw new Error('The native scan handoff cannot be bound to this session.');
        }
        attestations.set(entryId, { ...record, client_session_id: clientSessionId, action });
        return true;
      },
      consumeScanEntryAttestation: async (entryId, clientSessionId, locationCode, action) => {
        const record = attestations.get(entryId);
        if (!record || record.client_session_id !== clientSessionId || record.location_code !== locationCode || record.action !== action) {
          throw new Error('The native scan handoff cannot be consumed by this session.');
        }
        attestations.delete(entryId);
        return true;
      },
      createOfflineStartAttestation: async (input) => {
        window.__nativeStartInput = input;
        if (input.originalNativeStartAttestationVersion || input.originalNativeStartAttestation) {
          if (input.originalNativeStartAttestationVersion !== 'custodial-native-start.v1'
            || !/^[a-f0-9]{64}$/.test(input.originalNativeStartAttestation || '')) {
            throw new Error('The frozen native start proof is incomplete.');
          }
          const storedSession = Object.keys(localStorage)
            .filter((key) => key.startsWith('session:'))
            .map((key) => JSON.parse(localStorage.getItem(key)))
            .find((row) => row.client_session_id === input.clientSessionId);
          if (!storedSession || storedSession.location_code !== input.locationCode
            || storedSession.entry_id !== input.nativeScanEntryId) {
            throw new Error('The protected occurrence cannot transport this start proof.');
          }
          return {
            p_client_started_at: storedSession.started_at,
            p_native_scan_entry_id: input.nativeScanEntryId,
            p_native_start_attestation_version: input.originalNativeStartAttestationVersion,
            p_native_start_attestation: input.originalNativeStartAttestation,
            p_native_start_transport_attestation_version: 'custodial-native-start-transport.v1',
            p_native_start_transport_attestation: 'c'.repeat(64),
            input,
          };
        }
        const record = attestations.get(input.nativeScanEntryId);
        if (!record || record.location_code !== input.locationCode || record.client_session_id
          || record.action) throw new Error('The native NFC handoff cannot authorize this start.');
        attestations.delete(input.nativeScanEntryId);
        return {
          p_client_started_at: new Date().toISOString(),
          p_native_scan_entry_id: input.nativeScanEntryId,
          p_native_start_attestation_version: 'custodial-native-start.v1',
          p_native_start_attestation: 'a'.repeat(64),
          input,
        };
      },
      captureOfflineCompletionTime: async (input) => {
        const record = attestations.get(input.nativeFinishScanEntryId);
        if (!record || record.client_session_id !== input.clientSessionId || record.action !== 'finish') {
          throw new Error('The native NFC finish handoff is missing.');
        }
        return {
          p_client_ended_at: completionTime(input.clientSessionId),
          p_native_finish_scan_entry_id: input.nativeFinishScanEntryId,
        };
      },
      createOfflineCompletionAttestation: async (input) => {
        const endedAt = completionTime(input.clientSessionId);
        const recovered = Boolean(input.originalNativeCompletionAttestationVersion || input.originalNativeCompletionAttestation);
        if (recovered && (input.originalNativeCompletionAttestationVersion !== 'custodial-native-completion.v2'
          || !/^[a-f0-9]{64}$/.test(input.originalNativeCompletionAttestation || ''))) {
          throw new Error('The frozen native completion proof is incomplete.');
        }
        return {
          p_client_ended_at: endedAt,
          p_native_finish_scan_entry_id: input.nativeFinishScanEntryId,
          p_native_completion_attestation_version: 'custodial-native-completion.v2',
          p_native_completion_attestation: recovered ? input.originalNativeCompletionAttestation : 'b'.repeat(64),
          ...(recovered ? {
            p_native_completion_transport_attestation_version: 'custodial-native-completion-transport.v1',
            p_native_completion_transport_attestation: 'd'.repeat(64),
          } : {}),
          input,
        };
      },
      acknowledgeOfflineCompletion: async (input) => {
        attestations.delete(input.nativeFinishScanEntryId);
        localStorage.setItem('mz_test_completion_acknowledgement', JSON.stringify(input));
        return { acknowledged: true };
      },
    };
    window.__nativeRollbackFenceId = initialFenceId;
    window.__nativeOccurrencePending = initialNativeOccurrence;
    window.__rollbackFenceClearCount = 0;
    const fixtureSeedKey = `test-original-session-seeded:${seededSession?.session_uuid||"none"}`;
    if (seededSession && !localStorage.getItem(fixtureSeedKey)) {
      localStorage.setItem(fixtureSeedKey,"1");
      localStorage.setItem(`session:${seededSession.session_uuid}`, JSON.stringify(seededSession));
      if (view) {
        localStorage.setItem(`mz_phone_scan_resume:${deviceId}`, JSON.stringify({
          session_uuid: seededSession.session_uuid,
          client_session_id: seededSession.client_session_id,
          device_id: deviceId,
          location_code: seededSession.location_code,
          view,
          saved_at: new Date().toISOString(),
        }));
      }
    }
  }, {
    deviceId: DEVICE_ID,
    nativeDeviceId: fullyDeviceId,
    seededSession: session,
    view: resumeView,
    entryIds: verifiedEntryIds,
    initialFenceId: rollbackFenceId,
    initialNativeOccurrence: nativeOccurrencePending,
  });
}


module.exports={installKioskRuntime};
