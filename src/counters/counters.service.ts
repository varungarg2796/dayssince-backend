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
  items: (Counter & { user?: { username: string } })[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

@Injectable()
export class CountersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeUserAndTags = {
    tags: { include: { tag: true } },
    user: { select: { username: true } },
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
    return this.mapCounterTags(counter) as Counter & {
      user: { username: string };
    };
  }

  private mapCounterTags(counter: any) {
    if (counter?.tags) {
      const mappedTags = counter.tags.map((ct: any) => ct.tag);
      return { ...counter, tags: mappedTags };
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
      include: this.includeUserAndTags,
    });
    return this.mapCounterTags(newCounter);
  }

  async findMine(userId: string): Promise<UserCounters> {
    const counters = await this.prisma.counter.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      include: this.includeUserAndTags,
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
    await this.findOneOrFail(id, userId);
    const { tagIds, startDate, ...restData } = updateCounterDto;
    const data: Prisma.CounterUpdateInput = {
      ...restData,
      ...(startDate && { startDate: new Date(startDate) }),
    };
    if (tagIds !== undefined) {
      data.tags = {
        deleteMany: {},
        ...(tagIds.length > 0 && {
          create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
        }),
      };
    }
    const updatedCounter = await this.prisma.counter.update({
      where: { id },
      data,
      include: this.includeUserAndTags,
    });
    return this.mapCounterTags(updatedCounter);
  }

  // Modified archive method
  async archive(
    id: string,
    userId: string,
    archiveDate?: Date,
  ): Promise<Counter> {
    const counter = await this.findOneOrFail(id, userId);
    if (counter.archivedAt) {
      return this.mapCounterTags(counter);
    }

    const finalArchiveDate =
      archiveDate instanceof Date && !isNaN(archiveDate.getTime())
        ? archiveDate
        : new Date();

    if (new Date(counter.startDate) > finalArchiveDate) {
      throw new ForbiddenException(
        'Archive date cannot be before the counter start date.',
      );
    }

    const archivedCounter = await this.prisma.counter.update({
      where: { id },
      data: { archivedAt: finalArchiveDate },
      include: this.includeUserAndTags,
    });
    return this.mapCounterTags(archivedCounter);
  }

  async unarchive(id: string, userId: string): Promise<Counter> {
    const counter = await this.findOneOrFail(id, userId);
    if (!counter.archivedAt) {
      return this.mapCounterTags(counter);
    }
    const unarchivedCounter = await this.prisma.counter.update({
      where: { id },
      data: { archivedAt: null },
      include: this.includeUserAndTags,
    });
    return this.mapCounterTags(unarchivedCounter);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOneOrFail(id, userId);
    await this.prisma.counter.delete({ where: { id } });
  }

  async findPublic(
    options: FindPublicCountersOptions = {},
  ): Promise<PaginatedCountersResult> {
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
        include: this.includeUserAndTags,
      }),
    ]);
    const mappedItems = items.map(this.mapCounterTags);
    const totalPages = Math.ceil(totalItems / limit);
    return { items: mappedItems, totalItems, totalPages, currentPage: page };
  }

  async findOnePublic(id: string): Promise<Counter | null> {
    await this.prisma.counter.updateMany({
      where: { id: id, isPrivate: false },
      data: { viewCount: { increment: 1 } },
    });
    const counter = await this.prisma.counter.findUnique({
      where: { id },
      include: this.includeUserAndTags,
    });
    if (!counter) {
      throw new NotFoundException(`Counter with ID ${id} not found`);
    }
    if (counter.isPrivate) {
      throw new ForbiddenException('This counter is private');
    }
    return this.mapCounterTags(counter);
  }
}
