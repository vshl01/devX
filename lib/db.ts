import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/app/generated/prisma/client";

/**
 * Typed Prisma singleton. It reuses the same global slot as `lib/prisma.js`
 * so the app never opens two connection pools against the same database.
 */

const GLOBAL_KEY = "__prescriptionIntelligencePrisma";

interface Clients {
  prisma: PrismaClient;
  pool: Pool;
}

const globalForPrisma = globalThis as typeof globalThis & {
  [GLOBAL_KEY]?: Clients;
};

function createClients(): Clients {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  return { prisma, pool };
}

const clients: Clients = globalForPrisma[GLOBAL_KEY] ?? createClients();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma[GLOBAL_KEY] = clients;
}

export const db = clients.prisma;
