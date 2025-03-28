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
} from '@nestjs/common';
import { CountersService } from './counters.service';
import { CreateCounterDto } from './dto/create-counter.dto';
import { UpdateCounterDto } from './dto/update-counter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Import our guard
import { Request } from 'express';

// Define shape of request.user after JwtAuthGuard runs
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

  // GET /api/counters/public (Needs service logic, pagination, filtering, no guard)
  // @Get('public')
  // @UseGuards() // Remove guard for public route
  // findPublic(/* ... query params ... */) { ... }

  // GET /api/counters/:id (Needs service logic for public view, view count, no guard for public part)
  // @Get(':id')
  // @UseGuards() // Remove guard for public route / Handle auth internally
  // findOnePublic(@Param('id', ParseUUIDPipe) id: string) { ... }
}
