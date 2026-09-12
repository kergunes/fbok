import { access, readFile } from "node:fs/promises";

const allowedFacebookHosts = new Set([
  "https://facebook.com/*",
  "https://www.facebook.com/*",
]);

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));

for (const path of Object.values(manifest.icons ?? {})) {
  await access(path);
}

for (const path of Object.values(manifest.action?.default_icon ?? {})) {
  await access(path);
}

if (manifest.action?.default_popup) {
  await access(manifest.action.default_popup);
}

if (!manifest.permissions?.includes("storage")) {
  throw new Error("storage permission is required for popup settings");
}

if (manifest.manifest_version !== 3) {
  throw new Error("manifest_version must be 3");
}

if (!/^0\.\d+\.\d+$/.test(manifest.version)) {
  throw new Error(`Unexpected 0.x version: ${manifest.version}`);
}

for (const permission of manifest.host_permissions ?? []) {
  if (!allowedFacebookHosts.has(permission)) {
    throw new Error(`Non-Facebook host permission detected: ${permission}`);
  }
}

for (const script of manifest.content_scripts ?? []) {
  for (const match of script.matches ?? []) {
    if (!allowedFacebookHosts.has(match)) {
      throw new Error(`Non-Facebook content-script match detected: ${match}`);
    }
  }

  for (const path of [...(script.js ?? []), ...(script.css ?? [])]) {
    await access(path);
  }
}

if (!manifest.content_scripts?.length) {
  throw new Error("At least one content script is required");
}

console.log(`fbok manifest validated (v${manifest.version})`);
