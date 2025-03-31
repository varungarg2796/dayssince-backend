// src/tags/tags.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Tag } from '@prisma/client'; // Import Prisma's Tag type

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  // Method to find all tags
  async findAll(): Promise<Tag[]> {
    console.log('Fetching all tags from database...');
    return this.prisma.tag.findMany({
      orderBy: {
        name: 'asc', // Order alphabetically by name
      },
    });
  }
}
