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
  ValidationPipe,
} from '@nestjs/common';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import {
  CountersService,
  FindPublicCountersOptions,
  PaginatedCountersResult,
} from './counters.service';
import { Public } from '../auth/decorators/public.decorator';
import {
  IsOptional,
  IsDateString,
  IsString,
  Length,
  Matches,
} from 'class-validator';

interface RequestWithUser extends Request {
  user: { id: string };
}

class ArchiveBodyDto {
  @IsOptional() @IsDateString() archiveAt?: string;
}

// DTO for slug param validation
class SlugParamDto {
  @IsString()
  @Length(3, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;
}

@Controller('counters')
export class CountersController {
  constructor(private readonly countersService: CountersService) {}

  // --- Owner Actions ---

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createCounterDto: CreateCounterDto,
    @Req() req: RequestWithUser,
  ) {
    return this.countersService.create(createCounterDto, req.user.id);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() req: RequestWithUser) {
    return this.countersService.findMine(req.user.id);
  }

  // --- Public Routes (Place BEFORE parameterized :id route) ---

  @Public()
  @Get('public') // <<< MOVED HERE
  findPublic(
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

  @Public()
  @Get('/c/:slug') // Public view by SLUG
  findOneBySlugPublic(
    @Param(new ValidationPipe({ validateCustomDecorators: true }))
    params: SlugParamDto,
  ) {
    return this.countersService.findOneBySlugPublic(params.slug);
  }

  // --- Parameterized Owner Routes (Place AFTER literal /public route) ---

  // Owner view by ID
  @Get(':id') // <<< NOW HERE
  @UseGuards(JwtAuthGuard)
  findOneOwned(
    @Param('id', ParseUUIDPipe) id: string, // Keep pipe here
    @Req() req: RequestWithUser,
  ) {
    return this.countersService.findOneOwned(id, req.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCounterDto: UpdateCounterDto,
    @Req() req: RequestWithUser,
  ) {
    return this.countersService.update(id, updateCounterDto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.countersService.remove(id, req.user.id);
  }

  @Patch(':id/archive')
  @UseGuards(JwtAuthGuard)
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
    @Body() body?: ArchiveBodyDto,
  ) {
    const archiveDate = body?.archiveAt ? new Date(body.archiveAt) : undefined;
    return this.countersService.archive(id, req.user.id, archiveDate);
  }

  @Patch(':id/unarchive')
  @UseGuards(JwtAuthGuard)
  unarchive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.countersService.unarchive(id, req.user.id);
  }
}
