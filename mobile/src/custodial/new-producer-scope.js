// Immutable Source-owned release scope; no caller, URL, preference or environment switch.
export const CUSTODIAL_NEW_PRODUCER_SCOPE = "cleaning-first-retained-continuity-v1";
export function custodialNewProducerAdmissionsEnabled() {
  return CUSTODIAL_NEW_PRODUCER_SCOPE === 'full-system';
}
export function requireCustodialNewProducerAdmission() {
  if (!custodialNewProducerAdmissionsEnabled()) throw Object.assign(new Error('New admissions are deferred in this release scope.'), {code:'custodial_new_producer_scope_deferred'});
}
