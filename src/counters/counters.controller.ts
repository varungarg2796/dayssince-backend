// src/counters/counters.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Import our guard
import { Request } from 'express';
import {
  CountersService,
  FindPublicCountersOptions,
  PaginatedCountersResult,
} from './counters.service';
import { Public } from '../auth/decorators/public.decorator';

interface RequestWithUser extends Request {
  user: {
    id: string; // Matches what JwtStrategy.validate returns
  };
}

@UseGuards(JwtAuthGuard) // Apply JWT guard to ALL routes in this controller
@Controller('counters') // Base path /api/counters
export class CountersController {
  constructor(private readonly countersService: CountersService) {}

  // POST /api/counters
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createCounterDto: CreateCounterDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id; // Extract user ID from the request object
    return this.countersService.create(createCounterDto, userId);
  }

  // GET /api/counters/mine
  @Get('mine')
  findMine(@Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.countersService.findMine(userId);
  }

  // PATCH /api/counters/:id
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string, // Validate :id is a UUID
    @Body() updateCounterDto: UpdateCounterDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.countersService.update(id, updateCounterDto, userId);
  }

  // DELETE /api/counters/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // Return 204 No Content on success
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.countersService.remove(id, userId);
  }

  // --- Archive/Unarchive Routes ---

  // PATCH /api/counters/:id/archive
  @Patch(':id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    const userId = req.user.id;
    return this.countersService.archive(id, userId);
  }

  // PATCH /api/counters/:id/unarchive
  @Patch(':id/unarchive')
  unarchive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.countersService.unarchive(id, userId);
  }

  // --- Public Routes (Implement Later) ---
  // We haven't implemented the service logic for these yet
  @Public() // Mark this route as public, bypassing controller-level JwtAuthGuard
  @Get('public')
  findPublic(
    // Use @Query() with pipes for validation and defaults
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('sortBy', new DefaultValuePipe('createdAt'))
    sortBy: 'startDate' | 'createdAt' | 'name' | 'popularity',
    @Query('sortOrder', new DefaultValuePipe('desc')) sortOrder: 'asc' | 'desc',
    @Query('search', new DefaultValuePipe('')) search: string,
    @Query('tags', new DefaultValuePipe('')) tags: string,
  ): Promise<PaginatedCountersResult> {
    const options: FindPublicCountersOptions = {
      page: Math.max(1, page),
      limit: Math.max(1, Math.min(50, limit)),
      sortBy,
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
      search: search.trim() || undefined,
      tagSlugs: tags
        ? tags
            .split(',')
            .map((slug) => slug.trim())
            .filter(Boolean)
        : undefined,
    };
    return this.countersService.findPublic(options);
  }

  @Public() // Mark as public
  @Get(':id')
  findOnePublic(@Param('id', ParseUUIDPipe) id: string) {
    // Service method handles view count increment and privacy check
    return this.countersService.findOnePublic(id);
  }

  // GET /api/counters/:id (Needs service logic for public view, view count, no guard for public part)
  // @Get(':id')
  // @UseGuards() // Remove guard for public route / Handle auth internally
  // findOnePublic(@Param('id', ParseUUIDPipe) id: string) { ... }
}
