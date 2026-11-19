import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Neon's serverless driver works on Cloudflare Workers and Node.js. Raw Postgres sockets do not work on Workers.
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// The client is created on first use, not at import time. Next.js imports route modules while
// building, and the build machine has no DATABASE_URL (it is a Worker secret, not a build variable).
function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const client = createClient();
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
    return client;
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
