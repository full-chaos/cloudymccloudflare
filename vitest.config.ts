import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@server": path.resolve(__dirname, "src/server"),
      "@client": path.resolve(__dirname, "src/client"),
      "cloudflare:workers": path.resolve(__dirname, "tests/helpers/cloudflare-workers-stub.ts"),
      "cloudflare:email": path.resolve(__dirname, "tests/helpers/cloudflare-workers-stub.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Inline the Agents SDK so the `cloudflare:*` aliases above apply to its imports.
    server: { deps: { inline: [/node_modules\/agents\//, /@cloudflare\/ai-chat/, /partyserver/] } },
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
