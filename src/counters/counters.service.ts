// src/counters/counters.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { Counter, Prisma } from '@prisma/client';

export interface UserCounters {
  active: Counter[];
  archived: Counter[];
}

// Interface for pagination options
export interface FindPublicCountersOptions {
  page?: number;
  limit?: number;
  sortBy?: 'startDate' | 'createdAt' | 'name' | 'popularity'; // Popularity = viewCount
  sortOrder?: 'asc' | 'desc';
  search?: string;
  tagSlugs?: string[]; // Filter by tag slugs
}

// Interface for paginated result
export interface PaginatedCountersResult {
  items: Counter[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

@Injectable()
export class CountersService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOneOrFail(id: string, userId: string): Promise<Counter> {
    const counter = await this.prisma.counter.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } }, // Include tags info
    });

    if (!counter) {
      throw new NotFoundException(`Counter with ID ${id} not found`);
    }
    if (counter.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this counter',
      );
    }
    return this.mapCounterTags(counter);
  }

  private mapCounterTags(counter: any) {
    if (counter?.tags) {
      counter.tags = counter.tags.map((ct: any) => ct.tag);
    }
    return counter;
  }

  async create(
    createCounterDto: CreateCounterDto,
    userId: string,
  ): Promise<Counter> {
    const { tagIds, startDate, ...restData } = createCounterDto;

    const data: Prisma.CounterCreateInput = {
      ...restData,
      startDate: new Date(startDate), // Convert ISO string to Date object
      user: { connect: { id: userId } }, // Connect to the user creating it
      // Connect to tags if tagIds are provided
      ...(tagIds &&
        tagIds.length > 0 && {
          tags: {
            create: tagIds.map((tagId) => ({
              tag: { connect: { id: tagId } },
            })),
          },
        }),
    };

    const newCounter = await this.prisma.counter.create({
      data,
      include: { tags: { include: { tag: true } } }, // Include tags on create response
    });
    return this.mapCounterTags(newCounter);
  }

  async findMine(userId: string): Promise<UserCounters> {
    const counters = await this.prisma.counter.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' }, // Or sort as needed
      include: { tags: { include: { tag: true } } }, // Include tags info
    });

    const mappedCounters = counters.map(this.mapCounterTags);

    const active = mappedCounters.filter((c) => c.archivedAt === null);
    const archived = mappedCounters.filter((c) => c.archivedAt !== null);

    return { active, archived };
  }

  async update(
    id: string,
    updateCounterDto: UpdateCounterDto,
    userId: string,
  ): Promise<Counter> {
    await this.findOneOrFail(id, userId); // Ensure ownership and existence

    const { tagIds, startDate, ...restData } = updateCounterDto;

    const data: Prisma.CounterUpdateInput = {
      ...restData,
      ...(startDate && { startDate: new Date(startDate) }), // Convert if provided
    };

    if (tagIds !== undefined) {
      data.tags = {
        // First, disconnect all existing tags for this counter
        deleteMany: {},
        // Then, connect the new set of tags provided
        ...(tagIds.length > 0 && {
          create: tagIds.map((tagId) => ({
            tag: { connect: { id: tagId } },
          })),
        }),
      };
    }

    const updatedCounter = await this.prisma.counter.update({
      where: { id },
      data,
      include: { tags: { include: { tag: true } } }, // Include updated tags
    });
    return this.mapCounterTags(updatedCounter);
  }

  async archive(id: string, userId: string): Promise<Counter> {
    const counter = await this.findOneOrFail(id, userId); // Verify ownership

    if (counter.archivedAt) {
      return counter; // Already archived, do nothing
    }

    const archivedCounter = await this.prisma.counter.update({
      where: { id },
      data: { archivedAt: new Date() }, // Set archive timestamp to now
      include: { tags: { include: { tag: true } } },
    });
    return this.mapCounterTags(archivedCounter);
  }

  async unarchive(id: string, userId: string): Promise<Counter> {
    const counter = await this.findOneOrFail(id, userId); // Verify ownership

    if (!counter.archivedAt) {
      return counter; // Already active, do nothing
    }

    const unarchivedCounter = await this.prisma.counter.update({
      where: { id },
      data: { archivedAt: null }, // Set archive timestamp to null
      include: { tags: { include: { tag: true } } },
    });
    return this.mapCounterTags(unarchivedCounter);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOneOrFail(id, userId); // Verify ownership

    await this.prisma.counter.delete({
      where: { id },
    });
  }

  async findPublic(
    options: FindPublicCountersOptions = {},
  ): Promise<PaginatedCountersResult> {
    console.log('Fetching public counters with options:', options);

    const {
      page = 1,
      limit = 12, // Default items per page
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      tagSlugs,
    } = options;

    const skip = (page - 1) * limit;
    const take = limit;

    // --- Build WHERE clause ---
    const where: Prisma.CounterWhereInput = {
      isPrivate: false, // Only fetch public counters
      archivedAt: null, // Only fetch active counters (usually desired for Explore)

      // Search logic (simple search on name/description)
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),

      // Tag filtering logic (match counters having ALL specified tags)
      ...(tagSlugs &&
        tagSlugs.length > 0 && {
          tags: {
            // Check relation CounterTag using 'some' if ANY tag matches, or 'every' if ALL must match
            // Let's use 'some' for broader filtering initially
            some: {
              tag: {
                slug: { in: tagSlugs }, // Match tag slugs in the provided array
              },
            },
          },
        }),
    };
    // -----------------------

    // --- Build ORDER BY clause ---
    const orderBy: Prisma.CounterOrderByWithRelationInput = {};
    if (sortBy === 'popularity') {
      orderBy.viewCount = sortOrder;
    } else {
      // Handle other sort fields (startDate, createdAt, name)
      orderBy[sortBy] = sortOrder;
    }
    // Add a secondary sort for consistency if needed, e.g., by createdAt
    if (sortBy !== 'createdAt') {
      orderBy.createdAt = 'desc'; // Example secondary sort
    }
    // --------------------------

    // --- Perform Queries ---
    // Use transaction to get count and items efficiently
    const [totalItems, items] = await this.prisma.$transaction([
      // Query 1: Get total count matching the WHERE clause
      this.prisma.counter.count({ where }),
      // Query 2: Get paginated items matching WHERE, ORDER BY, include tags
      this.prisma.counter.findMany({
        where,
        skip,
        take,
        orderBy,
        include: { tags: { include: { tag: true } } }, // Include tags
      }),
    ]);
    // ---------------------

    const mappedItems = items.map(this.mapCounterTags); // Map tags for clean output
    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: mappedItems,
      totalItems,
      totalPages,
      currentPage: page,
    };
  }

  // --- NEW: Find Single Public Counter (and Increment View) ---
  async findOnePublic(id: string): Promise<Counter | null> {
    console.log(`Fetching public counter ID: ${id}`);

    // Use updateMany to potentially increment view count and fetch in one conceptual step
    // Update first to avoid race conditions, then fetch the possibly updated record
    // Note: updateMany doesn't return the record directly.

    // 1. Try to increment view count WHERE it's public and matches ID
    await this.prisma.counter.updateMany({
      where: { id: id, isPrivate: false },
      data: { viewCount: { increment: 1 } },
    });

    // 2. Fetch the counter regardless of whether view count was incremented
    const counter = await this.prisma.counter.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    });

    // 3. Check privacy *after* fetching
    if (!counter) {
      console.log(`Counter ID ${id} not found.`);
      throw new NotFoundException(`Counter with ID ${id} not found`);
    }
    if (counter.isPrivate) {
      console.log(`Counter ID ${id} is private. Access denied.`);
      // Optionally allow owner access here if needed later, otherwise deny
      throw new ForbiddenException('This counter is private');
    }

    console.log(`Returning public counter ID: ${id}, view count updated.`);
    return this.mapCounterTags(counter); // Map tags before returning
  }
}
