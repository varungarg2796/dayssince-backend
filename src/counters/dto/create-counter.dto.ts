// src/counters/dto/create-counter.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsArray,
  IsInt,
  ArrayUnique,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateCounterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100) // Add a reasonable max length for name
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500) // Add a reasonable max length for description
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string; // Receive as string, convert to Date in service

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean; // Defaults to false in schema

  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  @IsOptional()
  tagIds?: number[]; // Array of Tag IDs

  // --- ADDED SLUG FIELD ---
  @IsString()
  @IsOptional() // User doesn't have to provide it
  @MinLength(3, { message: 'Slug must be at least 3 characters long' })
  @MaxLength(80, { message: 'Slug must be no more than 80 characters long' }) // Example length
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug must contain only lowercase letters, numbers, and hyphens (e.g., my-cool-counter)',
  })
  slug?: string;
  // -----------------------
}
