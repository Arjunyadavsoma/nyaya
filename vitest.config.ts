import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Integration tests run against a scratch SQLite DB via a separate script
    // (see tests/integration/README.md) — excluded here to keep unit runs fast.
    exclude: ["tests/integration/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
