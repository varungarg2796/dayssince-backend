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

  // We might add findPublic, findOnePublic later
}
