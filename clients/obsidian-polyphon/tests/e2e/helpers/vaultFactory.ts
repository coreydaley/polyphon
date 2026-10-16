import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PLUGIN_ID = "polyphon";
const PROJECT_ROOT = path.resolve(__dirname, "../../../");

export interface TestVault {
  vaultPath: string;
  cleanup: () => Promise<void>;
}

export interface PolyphonPluginSettings {
  host?: string;
  port?: number;
  token?: string;
  persistConversations?: boolean;
  debugMode?: boolean;
}

export async function createTestVault(settings?: PolyphonPluginSettings): Promise<TestVault> {
  const mainJs = path.join(PROJECT_ROOT, "main.js");
  if (!fs.existsSync(mainJs)) {
    throw new Error("Plugin not built — run 'npm run build' first.");
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "polyphon-e2e-"));
  const vaultPath = path.join(tmpDir, "vault");
  const obsidianDir = path.join(vaultPath, ".obsidian");
  const pluginDir = path.join(obsidianDir, "plugins", PLUGIN_ID);

  fs.mkdirSync(pluginDir, { recursive: true });

  fs.writeFileSync(
    path.join(obsidianDir, "community-plugins.json"),
    JSON.stringify([PLUGIN_ID])
  );
  fs.writeFileSync(
    path.join(obsidianDir, "app.json"),
    JSON.stringify({ safeMode: false })
  );

  const pluginSettings = {
    host: settings?.host ?? "127.0.0.1",
    port: settings?.port ?? 7432,
    token: settings?.token ?? "",
    persistConversations: settings?.persistConversations ?? false,
    debugMode: settings?.debugMode ?? false,
  };

  fs.writeFileSync(
    path.join(pluginDir, "data.json"),
    JSON.stringify(pluginSettings)
  );

  for (const file of ["main.js", "manifest.json", "styles.css"]) {
    const src = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(pluginDir, file));
    }
  }

  fs.writeFileSync(
    path.join(vaultPath, "Welcome.md"),
    "# E2E Test Vault\n\nThis vault is used for automated Polyphon plugin E2E testing.\n"
  );

  return {
    vaultPath,
    cleanup: async () => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}
