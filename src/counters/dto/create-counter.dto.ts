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
  Min, // Import Min decorator
} from 'class-validator';

export class CreateCounterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsArray()
  @IsInt({ each: true })
  @ArrayUnique()
  @IsOptional()
  tagIds?: number[];

  @IsString()
  @IsOptional()
  @MinLength(3, { message: 'Slug must be at least 3 characters long' })
  @MaxLength(80, { message: 'Slug must be no more than 80 characters long' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug must contain only lowercase letters, numbers, and hyphens (e.g., my-cool-counter)',
  })
  slug?: string;

  // --- NEW OPTIONAL CHALLENGE FIELDS ---
  @IsBoolean()
  @IsOptional()
  isChallenge?: boolean;

  @IsInt()
  @Min(1, { message: 'Challenge duration must be at least 1 day.' }) // Ensure positive duration
  @IsOptional()
  challengeDurationDays?: number; // Duration in days
  // We don't take challengeAchievedAt as input from the client
}