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

export interface FindPublicCountersOptions {
  page?: number;
  limit?: number;
  sortBy?: 'startDate' | 'createdAt' | 'name' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  tagSlugs?: string[];
}

export interface PaginatedCountersResult {
  items: (Counter & { creator?: { username: string } })[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

@Injectable()
export class CountersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeUserAndTags = {
    tags: { include: { tag: true } },
    user: { select: { username: true } }, // Include user's username
  };
  private async findOneOrFail(
    id: string,
    userId: string,
  ): Promise<Counter & { user: { username: string } }> {
    const counter = await this.prisma.counter.findUnique({
      where: { id },
      include: this.includeUserAndTags,
    });

    if (!counter) {
      throw new NotFoundException(`Counter with ID ${id} not found`);
    }
    if (counter.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this counter',
      );
    }
    // No need for mapCounterTags if include handles it, but ensure type matches
    return this.mapCounterTags(counter) as Counter & {
      user: { username: string };
    }; // Ensure type assertion if mapCounterTags modifies structure
  }

  // Ensure mapCounterTags doesn't remove the user info
  private mapCounterTags(counter: any) {
    if (counter?.tags) {
      // Map tags but preserve other fields like 'user'
      const mappedTags = counter.tags.map((ct: any) => ct.tag);
      return { ...counter, tags: mappedTags }; // Return new object with mapped tags
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
      startDate: new Date(startDate),
      user: { connect: { id: userId } },
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
      include: this.includeUserAndTags, // Use shared include
    });
    return this.mapCounterTags(newCounter);
  }

  async findMine(userId: string): Promise<UserCounters> {
    const counters = await this.prisma.counter.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      include: this.includeUserAndTags, // Use shared include
    });

    const mappedCounters = counters.map(this.mapCounterTags);

    // Types need to align with included data
    const active = mappedCounters.filter((c) => c.archivedAt === null);
    const archived = mappedCounters.filter((c) => c.archivedAt !== null);

    return { active, archived };
  }

  async update(
    id: string,
    updateCounterDto: UpdateCounterDto,
    userId: string,
  ): Promise<Counter> {
    // Return type might need adjustment
    await this.findOneOrFail(id, userId); // Ensures ownership and existence

    const { tagIds, startDate, ...restData } = updateCounterDto;

    const data: Prisma.CounterUpdateInput = {
      ...restData,
      ...(startDate && { startDate: new Date(startDate) }),
    };

    if (tagIds !== undefined) {
      data.tags = {
        deleteMany: {},
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
      include: this.includeUserAndTags, // Use shared include
    });
    return this.mapCounterTags(updatedCounter);
  }

  async archive(id: string, userId: string): Promise<Counter> {
    // Return type might need adjustment
    const counter = await this.findOneOrFail(id, userId);

    if (counter.archivedAt) {
      return this.mapCounterTags(counter); // Already archived
    }

    const archivedCounter = await this.prisma.counter.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: this.includeUserAndTags, // Use shared include
    });
    return this.mapCounterTags(archivedCounter);
  }

  async unarchive(id: string, userId: string): Promise<Counter> {
    // Return type might need adjustment
    const counter = await this.findOneOrFail(id, userId);

    if (!counter.archivedAt) {
      return this.mapCounterTags(counter); // Already active
    }

    const unarchivedCounter = await this.prisma.counter.update({
      where: { id },
      data: { archivedAt: null },
      include: this.includeUserAndTags, // Use shared include
    });
    return this.mapCounterTags(unarchivedCounter);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOneOrFail(id, userId); // Verify ownership
    await this.prisma.counter.delete({ where: { id } });
  }

  async findPublic(
    options: FindPublicCountersOptions = {},
  ): Promise<PaginatedCountersResult> {
    console.log('Fetching public counters with options:', options);

    const {
      page = 1,
      limit = 12,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      tagSlugs,
    } = options;

    const skip = (page - 1) * limit;
    const take = limit;

    const where: Prisma.CounterWhereInput = {
      isPrivate: false,
      archivedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(tagSlugs &&
        tagSlugs.length > 0 && {
          tags: { some: { tag: { slug: { in: tagSlugs } } } },
        }),
    };

    const orderBy: Prisma.CounterOrderByWithRelationInput = {};
    if (sortBy === 'popularity') {
      orderBy.viewCount = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }
    if (sortBy !== 'createdAt') {
      orderBy.createdAt = 'desc';
    }

    const [totalItems, items] = await this.prisma.$transaction([
      this.prisma.counter.count({ where }),
      this.prisma.counter.findMany({
        where,
        skip,
        take,
        orderBy,
        include: this.includeUserAndTags, // Use shared include
      }),
    ]);

    const mappedItems = items.map(this.mapCounterTags);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: mappedItems, // Type assertion might be needed if TS doesn't infer user field
      totalItems,
      totalPages,
      currentPage: page,
    };
  }

  async findOnePublic(id: string): Promise<Counter | null> {
    // Return type might need adjustment
    console.log(`Fetching public counter ID: ${id}`);

    await this.prisma.counter.updateMany({
      where: { id: id, isPrivate: false },
      data: { viewCount: { increment: 1 } },
    });

    const counter = await this.prisma.counter.findUnique({
      where: { id },
      include: this.includeUserAndTags, // Use shared include
    });

    if (!counter) {
      console.log(`Counter ID ${id} not found.`);
      throw new NotFoundException(`Counter with ID ${id} not found`);
    }
    if (counter.isPrivate) {
      console.log(`Counter ID ${id} is private. Access denied.`);
      throw new ForbiddenException('This counter is private');
    }

    console.log(`Returning public counter ID: ${id}, view count updated.`);
    return this.mapCounterTags(counter);
  }
}
