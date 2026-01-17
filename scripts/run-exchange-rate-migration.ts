import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

/**
 * ExchangeRate 및 Country 테이블 마이그레이션 실행 스크립트
 */
async function runMigration() {
  try {
    console.log('Executing migration SQL statements...');

    // DailyExchangeRate 테이블 생성
    console.log('Creating DailyExchangeRate table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DailyExchangeRate" (
        "id" SERIAL NOT NULL,
        "date" TEXT NOT NULL,
        "currency" TEXT NOT NULL,
        "rate" DOUBLE PRECISION NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DailyExchangeRate_pkey" PRIMARY KEY ("id")
      );
    `);

    // DailyExchangeRate 인덱스 생성
    console.log('Creating DailyExchangeRate indexes...');
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "DailyExchangeRate_date_currency_key" 
      ON "DailyExchangeRate"("date", "currency");
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DailyExchangeRate_date_idx" 
      ON "DailyExchangeRate"("date");
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DailyExchangeRate_currency_idx" 
      ON "DailyExchangeRate"("currency");
    `);

    // Country 테이블 생성
    console.log('Creating Country table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Country" (
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "currency" TEXT NOT NULL,
        "symbol" TEXT,
        "flag" TEXT,
        "order" INTEGER NOT NULL,
        CONSTRAINT "Country_pkey" PRIMARY KEY ("code")
      );
    `);

    // Country 인덱스 생성
    console.log('Creating Country index...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Country_order_idx" 
      ON "Country"("order");
    `);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration()
  .then(() => {
    console.log('Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script error:', error);
    process.exit(1);
  });











