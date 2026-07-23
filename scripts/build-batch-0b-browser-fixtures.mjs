import { execFileSync } from 'node:child_process';

const npmExecPath = process.env.npm_execpath;
if (!npmExecPath) throw new Error('Run the Batch 0B fixture build through npm.');

for (const edition of ['manager', 'custodial', 'viewer']) {
  execFileSync(
    process.execPath,
    [npmExecPath, 'run', '--silent', `build:${edition}`],
    {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        MZ_MOBILE_DIST: `build/batch-0b-shell-browser/${edition}`,
      },
      stdio: 'inherit',
    },
  );
}
