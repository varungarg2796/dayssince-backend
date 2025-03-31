// src/tags/tags.controller.ts
import { Controller, Get } from '@nestjs/common';
import { TagsService } from './tags.service';
import { Tag } from '@prisma/client';

@Controller('tags') // Base path /api/tags
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  // GET /api/tags
  @Get()
  async findAll(): Promise<Tag[]> {
    return this.tagsService.findAll();
  }
}
