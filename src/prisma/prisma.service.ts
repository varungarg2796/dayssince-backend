// src/prisma/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      // Optional: Add Prisma client options here if needed
      // log: ['query', 'info', 'warn', 'error'], // Uncomment to log all queries
    });
  }

  async onModuleInit() {
    // Prisma recommends connecting explicitly, though it often connects lazily
    await this.$connect();
    console.log('Prisma Client Connected');
  }

  async onModuleDestroy() {
    // Gracefully disconnect Prisma Client when the NestJS application shuts down
    await this.$disconnect();
    console.log('Prisma Client Disconnected');
  }

  // Optional: Add custom methods if you need to extend Prisma functionalities
  // Example: async cleanDatabase() { ... } for testing purposes
}
