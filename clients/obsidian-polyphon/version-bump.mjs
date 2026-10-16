import { readFileSync, writeFileSync } from "fs";

// npm version sets the new version in package.json before running this script
const { version } = JSON.parse(readFileSync("package.json", "utf8"));

// Sync version into manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = version;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

// Append new version → minAppVersion entry to versions.json
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[version] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");
