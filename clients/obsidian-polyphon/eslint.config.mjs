import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  { ignores: ["src/__tests__/**"] },
  ...obsidianmd.configs.recommended,
  {
    rules: {
      // Allow product name and standard acronyms in UI text
      "obsidianmd/ui/sentence-case": ["error", { ignoreRegex: ["Polyphon", "JSON-RPC"] }],
    },
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
      globals: {
        // Electron/Node globals available in Obsidian plugins
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Buffer: "readonly",
        process: "readonly",
        console: "readonly",
        crypto: "readonly",
        document: "readonly",
        window: "readonly",
      },
    },
  },
]);
