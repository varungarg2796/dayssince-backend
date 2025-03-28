import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsArray,
  IsInt,
  ArrayUnique, // Optional: Ensure tag IDs are unique
} from 'class-validator';

export class CreateCounterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString() // Validates if the string is an ISO 8601 date string
  @IsNotEmpty()
  startDate: string; // Receive as string, convert to Date in service

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean; // Defaults to false in schema

  @IsArray()
  @IsInt({ each: true }) // Validates each element is an integer
  @ArrayUnique()
  @IsOptional()
  tagIds?: number[]; // Array of Tag IDs
}
