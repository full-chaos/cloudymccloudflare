import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@server": path.resolve(__dirname, "src/server"),
      "@client": path.resolve(__dirname, "src/client"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/server/**/*.ts",
        "src/shared/**/*.ts",
      ],
      exclude: [
        "src/server/types/**",
        "tests/**",
        "**/*.test.ts",
        "**/*.spec.ts",
      ],
    },
  },
});
