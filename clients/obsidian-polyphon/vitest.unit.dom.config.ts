import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: resolve(__dirname, "tests/helpers/obsidianStub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.dom.test.ts"],
    server: {
      deps: {
        inline: ["@exodus/bytes", "html-encoding-sniffer"],
      },
    },
  },
});
