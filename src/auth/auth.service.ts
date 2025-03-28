// src/auth/auth.service.ts

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client'; // Import User type from Prisma

// Define the shape of the data returned by the login method
export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

// Define the shape of the JWT payload
export interface JwtPayload {
  sub: string; // User ID
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    // We don't necessarily need PrismaService directly here for login,
    // as the user object is already validated/created by the GoogleStrategy
  ) {}

  async generateTokens(payload: JwtPayload): Promise<Tokens> {
    const [accessToken, refreshToken] = await Promise.all([
      // Generate Access Token
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRATION',
          '15m',
        ),
      }),
      // Generate Refresh Token (using the same payload but different expiration)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'), // Use same secret for simplicity, could use separate
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRATION',
          '7d',
        ),
      }),
    ]);

    // Here you might want to store the refreshToken securely if needed for invalidation,
    // but for stateless JWT, we just return it.

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Called after GoogleStrategy successfully validates/creates a user.
   * Prepares the payload and generates tokens.
   */
  async login(user: Omit<User, 'password'>): Promise<Tokens> {
    const payload: JwtPayload = { sub: user.id };
    return this.generateTokens(payload);
  }

  // Add methods for refresh token validation, logout (if storing refresh tokens), etc. later
}
