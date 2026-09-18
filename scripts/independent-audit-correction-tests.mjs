import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=process.cwd();
const files=["audit-D1-receipt-authority.mjs", "audit-D2-finish-interruption.mjs", "audit-D3-authority-refresh.mjs", "audit-B001-startup.mjs", "audit-GPS-contract.mjs", "audit-B007-audio-dismiss.mjs"];
for(const file of files){ console.log('AUDIT_REGRESSION',file);execFileSync(process.execPath,[resolve('tests/audit-corrections',file),root],{stdio:'inherit',timeout:30000});}
