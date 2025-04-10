// src/counters/counters.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException, // For slug conflicts
  BadRequestException, // For validation errors
  InternalServerErrorException, // For unexpected errors
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { Counter, Prisma } from '@prisma/client';
import slugify from 'slugify'; // Import slugify

// Interfaces (no change needed)
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
  items: Counter[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
}

@Injectable()
export class CountersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeUserAndTags = {
    tags: { select: { tag: true } },
    user: { select: { username: true } },
    // slug is included by default
  };

  private mapCounterTags(counter: any): Counter {
    if (!counter) return counter;
    const mappedTags = counter.tags?.map((ct: any) => ct.tag) ?? [];
    return { ...counter, tags: mappedTags } as Counter;
  }

  private async findOneOrFail(id: string, userId: string): Promise<Counter> {
    const counter = await this.prisma.counter.findUnique({
      where: { id },
      include: this.includeUserAndTags,
    });
    if (!counter) {
      throw new NotFoundException(`Counter with ID ${id} not found`);
    }
    if (counter.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this counter',
      );
    }
    return this.mapCounterTags(counter);
  }

  // Slug Generation and Uniqueness Helper
  private async generateUniqueSlug(
    inputText: string,
    currentCounterId?: string,
  ): Promise<string> {
    const baseSlug = slugify(inputText || 'untitled', {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g,
      replacement: '-',
    });
    let slug = baseSlug;
    let suffix = 2;
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const whereCondition: Prisma.CounterWhereInput = { slug: slug };
      if (currentCounterId) {
        whereCondition.id = { not: currentCounterId };
      }
      const existingCounter = await this.prisma.counter.findFirst({
        where: whereCondition,
      });
      if (!existingCounter) {
        return slug;
      } // Unique
      slug = `${baseSlug}-${suffix}`;
      suffix++;
      attempts++;
    }
    console.error(
      `Could not generate unique slug for base "${baseSlug}" after ${maxAttempts} attempts.`,
    );
    return `${baseSlug}-${Date.now().toString().slice(-4)}`; // Fallback
  }

  async create(
    createCounterDto: CreateCounterDto,
    userId: string,
  ): Promise<Counter> {
    const {
      tagIds,
      startDate,
      name,
      slug: userProvidedSlug,
      isPrivate = false,
      ...restData
    } = createCounterDto;
    let finalSlug = '';

    // 1. Determine the slug
    if (!isPrivate && userProvidedSlug) {
      const existingBySlug = await this.prisma.counter.findUnique({
        where: { slug: userProvidedSlug },
      });
      if (existingBySlug) {
        throw new ConflictException(
          `Slug "${userProvidedSlug}" is already taken. Please choose another.`,
        );
      }
      finalSlug = userProvidedSlug;
    } else {
      // Private, or public but no user slug provided - auto-generate
      finalSlug = await this.generateUniqueSlug(name);
    }

    // 2. Prepare data
    const data: Prisma.CounterCreateInput = {
      ...restData,
      name,
      slug: finalSlug, // Slug is always required now
      isPrivate,
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

    // 3. Create
    try {
      const newCounter = await this.prisma.counter.create({
        data,
        include: this.includeUserAndTags,
      });
      return this.mapCounterTags(newCounter);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        error.meta?.target === 'counters_slug_key'
      ) {
        throw new ConflictException(
          'Failed to generate a unique URL slug. Please try changing the name slightly.',
        );
      }
      console.error('Error creating counter:', error);
      throw new InternalServerErrorException('Could not create the counter.');
    }
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
    const existingCounter = await this.findOneOrFail(id, userId);
    const {
      tagIds,
      startDate,
      name,
      slug: userProvidedSlug,
      isPrivate,
      ...restData
    } = updateCounterDto;
    let finalSlug = existingCounter.slug;
    let slugNeedsUpdate = false;

    // Determine if slug needs updating
    if (name !== undefined && name !== existingCounter.name) {
      slugNeedsUpdate = true;
    }
    if (userProvidedSlug !== undefined) {
      slugNeedsUpdate = true;
    }
    const newPrivacy = isPrivate ?? existingCounter.isPrivate;
    if (
      !newPrivacy &&
      existingCounter.isPrivate &&
      userProvidedSlug === undefined
    ) {
      slugNeedsUpdate = true;
    }

    // Generate/Validate new slug if needed
    if (slugNeedsUpdate) {
      const newName = name ?? existingCounter.name;
      const newIsPrivate = isPrivate ?? existingCounter.isPrivate;
      if (!newIsPrivate && userProvidedSlug) {
        const existingBySlug = await this.prisma.counter.findFirst({
          where: { slug: userProvidedSlug, id: { not: id } },
        });
        if (existingBySlug) {
          throw new ConflictException(
            `Slug "${userProvidedSlug}" is already taken. Please choose another.`,
          );
        }
        finalSlug = userProvidedSlug;
      } else {
        finalSlug = await this.generateUniqueSlug(newName, id);
      }
    }

    // Prepare update data
    const data: Prisma.CounterUpdateInput = {
      ...restData,
      ...(name !== undefined && { name }),
      slug: finalSlug, // Always update slug field
      ...(isPrivate !== undefined && { isPrivate }),
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

    // Perform update
    try {
      const updatedCounter = await this.prisma.counter.update({
        where: { id },
        data,
        include: this.includeUserAndTags,
      });
      return this.mapCounterTags(updatedCounter);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        error.meta?.target === 'counters_slug_key'
      ) {
        throw new ConflictException(
          'Failed to generate a unique URL slug during update. Please try changing the name or slug slightly.',
        );
      }
      console.error('Error updating counter:', error);
      throw new InternalServerErrorException('Could not update the counter.');
    }
  }

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
      throw new BadRequestException(
        'Archive date cannot be before the counter start date.',
      );
    }
    if (finalArchiveDate > new Date()) {
      throw new BadRequestException('Archive date cannot be in the future.');
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

  // Find by SLUG (Public View)
  async findOneBySlugPublic(slug: string): Promise<Counter> {
    const counter = await this.prisma.counter.findUnique({
      where: { slug },
      include: this.includeUserAndTags,
    });
    if (!counter) {
      throw new NotFoundException(`Counter with slug "${slug}" not found`);
    }
    if (counter.isPrivate) {
      throw new NotFoundException(`Counter with slug "${slug}" not found`);
    } // Hide private ones

    // Increment view count
    if (!counter.archivedAt) {
      try {
        await this.prisma.counter.update({
          where: { id: counter.id },
          data: { viewCount: { increment: 1 } },
        });
      } catch (error) {
        console.error(
          `Failed to increment view count for slug ${slug}:`,
          error,
        );
      }
    }
    return this.mapCounterTags(counter);
  }

  // Find by ID (Owner View)
  async findOneOwned(id: string, userId: string): Promise<Counter> {
    // findOneOrFail handles ownership check & not found
    return this.findOneOrFail(id, userId);
  }

  // Find Public Counters (Explore page)
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

    // Build the where clause for filtering
    const where: Prisma.CounterWhereInput = {
      isPrivate: false,
      archivedAt: null,
    };

    // Add search conditions if search term provided
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Add tags filtering
    if (tagSlugs && tagSlugs.length > 0) {
      where.tags = {
        some: {
          tag: {
            slug: { in: tagSlugs },
          },
        },
      };
    }

    // Build the orderBy clause for sorting
    const orderBy: Prisma.CounterOrderByWithRelationInput = {};
    // Handle different sort options
    switch (sortBy) {
      case 'popularity':
        orderBy.viewCount = sortOrder;
        break;
      case 'startDate':
        orderBy.startDate = sortOrder;
        break;
      case 'name':
        orderBy.name = sortOrder;
        break;
      default: // 'createdAt' is default
        orderBy.createdAt = sortOrder;
    }

    // Run count and findMany in a transaction
    const [totalItems, items] = await this.prisma.$transaction([
      this.prisma.counter.count({ where }),
      this.prisma.counter.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: this.includeUserAndTags,
      }),
    ]);

    const mappedItems = items.map(this.mapCounterTags);

    return {
      items: mappedItems,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }
}
