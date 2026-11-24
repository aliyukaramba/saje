import { defineConfig } from "prisma/config";

// Prisma 7: the database URL lives here, not in the schema. Migrations use it; the app connects through
// the Neon adapter in src/client.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
