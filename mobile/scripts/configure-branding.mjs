import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const mobileRoot = resolve(new URL('..', import.meta.url).pathname);
const edition = String(process.env.MZ_APP_EDITION || 'manager').toLowerCase();
const palette = {
  manager: { background: '#071827', accent: '#F4C14C', name: 'Memphis Zoo Ops' },
  custodial: { background: '#063038', accent: '#52D3DF', name: 'Memphis Zoo Custodial' },
  viewer: { background: '#0A2342', accent: '#F4C14C', name: 'Memphis Zoo Viewer' },
}[edition] || { background: '#071827', accent: '#F4C14C', name: 'Memphis Zoo Ops' };
const androidRoot = join(mobileRoot, 'android/app/src/main');
const res = join(androidRoot, 'res');
async function write(path, content) { await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true }); await writeFile(path, content); }
if (edition === 'manager') {
  const managerArt = join(res, 'drawable-nodpi/manager_icon_e_art.png');
  await mkdir(join(res, 'drawable-nodpi'), { recursive: true });
  await copyFile(join(mobileRoot, '..', 'manager-icon-e-zoo-heritage.png'), managerArt);
}
const vectorForeground = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="#9BE11F" android:pathData="M22,79L22,28L37,28L54,49L71,28L86,28L86,79L71,79L71,51L54,72L37,51L37,79Z"/>
  <path android:fillColor="#FFFFFF" android:pathData="M84,14L87,22L95,25L87,28L84,36L81,28L73,25L81,22Z"/>
  ${edition === 'custodial' ? '<path android:fillColor="#52D3DF" android:pathData="M54,77C48,84 46,87 46,92C46,98 50,102 54,102C58,102 62,98 62,92C62,87 60,84 54,77Z"/>' : edition === 'viewer' ? '<path android:fillColor="#F4C14C" android:pathData="M35,91C45,80 63,80 73,91C63,102 45,102 35,91ZM54,86C51,86 49,88 49,91C49,94 51,96 54,96C57,96 59,94 59,91C59,88 57,86 54,86Z"/>' : '<path android:fillColor="#F4C14C" android:pathData="M31,91L77,91L77,97L31,97Z"/>'}
</vector>`;
const vectorLegacy = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
  <path android:fillColor="${palette.background}" android:pathData="M0,0L108,0L108,108L0,108Z"/>
  <path android:fillColor="#9BE11F" android:pathData="M22,79L22,28L37,28L54,49L71,28L86,28L86,79L71,79L71,51L54,72L37,51L37,79Z"/>
  <path android:fillColor="#FFFFFF" android:pathData="M84,14L87,22L95,25L87,28L84,36L81,28L73,25L81,22Z"/>
  ${edition === 'custodial' ? '<path android:fillColor="#52D3DF" android:pathData="M54,77C48,84 46,87 46,92C46,98 50,102 54,102C58,102 62,98 62,92C62,87 60,84 54,77Z"/>' : edition === 'viewer' ? '<path android:fillColor="#F4C14C" android:pathData="M35,91C45,80 63,80 73,91C63,102 45,102 35,91ZM54,86C51,86 49,88 49,91C49,94 51,96 54,96C57,96 59,94 59,91C59,88 57,86 54,86Z"/>' : '<path android:fillColor="#F4C14C" android:pathData="M31,91L77,91L77,97L31,97Z"/>'}
</vector>`;
const foreground = edition === 'manager'
  ? `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android" android:inset="4dp">
  <bitmap android:src="@drawable/manager_icon_e_art" android:gravity="fill"/>
</inset>`
  : vectorForeground;
const legacy = edition === 'manager'
  ? `<?xml version="1.0" encoding="utf-8"?>
<bitmap xmlns:android="http://schemas.android.com/apk/res/android" android:src="@drawable/manager_icon_e_art" android:gravity="fill"/>`
  : vectorLegacy;
await write(join(res, 'drawable/ic_launcher_foreground.xml'), foreground);
await write(join(res, 'mipmap-anydpi/ic_launcher.xml'), legacy);
await write(join(res, 'mipmap-anydpi/ic_launcher_round.xml'), legacy);
await write(join(res, 'values/ic_launcher_background.xml'), `<resources><color name="ic_launcher_background">${palette.background}</color></resources>`);
const adaptive = `<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@drawable/ic_launcher_foreground"/></adaptive-icon>`;
await write(join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
await write(join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
const stringsPath = join(res, 'values/strings.xml');
let strings = await readFile(stringsPath, 'utf8');
strings = strings.replace(/<string name="app_name">[\s\S]*?<\/string>/, `<string name="app_name">${palette.name}</string>`).replace(/<string name="title_activity_main">[\s\S]*?<\/string>/, `<string name="title_activity_main">${palette.name}</string>`);
await writeFile(stringsPath, strings);
console.log(`Configured ${edition} launcher identity.`);
