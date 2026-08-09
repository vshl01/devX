import 'dotenv/config';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis;

/**
 * @returns {{ prisma: PrismaClient, pool: import('pg').Pool }}
 */
function createPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

const existing = globalForPrisma.__prescriptionIntelligencePrisma;

const clients = existing ?? createPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prescriptionIntelligencePrisma = clients;
}

export const prisma = clients.prisma;
export const pool = clients.pool;
