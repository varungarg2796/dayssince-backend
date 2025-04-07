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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import {
  CountersService,
  FindPublicCountersOptions,
  PaginatedCountersResult,
} from './counters.service';
import { Public } from '../auth/decorators/public.decorator';
import { IsOptional, IsDateString } from 'class-validator';

interface RequestWithUser extends Request {
  user: { id: string };
}

// DTO for optional archive body
class ArchiveBodyDto {
  @IsOptional() @IsDateString() archiveAt?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('counters')
export class CountersController {
  constructor(private readonly countersService: CountersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createCounterDto: CreateCounterDto,
    @Req() req: RequestWithUser,
  ) {
    return this.countersService.create(createCounterDto, req.user.id);
  }

  @Get('mine')
  findMine(@Req() req: RequestWithUser) {
    return this.countersService.findMine(req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCounterDto: UpdateCounterDto,
    @Req() req: RequestWithUser,
  ) {
    return this.countersService.update(id, updateCounterDto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.countersService.remove(id, req.user.id);
  }

  // Modified Archive Route
  @Patch(':id/archive')
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
    @Body() body?: ArchiveBodyDto,
  ) {
    const archiveDate = body?.archiveAt ? new Date(body.archiveAt) : undefined;
    return this.countersService.archive(id, req.user.id, archiveDate);
  }

  @Patch(':id/unarchive')
  unarchive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.countersService.unarchive(id, req.user.id);
  }

  @Public()
  @Get('public')
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
  @Get(':id')
  findOnePublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.countersService.findOnePublic(id);
  }
}
