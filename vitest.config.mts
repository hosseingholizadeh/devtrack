import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true }, // native `@/*` alias resolution from tsconfig.json
  test: {
    // React Testing Library only registers its automatic per-test cleanup when `afterEach` is a
    // global. Tests still import from "vitest" explicitly; this just exposes the hooks to RTL.
    globals: true,
    environment: "jsdom", // component tests; tooling tests opt out with `// @vitest-environment node`
    include: ["src/**/*.test.{ts,tsx}", ".claude/**/*.test.mjs"],
  },
});
