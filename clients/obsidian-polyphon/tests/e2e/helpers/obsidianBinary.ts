import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

/**
 * Resolves the Obsidian executable path using:
 * 1. OBSIDIAN_BINARY env var (must be absolute path to executable)
 * 2. Platform-specific defaults
 * 3. Returns null if not found (tests should call ctx.skip())
 */
export function findObsidianBinary(): string | null {
  const fromEnv = process.env.OBSIDIAN_BINARY;
  if (fromEnv) {
    if (!path.isAbsolute(fromEnv)) {
      console.warn(`OBSIDIAN_BINARY is not an absolute path: ${fromEnv}`);
      return null;
    }
    try {
      fs.accessSync(fromEnv, fs.constants.X_OK);
      return fromEnv;
    } catch {
      console.warn(`OBSIDIAN_BINARY not executable: ${fromEnv}`);
      return null;
    }
  }

  const platform = process.platform;
  let candidates: string[] = [];

  if (platform === "darwin") {
    candidates = ["/Applications/Obsidian.app/Contents/MacOS/Obsidian"];
  } else if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? "";
    candidates = [path.join(localAppData, "Obsidian", "Obsidian.exe")];
  } else {
    // Linux: try which
    try {
      const result = execSync("which obsidian", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
      if (result) candidates = [result];
    } catch {
      // not found
    }
  }

  for (const candidate of candidates) {
    if (!path.isAbsolute(candidate)) continue;
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // not found or not executable
    }
  }

  return null;
}
