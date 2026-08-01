import { mkdir, cp, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const outRoot = resolve(root, "mobile-build");
const runtimeExtensions = new Set([".html", ".js", ".css", ".png", ".webp", ".svg", ".wav", ".json", ".txt", ".ico"]);
const readOnlyHtml = new Set(["readonly-home.html", "dashboard.html", "events.html"]);
const readOnlyAssets = new Set([
  "memphis-auth.js",
  "memphis-device-reminders.js",
  "Header.webp",
  "dashboard-bg_optimized.webp",
  "Event_Icon_Optimized_Pink.webp",
  "Event_Icon_Optimized_Perfect.webp",
  "Zoo_Logo.png",
  "dashboard_tiger_icon.svg",
  "scheduler_icon_optimized.webp",
  "Guest_Issues_Icon.webp",
  "memphis_avatar_optimized.webp",
  "memphis-alert-tone.wav",
]);

function shouldCopyForOpsManager(filePath) {
  const rel = relative(root, filePath);
  if (!rel || rel.startsWith(`mobile-build${sep}`)) return false;
  if (rel.startsWith(`.git${sep}`) || rel.startsWith(`node_modules${sep}`)) return false;
  if (rel.startsWith(`docs${sep}`) || rel.startsWith(`test${sep}`)) return false;
  if (rel === "readonly-home.html") return false;
  if (rel.startsWith(`scripts${sep}`)) return filePath.endsWith(".mjs");
  return runtimeExtensions.has(filePath.slice(filePath.lastIndexOf(".")));
}

function shouldCopyForReadOnly(filePath) {
  const rel = relative(root, filePath);
  if (!rel || rel.startsWith(`mobile-build${sep}`)) return false;
  if (rel.startsWith(`.git${sep}`) || rel.startsWith(`node_modules${sep}`)) return false;
  if (rel.startsWith(`docs${sep}`) || rel.startsWith(`test${sep}`)) return false;
  if (rel.startsWith(`scripts${sep}`)) return false;
  if (readOnlyHtml.has(rel)) return true;
  if (readOnlyAssets.has(rel)) return true;
  return false;
}

async function walk(dir, predicate, output = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "mobile-build" || entry.name === "node_modules" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, predicate, output);
      continue;
    }
    if (predicate(full)) output.push(full);
  }
  return output;
}

async function copyBundle(bundleName, predicate, extraFiles = []) {
  const targetDir = resolve(outRoot, bundleName, "www");
  await rm(resolve(outRoot, bundleName), { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  const files = new Set(await walk(root, predicate));
  for (const extra of extraFiles) files.add(resolve(root, extra));
  for (const source of files) {
    const rel = relative(root, source);
    const destination = resolve(targetDir, rel);
    await mkdir(resolve(destination, ".."), { recursive: true });
    await cp(source, destination);
  }
  if (bundleName === "read-only") {
    await writeFile(resolve(targetDir, "index.html"), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=readonly-home.html">
  <title>Memphis Zoo Read Only</title>
  <script>location.replace('readonly-home.html');</script>
</head>
<body>
  <p>Loading Memphis Zoo Read Only…</p>
</body>
</html>
`);
  }
  const manifest = {
    bundle: bundleName,
    created_at: new Date().toISOString(),
    file_count: files.size + (bundleName === "read-only" ? 1 : 0),
    web_dir: "www",
    app_entry: bundleName === "read-only" ? "index.html" : "start_page1.html",
    allowed_entry_pages: bundleName === "read-only" ? ["index.html", "readonly-home.html", "dashboard.html", "events.html"] : null,
  };
  await writeFile(resolve(outRoot, bundleName, "bundle-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

await mkdir(outRoot, { recursive: true });
await copyBundle("ops-manager", shouldCopyForOpsManager);
await copyBundle("read-only", shouldCopyForReadOnly);
console.log(JSON.stringify({
  ok: true,
  outRoot,
  bundles: ["ops-manager", "read-only"],
}, null, 2));
