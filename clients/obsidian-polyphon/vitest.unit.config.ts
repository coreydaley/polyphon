import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      obsidian: resolve(__dirname, "tests/helpers/obsidianStub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.unit.test.ts"],
  },
});
