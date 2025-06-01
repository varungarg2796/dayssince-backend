// src/counters/counters.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { Counter, Prisma } from '@prisma/client'; // Prisma.Counter type will include new fields
import slugify from 'slugify';

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

  // Consistent include object for all counter fetches
  private readonly includeCounterDetails = {
    tags: { select: { tag: true } },
    user: { select: { username: true } },
    // New scalar fields (isChallenge, challengeDurationDays, challengeAchievedAt)
    // will be automatically included when selecting the Counter model.
  };

  // Helper to map Prisma's tag structure to a simpler array of Tag objects
  private mapCounterToResponseType(counterWithRelations: any): Counter {
    if (!counterWithRelations) return counterWithRelations;
    const { tags, ...counterData } = counterWithRelations;
    const mappedTags = tags?.map((ct: any) => ct.tag) ?? [];
    return { ...counterData, tags: mappedTags } as Counter;
  }

  private async findOneOrFail(id: string, userId: string): Promise<Counter> {
    const counter = await this.prisma.counter.findUnique({
      where: { id },
      include: this.includeCounterDetails, // Use consistent include
    });
    if (!counter) {
      throw new NotFoundException(`Counter with ID ${id} not found`);
    }
    if (counter.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this counter',
      );
    }
    return this.mapCounterToResponseType(counter);
  }

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
      }
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
      // --- CHALLENGE FIELDS ---
      isChallenge = false, // Default from DTO if not provided
      challengeDurationDays,
      // --- END CHALLENGE FIELDS ---
      ...restData
    } = createCounterDto;

    // Validation for challenge fields
    if (isChallenge && (challengeDurationDays === undefined || challengeDurationDays === null || challengeDurationDays < 1)) {
      throw new BadRequestException(
        'If this is a challenge, challengeDurationDays must be provided and be a positive number.',
      );
    }

    let finalSlug = '';
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
      finalSlug = await this.generateUniqueSlug(name);
    }

    const data: Prisma.CounterCreateInput = {
      ...restData, // Includes description if present
      name,
      slug: finalSlug,
      isPrivate,
      startDate: new Date(startDate),
      user: { connect: { id: userId } },
      // --- CHALLENGE FIELDS DATA ---
      isChallenge: isChallenge,
      challengeDurationDays: isChallenge ? challengeDurationDays : null,
      challengeAchievedAt: null, // Always null on creation
      // --- END CHALLENGE FIELDS DATA ---
      ...(tagIds &&
        tagIds.length > 0 && {
          tags: {
            create: tagIds.map((tagId) => ({
              tag: { connect: { id: tagId } },
            })),
          },
        }),
    };

    try {
      const newCounter = await this.prisma.counter.create({
        data,
        include: this.includeCounterDetails,
      });
      return this.mapCounterToResponseType(newCounter);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' && // Unique constraint violation
        (error.meta?.target as string[])?.includes('slug') // Check if it's the slug constraint
      ) {
        throw new ConflictException(
          'Failed to generate a unique URL slug, or the provided slug is already taken. Please try changing the name or slug slightly.',
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
      include: this.includeCounterDetails,
    });
    const mappedCounters = counters.map(this.mapCounterToResponseType);
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
      // --- CHALLENGE FIELDS ---
      isChallenge,
      challengeDurationDays,
      // challengeAchievedAt is not directly updatable via DTO for now
      // --- END CHALLENGE FIELDS ---
      ...restData
    } = updateCounterDto;

    // Determine effective values for challenge fields
    const effectiveIsChallenge = isChallenge !== undefined ? isChallenge : existingCounter.isChallenge;
    let effectiveChallengeDurationDays = challengeDurationDays !== undefined
        ? challengeDurationDays
        : existingCounter.challengeDurationDays;
    let effectiveChallengeAchievedAt = existingCounter.challengeAchievedAt;

    if (effectiveIsChallenge && (effectiveChallengeDurationDays === undefined || effectiveChallengeDurationDays === null || effectiveChallengeDurationDays < 1)) {
      throw new BadRequestException(
        'If this is a challenge, challengeDurationDays must be provided and be a positive number.',
      );
    }

    if (effectiveIsChallenge === false) {
      effectiveChallengeDurationDays = null;
      effectiveChallengeAchievedAt = null;
    } else { // effectiveIsChallenge is true
      // If key challenge parameters change, reset achievedAt for frontend recalculation
      const oldStartDateStr = existingCounter.startDate.toISOString();
      const newStartDateProvided = startDate ? new Date(startDate).toISOString() : null;

      if ((newStartDateProvided && newStartDateProvided !== oldStartDateStr) ||
          (challengeDurationDays !== undefined && challengeDurationDays !== existingCounter.challengeDurationDays)) {
        effectiveChallengeAchievedAt = null;
      }
    }

    let finalSlug = existingCounter.slug;
    let slugNeedsUpdate = false;
    const effectiveIsPrivate = isPrivate !== undefined ? isPrivate : existingCounter.isPrivate;

    if (name !== undefined && name !== existingCounter.name) slugNeedsUpdate = true;
    if (userProvidedSlug !== undefined && userProvidedSlug !== existingCounter.slug) slugNeedsUpdate = true;
    if (isPrivate !== undefined && !effectiveIsPrivate && existingCounter.isPrivate && userProvidedSlug === undefined) {
      // If making public and no new slug provided, may need to regenerate if old one was generic
      slugNeedsUpdate = true;
    }


    if (slugNeedsUpdate) {
      const newNameForSlug = name ?? existingCounter.name;
      if (!effectiveIsPrivate && userProvidedSlug) {
        if (userProvidedSlug !== existingCounter.slug) { // Only check for conflict if slug actually changes
            const existingBySlug = await this.prisma.counter.findFirst({
                where: { slug: userProvidedSlug, id: { not: id } },
            });
            if (existingBySlug) {
                throw new ConflictException(
                `Slug "${userProvidedSlug}" is already taken. Please choose another.`,
                );
            }
        }
        finalSlug = userProvidedSlug;
      } else if (!effectiveIsPrivate) { // Auto-generate if becoming public or name changed for public
        finalSlug = await this.generateUniqueSlug(newNameForSlug, id);
      } else { // Is private, keep existing slug or generate based on name if name changed
        finalSlug = name ? await this.generateUniqueSlug(name, id) : existingCounter.slug;
      }
    }


    const data: Prisma.CounterUpdateInput = {
      ...restData,
      ...(name !== undefined && { name }),
      slug: finalSlug,
      ...(isPrivate !== undefined && { isPrivate: effectiveIsPrivate }),
      ...(startDate && { startDate: new Date(startDate) }),
      // --- CHALLENGE FIELDS DATA ---
      isChallenge: effectiveIsChallenge,
      challengeDurationDays: effectiveChallengeDurationDays,
      challengeAchievedAt: effectiveChallengeAchievedAt,
      // --- END CHALLENGE FIELDS DATA ---
    };

    if (tagIds !== undefined) {
      data.tags = {
        deleteMany: {}, // Clear existing tags
        ...(tagIds.length > 0 && {
          create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
        }),
      };
    }

    try {
      const updatedCounter = await this.prisma.counter.update({
        where: { id },
        data,
        include: this.includeCounterDetails,
      });
      return this.mapCounterToResponseType(updatedCounter);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        (error.meta?.target as string[])?.includes('slug')
      ) {
        throw new ConflictException(
          'Failed to generate a unique URL slug during update, or the provided slug is already taken. Please try changing the name or slug slightly.',
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
    const counter = await this.findOneOrFail(id, userId); // findOneOrFail now includes challenge fields
    if (counter.archivedAt) {
      return this.mapCounterToResponseType(counter); // Already archived
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
      include: this.includeCounterDetails,
    });
    return this.mapCounterToResponseType(archivedCounter);
  }

  async unarchive(id: string, userId: string): Promise<Counter> {
    const counter = await this.findOneOrFail(id, userId); // findOneOrFail now includes challenge fields
    if (!counter.archivedAt) {
      return this.mapCounterToResponseType(counter); // Already active
    }
    const unarchivedCounter = await this.prisma.counter.update({
      where: { id },
      data: { archivedAt: null },
      include: this.includeCounterDetails,
    });
    return this.mapCounterToResponseType(unarchivedCounter);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOneOrFail(id, userId); // Ensures ownership and existence
    await this.prisma.counter.delete({ where: { id } });
  }

  async findOneBySlugPublic(slug: string): Promise<Counter> {
    const counter = await this.prisma.counter.findUnique({
      where: { slug },
      include: this.includeCounterDetails,
    });
    if (!counter) {
      throw new NotFoundException(`Counter with slug "${slug}" not found`);
    }
    if (counter.isPrivate) {
      throw new NotFoundException(`Counter with slug "${slug}" not found (private).`);
    }

    if (!counter.archivedAt) {
      try {
        // Fire and forget view count update
        this.prisma.counter.update({
          where: { id: counter.id },
          data: { viewCount: { increment: 1 } },
        }).catch(err => console.error(`Failed to increment view count for ${slug}: ${err.message}`));
      } catch (error) { // Should not be needed with .catch above
        console.error( `Error during view count increment for slug ${slug}:`, error);
      }
    }
    return this.mapCounterToResponseType(counter);
  }

  async findOneOwned(id: string, userId: string): Promise<Counter> {
    return this.findOneOrFail(id, userId);
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

    const where: Prisma.CounterWhereInput = {
      isPrivate: false,
      archivedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tagSlugs && tagSlugs.length > 0) {
      where.tags = {
        some: {
          tag: {
            slug: { in: tagSlugs },
          },
        },
      };
    }

    const orderBy: Prisma.CounterOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'popularity': orderBy.viewCount = sortOrder; break;
      case 'startDate': orderBy.startDate = sortOrder; break;
      case 'name': orderBy.name = sortOrder; break;
      default: orderBy.createdAt = sortOrder;
    }

    const [totalItems, items] = await this.prisma.$transaction([
      this.prisma.counter.count({ where }),
      this.prisma.counter.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: this.includeCounterDetails,
      }),
    ]);

    const mappedItems = items.map(this.mapCounterToResponseType);

    return {
      items: mappedItems,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }
}