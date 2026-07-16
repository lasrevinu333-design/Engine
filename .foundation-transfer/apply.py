from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path.cwd()
OLD_RELEASE = 'release-2026.07.15.device-credentials.1'
NEW_RELEASE = 'release-2026.07.16.foundation-repair.1'


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one replacement target, found {count}')
    target.write_text(text.replace(old, new, 1), encoding='utf-8')


def replace_release(path: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    count = text.count(OLD_RELEASE)
    if count < 1:
        raise SystemExit(f'{path}: no old release references found')
    target.write_text(text.replace(OLD_RELEASE, NEW_RELEASE), encoding='utf-8')


for relative in [
    'device-security.html',
    'employee-hub.html',
    'employee-schedule.html',
    'events.html',
    'index.html',
    'memphis-device-identity.js',
    'messages.html',
    'start_page1.html',
    'thread.html',
]:
    replace_release(relative)

replace_once(
    'index.html',
    "function getFullyDeviceId(){const shared=window.MemphisDeviceIdentity?.resolveFullyIdentifier?.();if(shared)return shared;try{if(window.fully){for(const method of ['getDeviceId','getSerialNumber','getMacAddress','getDeviceName']){if(typeof fully[method]==='function'){const value=String(fully[method]()||'').trim();if(window.MemphisDeviceIdentity?.isPlausible?.(value))return value}}}}catch(err){console.warn('Fully device detection failed',err)}return'';}",
    "function getFullyDeviceId(){const shared=window.MemphisDeviceIdentity?.resolveFullyIdentifier?.();if(shared)return shared;try{if(window.fully){const candidates=[];for(const method of ['getDeviceId','getSerialNumber','getMacAddress','getDeviceName']){if(typeof fully[method]!=='function')continue;const raw=String(fully[method]()||'').trim();const value=normalizeDeviceIdentifier(raw);if(!value)continue;const plausible=window.MemphisDeviceIdentity?.isPlausible?.(value)??(/^KIOSK_(?:0[1-9]|10)$/i.test(value)||/^[a-z0-9]{6,}-[a-z0-9]{6,}$/i.test(value));if(plausible)candidates.push(value)}const canonical=candidates.find((value)=>/^KIOSK_(?:0[1-9]|10)$/i.test(value));if(canonical)return canonical;return candidates[0]||''}}catch(err){console.warn('Fully device detection failed',err)}return'';}",
)
replace_once(
    'index.html',
    'function getFullyDeviceId(){try{if(window.fully){if(typeof fully.getDeviceName==="function"){const name=String(fully.getDeviceName()||"").trim();if(name)return name}if(typeof fully.getDeviceId==="function"){const id=String(fully.getDeviceId()||"").trim();if(id)return id}if(typeof fully.getSerialNumber==="function"){const serial=String(fully.getSerialNumber()||"").trim();if(serial)return serial}if(typeof fully.getMacAddress==="function"){const mac=String(fully.getMacAddress()||"").trim();if(mac)return mac}}}catch(err){console.warn("Fully device detection failed",err)}return""}',
    '',
)
replace_once(
    'memphis-device-identity.js',
    """    return [
      {value:callFully('getDeviceName'),source:'fully_device_name'},
      {value:callFully('getDeviceId'),source:'fully_device_id'},
      {value:callFully('getSerialNumber'),source:'fully_serial'},
      {value:callFully('getMacAddress'),source:'fully_mac'},
    ].filter((candidate)=>isPlausible(candidate.value));""",
    """    return [
      {value:callFully('getDeviceId'),source:'fully_device_id'},
      {value:callFully('getSerialNumber'),source:'fully_serial'},
      {value:callFully('getMacAddress'),source:'fully_mac'},
      {value:callFully('getDeviceName'),source:'fully_device_name'},
    ].filter((candidate)=>isPlausible(candidate.value));""",
)
replace_once(
    'memphis-device-identity.js',
    """      banner.hidden=!(credentialStatus&&credentialStatus.enrollment_required&&!credentialStatus.authenticated);
      if(!banner.hidden&&credentialStatus?.canonical_device_id){
        banner.textContent=`Secure ${credentialStatus.canonical_device_id}${credentialStatus.employee_name?` · ${credentialStatus.employee_name}`:''} — tap to enroll`;
      }""",
    """      const enrollmentNeeded=Boolean(credentialStatus&&credentialStatus.enrollment_required&&!credentialStatus.authenticated);
      banner.hidden=!enrollmentNeeded;
      if(!enrollmentNeeded&&overlay){
        overlay.hidden=true;
        const input=overlay.querySelector('#mz-device-enroll-code');
        const status=overlay.querySelector('#mz-device-enroll-status');
        if(input)input.value='';
        if(status)status.textContent='';
      }
      if(enrollmentNeeded&&credentialStatus?.canonical_device_id){
        banner.textContent=`Secure ${credentialStatus.canonical_device_id}${credentialStatus.employee_name?` · ${credentialStatus.employee_name}`:''} — tap to enroll`;
      }""",
)
replace_once(
    'memphis-device-identity.js',
    """      }catch(_err){return credentialStatus;}
      finally{statusRequest=null;}""",
    """      }catch(error){
        credentialStatus={
          ...(credentialStatus||{}),
          authenticated:false,
          enrollment_required:false,
          policy_mode:credentialStatus?.policy_mode||'observe',
          status_unavailable:true,
          status_error:String(error?.message||'Device credential status unavailable.'),
          canonical_device_id:credentialStatus?.canonical_device_id||deviceId,
        };
        updateBanner();
        return credentialStatus;
      }
      finally{statusRequest=null;}""",
)
replace_once(
    'ops-manager-hub.html',
    'Enter the Ops Manager password once on this device. After enrollment, both Ops Manager hubs reopen silently until this device is revoked or its browser data is cleared.',
    'Opening the full-access Ops Manager tools. If manager authentication is enabled, the password is entered once on this device. Employee phones never receive a password prompt.',
)
replace_once(
    'ops-manager-read-only.html',
    'Enter the Ops Manager password once on this device to enroll read-only access. After enrollment, both Ops Manager hubs reopen silently until this device is revoked or its browser data is cleared.',
    'Opening the read-only Ops Manager tools. If manager authentication is enabled, the password is entered once on this device. Employee phones never receive a password prompt.',
)

test = ROOT / 'scripts/device-credential-foundation-tests.mjs'
text = test.read_text(encoding='utf-8')
old_escaped = r'release-2026\.07\.15\.device-credentials\.1'
new_escaped = r'release-2026\.07\.16\.foundation-repair\.1'
count = text.count(old_escaped)
if count < 1:
    raise SystemExit('device credential test: old release regex not found')
test.write_text(text.replace(old_escaped, new_escaped), encoding='utf-8')

expected = {
    'device-security.html': '434936deb27e9f645300926ff6e5ccc840cdb0c8049b477604ecdbd4a89d9c73',
    'employee-hub.html': 'ae890b19cc02cffac18b1062a38f61394a4998ae6d5e91b0b022e9608b7f78af',
    'employee-schedule.html': 'c8820e2177a426dee4545cce76a910efc4e06b861a19ff7fd98b6a0530006a75',
    'events.html': '58192e8519480e890ccfeca3d245d6b7b9696756ddfbec8d6ea0968c123b4481',
    'index.html': '8d4f1c68acd397c203ede418ff06cf28058953e4395ea8721d9a81938d2f8455',
    'memphis-device-identity.js': '14aebaf3bbb35fbcd6260782cc009edc9812683d3c077fa5b586db6524596e7b',
    'messages.html': '7051be9d2329dce805573e3e91ffde8c0f5a45441b7dd84660ee9a17b2f5effa',
    'start_page1.html': 'b749a2e95bca66abd11714654605dade070bb1accb6fbd4fd6ae00521794a8d4',
    'thread.html': 'c0b9644bce0d5229cba5e27122596c3420c54fbffc4e3d786489e5d076ba5eb7',
    'ops-manager-hub.html': 'c8cb55fe53bb90c442ffe3d403ca4794a1ebb361d7eab848227ebe167adfef5e',
    'ops-manager-read-only.html': '054b0c6c775d5b1e1d8696fdb91488bd3ee0b02d8d53043a1eb7154838d5c974',
    'scripts/device-credential-foundation-tests.mjs': 'd120e4ae40efafc48d1e21104ac5612146f59fa2da59d24e490b620789f7a8d5',
}
for relative, digest in expected.items():
    actual = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
    if actual != digest:
        raise SystemExit(f'{relative}: sha256 mismatch {actual} != {digest}')

print('FRONTEND_FOUNDATION_REPAIR_APPLY_PASS')
