import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

type WorkerEnv = {
  // Cloudflare Hyperdrive binding (set up in apps/web/wrangler.jsonc). Pools connections at the edge.
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
};

/** The current request's Cloudflare context, or null outside a Worker request (local Node.js, scripts). */
function currentRequest(): { key: object; env: WorkerEnv } | null {
  try {
    const { env, ctx } = getCloudflareContext({ async: false });
    return { key: ctx as object, env: env as unknown as WorkerEnv };
  } catch {
    return null;
  }
}

function createClient(env: WorkerEnv): PrismaClient {
  // Hyperdrive reuses pooled connections, so a new client per request is cheap.
  if (env.HYPERDRIVE) {
    return new PrismaClient({ adapter: new PrismaPg(env.HYPERDRIVE.connectionString) });
  }
  // Neon's serverless driver works on Cloudflare Workers and Node.js. Raw Postgres sockets do not work
  // on Workers unless Hyperdrive is configured.
  const connectionString = env.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

// One client per Worker request. Previously every property access created a new client and a new
// connection, so a single order paid the connection setup cost several times. Caching against the
// request's context object keeps requests isolated, because nothing is shared between invocations.
const requestClients = new WeakMap<object, PrismaClient>();

// Local Node.js (next dev, scripts): a single shared client.
let localClient: PrismaClient | undefined;

function getClient(): PrismaClient {
  const request = currentRequest();
  if (request) {
    let client = requestClients.get(request.key);
    if (!client) {
      client = createClient(request.env);
      requestClients.set(request.key, client);
    }
    return client;
  }
  if (!localClient) localClient = createClient({});
  return localClient;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
