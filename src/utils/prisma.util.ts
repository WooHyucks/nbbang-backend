import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client 싱글톤
 * 여러 Repository에서 동일한 인스턴스를 공유하여 연결 풀 고갈 방지
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'], // 쿼리 로그 비활성화 (query, warn 제거)
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}











