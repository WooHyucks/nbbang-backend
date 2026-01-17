import { prisma } from '../src/utils/prisma.util';

async function runMigration() {
  try {
    console.log('Running Contribution table migration...');
    
    // Create Contribution table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Contribution" (
        "id" SERIAL PRIMARY KEY,
        "member_id" INTEGER NOT NULL,
        "amount_krw" DOUBLE PRECISION NOT NULL,
        "meeting_id" INTEGER NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Contribution_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Contribution_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Contribution_member_id_meeting_id_key" UNIQUE ("member_id", "meeting_id")
      );
    `);
    
    // Create indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Contribution_member_id_idx" ON "Contribution"("member_id");
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Contribution_meeting_id_idx" ON "Contribution"("meeting_id");
    `);
    
    // Add type column to Payment table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Payment" 
      ADD COLUMN IF NOT EXISTS "type" VARCHAR(20) NOT NULL DEFAULT 'PUBLIC';
    `);
    
    // Update existing Payment records: payer_id가 null이면 PUBLIC, 아니면 INDIVIDUAL
    await prisma.$executeRawUnsafe(`
      UPDATE "Payment" 
      SET "type" = CASE 
        WHEN "payer_id" IS NULL THEN 'PUBLIC' 
        ELSE 'INDIVIDUAL' 
      END
      WHERE "type" = 'PUBLIC' OR "type" IS NULL;
    `);
    
    console.log('✅ Contribution table and Payment.type column created successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();











