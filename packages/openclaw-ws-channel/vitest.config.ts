import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Mirror the alias pattern from test/vitest/vitest.shared.config.ts so that
// openclaw/plugin-sdk/* resolves to source files during package-local test runs.
const pluginSdkSubpaths = [
  "account-helpers",
  "account-id",
  "account-resolution-runtime",
  "account-core",
  "account-configured-ids",
];

export default defineConfig({
  resolve: {
    alias: pluginSdkSubpaths.map((subpath) => ({
      find: `openclaw/plugin-sdk/${subpath}`,
      replacement: path.join(repoRoot, "src", "plugin-sdk", `${subpath}.ts`),
    })),
  },
  test: { environment: "node" },
});
