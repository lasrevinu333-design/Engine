# Custodial assigned-phone maintenance

This is an on-demand Linux client, not a background agent or paid service. It
uses the existing named-manager trusted-device flow and only the protected
Custodial receiver. It never installs, uninstalls, clears, resets, re-enrolls a
healthy phone, rewrites a tag, or changes Fully. No dependency download occurs.

## Current acceptance status

SOURCE IN DEVELOPMENT. Local synthetic tests are not release admission or
physical proof. No production release policy or workstation credential has been
provisioned by adding this source. Do not run activation against an unreviewed
build. The policy must be generated from the exact independently reviewed,
formally admitted APK; never copy an old artifact hash or invent signer/version
values to make preflight pass. The expected first-install time and UID must come
from the retained-device acceptance evidence, not from a newly installed phone.

## One-time workstation setup

An authorized Director/Security Admin issues an existing one-time **named-manager**
code. Run `node mobile/maintenance/client.mjs enroll` and enter it privately when
prompted (no echo, argv, environment variable, URL, or copied browser session).
The client stores a stable workstation ID and its dedicated trust cookie under
`~/.local/state/memphis-zoo-custodial-maintenance/`, directory0700/files0600.
It refuses to overwrite existing trust. A nonblocking kernel lease serializes
all client invocations; its short-lived helper exits on normal completion or
parent disconnection, so no stale process/PID lock must be guessed away.
The existing trusted-device management
screen can revoke this workstation independently. A lost enrollment response may
require an administrator to revoke the uncertain workstation and issue a new
code; the client does not bypass that credential boundary.

The release procedure supplies owner-readable-only `release-policy.json` in that
directory with schema `custodial.maintenance-policy.v1`, client_version,
package_name, receiver, exact APK SHA256, signer SHA256, version_code, and approved
recipients keyed by KIOSK ID. Each recipient contains exact raw serial, SHA256 of
that serial, UID and original first_install_time. Use the field names checked by
`validatePolicy`. Only explicitly approved recipients belong in this file.

## Each activation

1. In Phone Assignments, save the intended employee assignment, then use the
   separate Activate / recover phone action. Save Assignment alone is not activation.
2. Connect the exact approved phone to this trusted maintenance computer. Run
   `node mobile/maintenance/client.mjs list` to see this manager's pending requests.
3. Run `node mobile/maintenance/client.mjs activate OPERATION_UUID`. It displays
   the frozen employee UUID, kiosk, epoch, serial suffix and admitted package/build
   before claiming a secret. The serial map is the pre-authorized physical selection;
   it never selects the first USB device or an emulator.
4. It checks primary Android user, UID/lineage, Fully device owner and LOCKED state,
   pulls only the installed Custodial APK to an exact temporary directory, verifies
   its admitted hash/signer/version/DUMP receiver, and removes that temporary copy.
5. The secret travels over ADB stdin, never host argv or a host shell. Android still
   transiently sees the broadcast Intent extra/process argument. No zero-exposure
   claim is made. The receiver wipes its character array; Java/OS transient strings
   are not guaranteed erasable. No secret is persisted by this client.
6. ADB completion means delivered only. The current server operation must contain
   an exact device-authenticated protected-journal receipt before native_active or
   not_required is reported. A healthy phone keeps its original credential.

The client exits after a bounded dispatch/status check, not an indefinite watch.
Use `status OPERATION_UUID` or the manager status button to read subsequent native
confirmation. If delivery is unknown, retry **the same operation UUID**; there is
no new token on retry. Each secret claim reserves one of five attempts before
returning it, even if its response or the later delivery report is lost. The
sixth claim or expiry stops delivery without minting a replacement token.
Status/expiry does not erase saved work or revoke a confirmed phone credential.
Any new request after expiry remains subject to the current assignment and all
release/physical safety checks. Physical NFC Start/same-tag Finish is a separate
acceptance gate; this tool does not certify it.
