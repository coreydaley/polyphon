import esbuild from "esbuild";
import builtins from "builtin-modules";

const production = process.argv.includes("--production");

// Extension host bundle (Node.js CJS, external: vscode + Node builtins)
await esbuild.build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode", ...builtins],
  format: "cjs",
  platform: "node",
  sourcemap: !production,
  minify: production,
  logLevel: "info",
});

// Webview bundle (browser IIFE, no Node APIs)
await esbuild.build({
  entryPoints: ["src/webview/index.ts"],
  bundle: true,
  outfile: "dist/webview.js",
  format: "iife",
  platform: "browser",
  sourcemap: !production,
  minify: production,
  logLevel: "info",
});
