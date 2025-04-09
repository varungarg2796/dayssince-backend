// src/users/users.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<Omit<User, 'password'>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user; // Exclude password
    return userWithoutPassword;
  }

  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<Omit<User, 'password' | 'hashedRefreshToken'>> {
    const { username } = updateUserDto;

    // 1. Optional: Find the current user (mostly for the old username if needed, not strictly necessary)
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!currentUser) {
      throw new NotFoundException('User not found');
    } // Should not happen due to guard

    // 2. Check if username is actually changing
    if (currentUser.username === username) {
      // No change needed, return current user data (excluding sensitive info)
      const { ...userWithoutSensitive } = currentUser;
      return userWithoutSensitive;
    }

    // 3. Check if the desired username is already taken by *another* user
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { username: username },
      });

      // 4. Return the updated user (excluding sensitive fields)
      const { ...result } = updatedUser;
      return result;
    } catch (error) {
      // Handle potential unique constraint violation from Prisma
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Check if the conflict is specifically on the username field
        if (error.meta?.target === 'users_username_key') {
          throw new ConflictException(
            `Username "${username}" is already taken.`,
          );
        }
      }
      // Re-throw other errors
      console.error('Error updating username:', error);
      throw error;
    }
  }

  // Add other user-related methods here (update, etc.)
}
