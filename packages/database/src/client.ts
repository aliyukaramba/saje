import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Neon's serverless driver works on Cloudflare Workers and Node.js. Raw Postgres sockets do not work on Workers.
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

// Keep a singleton only in local Node.js development. Cloudflare Workers reuse an isolate
// across requests, but request-created I/O (including Neon pool/connection state) must not
// be shared between invocations. In production, create a fresh client for each Prisma
// access so no adapter or connection created by one request can leak into another.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getClient(): PrismaClient {
  if (process.env.NODE_ENV !== "production") {
    if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
    return globalForPrisma.prisma;
  }

  return createClient();
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
