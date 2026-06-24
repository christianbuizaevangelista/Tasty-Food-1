import { PrismaClient } from '@prisma/client';

// Reuse a single PrismaClient across warm serverless invocations (and dev
// hot-reloads) to avoid connection churn that can cause intermittent
// "can't reach database" / empty-engine errors on the pooled connection.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

// Cache on the global so warm lambdas (and dev hot-reloads) reuse this instance.
globalForPrisma.prisma = prisma;
