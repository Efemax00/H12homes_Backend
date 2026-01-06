import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    
    // Validate DATABASE_URL exists
    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }

    console.log('🔌 Connecting to database...');
    
    const pool = new Pool({
      connectionString,
      // Railway requires SSL for external connections
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    const adapter = new PrismaPg(pool);
    
    super({
      adapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}