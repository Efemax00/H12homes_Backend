import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  // =========================
  // SUPER ADMIN
  // =========================
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) throw new Error('SUPER_ADMIN credentials missing in .env');

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        isEmailVerified: true,
      },
    });
    console.log('SUPER_ADMIN created with email:', email);
  } else {
    console.log('SUPER_ADMIN already exists with email:', existing.email);
  }

  // =========================
  // AI BOT USER (REQUIRED FOR FK)
  // =========================
  const AI_USER_ID = '00000000-0000-0000-0000-000000000001';
  const AI_EMAIL = 'bot@h12homes.ai';

  // hash something (your User.password is required)
  const botPasswordHash = await bcrypt.hash(
    process.env.AI_BOT_PASSWORD || 'BOT_ACCOUNT_DO_NOT_LOGIN',
    10,
  );

  await prisma.user.upsert({
    where: { id: AI_USER_ID },
    update: {
      email: AI_EMAIL,
      firstName: 'H12',
      lastName: 'Assistant',
      isEmailVerified: true,
    },
    create: {
      id: AI_USER_ID,
      email: AI_EMAIL,
      password: botPasswordHash,
      firstName: 'H12',
      lastName: 'Assistant',
      role: 'USER',
      isEmailVerified: true,

      // optional flags (your schema has these)
      isAgent: false,
      isInventor: false,
      isFurnitureMaker: false,
    },
  });

  console.log('✅ AI bot user ensured:', AI_USER_ID);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
