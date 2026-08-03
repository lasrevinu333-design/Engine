from pathlib import Path
import subprocess


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


home_path = Path('employee-hub.html')
home = home_path.read_text()
home = replace_once(
    home,
    'href="./events.html?hub=employee">Events',
    'href="./employee-events.html?hub=employee">Events',
    'employee Events home link',
)
home = replace_once(
    home,
    'href="./system-feedback.html?hub=employee">Feedback',
    'href="./employee-feedback.html?hub=employee">Feedback',
    'employee Feedback home link',
)
home_path.write_text(home)

build_path = Path('mobile/scripts/build.mjs')
build = build_path.read_text()
build = replace_once(
    build,
    "  'employee-schedule.html',\n  'events.html',\n  'manager-ux.css',",
    "  'employee-events.html',\n  'employee-feedback.html',\n  'employee-schedule.html',\n  'manager-ux.css',",
    'Custodial employee page allowlist',
)
build = replace_once(
    build,
    "  'system-feedback.html',\n",
    '',
    'remove shared Feedback from Custodial allowlist',
)
build = replace_once(
    build,
    "  'events-admin.html',\n  'gemini-admin.html',",
    "  'events-admin.html',\n  'events.html',\n  'gemini-admin.html',",
    'prohibit shared Events page',
)
build = replace_once(
    build,
    "  'schedule.html',\n];",
    "  'schedule.html',\n  'system-feedback.html',\n];",
    'prohibit shared Feedback page',
)
build_path.write_text(build)

bridge_path = Path('mobile/src/custodial/bridge.js')
bridge = bridge_path.read_text()
bridge = replace_once(
    bridge,
    "const allowed = new Set(['employee-hub.html', 'events.html', 'messages.html', 'messages-chatscope.html', 'thread.html', 'employee-schedule.html', 'system-feedback.html', 'scan.html', 'index.html']);",
    "const allowed = new Set(['employee-hub.html', 'employee-events.html', 'employee-feedback.html', 'messages.html', 'messages-chatscope.html', 'thread.html', 'employee-schedule.html', 'scan.html', 'index.html']);",
    'native employee page route allowlist',
)
bridge_path.write_text(bridge)

notification_path = Path('mobile/src/custodial/notification-coordinator.js')
notifications = notification_path.read_text()
notifications = replace_once(
    notifications,
    "if (kind.includes('event')) return './events.html?hub=employee';",
    "if (kind.includes('event')) return './employee-events.html?hub=employee';",
    'employee event notification route',
)
notification_path.write_text(notifications)

subprocess.run(['node', 'scripts/custodial-employee-pages-v23-contract-tests.mjs'], check=True)
subprocess.run(['npm', 'run', '--silent', 'release:manifest:refresh'], check=True)
Path(__file__).unlink()
print('Wired employee-only Events and Feedback into the Custodial runtime.')
