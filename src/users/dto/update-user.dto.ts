import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsNotEmpty({ message: 'Username cannot be empty.' })
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long.' })
  @MaxLength(20, {
    message: 'Username must be no more than 20 characters long.',
  })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores.',
  })
  username: string;
}
