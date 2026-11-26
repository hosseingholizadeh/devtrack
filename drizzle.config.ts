import { defineConfig } from "drizzle-kit";

// drizzle-kit does not load Next.js env files, so load them the way `next dev` would
// (`.env.local` wins over `.env`; loadEnvFile never overrides variables that are already set).
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // File missing: rely on the real environment (CI, hosting).
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
