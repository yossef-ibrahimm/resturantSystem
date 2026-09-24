import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Res, Get } from "@nestjs/common";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { RolesGuard } from "../common/guards/roles.guard";
import { Public } from "../common/guards/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsString, MinLength, Matches } from "class-validator";
import type { Request } from "express";

const COOKIE_NAME = "tastytable_token";

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])/, { message: "newPassword must contain at least one lowercase letter" })
  @Matches(/^(?=.*[A-Z])/, { message: "newPassword must contain at least one uppercase letter" })
  @Matches(/^(?=.*\d)/, { message: "newPassword must contain at least one number" })
  newPassword: string;
}

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password);

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie(COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return { user: result.user };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return { success: true };
  }

  @UseGuards(RolesGuard)
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: { id: string }
  ) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
