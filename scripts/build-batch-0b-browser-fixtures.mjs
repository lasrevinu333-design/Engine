import { execFileSync } from 'node:child_process';

const npmExecPath = process.env.npm_execpath;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

for (const edition of ['manager', 'custodial', 'viewer']) {
  const command = npmExecPath ? process.execPath : npmCommand;
  const args = npmExecPath
    ? [npmExecPath, 'run', '--silent', `build:${edition}`]
    : ['run', '--silent', `build:${edition}`];

  execFileSync(command, args, {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      MZ_MOBILE_DIST: `build/batch-0b-shell-browser/${edition}`,
    },
    stdio: 'inherit',
  });
}
