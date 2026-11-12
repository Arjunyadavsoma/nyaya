import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 120000,
    hookTimeout: 120000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
