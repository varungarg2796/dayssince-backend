// src/users/users.controller.ts
import { Body, Controller, Get, Req, UseGuards, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // <-- Import the guard
import { Request } from 'express';
import { UpdateUserDto } from './dto/update-user.dto';

// Define shape of request.user after JwtAuthGuard runs
interface RequestWithUser extends Request {
  user: {
    id: string; // This matches what JwtStrategy.validate returns
  };
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard) // <-- Protect this route
  async getMe(@Req() req: RequestWithUser) {
    // req.user.id is available because JwtAuthGuard successfully validated the token
    // and JwtStrategy attached the payload { id: userId }
    const userId = req.user.id;
    console.log(`Fetching profile for user ID: ${userId}`);
    return this.usersService.findById(userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard) // Protect the route
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() updateUserDto: UpdateUserDto, // Validate request body using DTO
  ) {
    const userId = req.user.id;
    console.log(
      `Updating profile for user ID: ${userId} with username: ${updateUserDto.username}`,
    );
    // DTO validation is handled automatically by ValidationPipe in main.ts
    return this.usersService.updateProfile(userId, updateUserDto);
  }

  // Add other user routes here
}
