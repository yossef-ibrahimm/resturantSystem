import { Controller, Get, Patch, Post, Body, UseGuards } from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { Public } from "../common/guards/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  IsString,
  IsOptional,
  MinLength,
  Matches,
  IsUrl,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from "class-validator";

class UpdateSettingsDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  nameAr?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  nameEn?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  menuBackgroundUrl?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#([0-9A-Fa-f]{3}){1,2}$/, { message: "primaryColor must be a valid hex color" })
  primaryColor?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#([0-9A-Fa-f]{3}){1,2}$/, { message: "secondaryColor must be a valid hex color" })
  secondaryColor?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#([0-9A-Fa-f]{3}){1,2}$/, { message: "backgroundColor must be a valid hex color" })
  backgroundColor?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  contactAddress?: string;

  @IsString()
  @IsOptional()
  workingHours?: string;

  @IsUrl()
  @IsOptional()
  facebookUrl?: string;

  @IsUrl()
  @IsOptional()
  instagramUrl?: string;

  @IsUrl()
  @IsOptional()
  tiktokUrl?: string;

  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  // ── Tax & service charge ──
  @IsBoolean()
  @IsOptional()
  taxEnabled?: boolean;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  taxRate?: number;

  @IsBoolean()
  @IsOptional()
  serviceEnabled?: boolean;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  serviceRate?: number;

  // ── Table management ──
  @IsNumber()
  @Min(0)
  @Max(500)
  @IsOptional()
  totalTables?: number;

  @IsNumber()
  @Min(1)
  @Max(500)
  @IsOptional()
  tableNumberStart?: number;

  @IsNumber()
  @Min(1)
  @Max(500)
  @IsOptional()
  tableNumberEnd?: number;

  @IsNumber()
  @Min(1)
  @Max(480) // max 8 hours in minutes
  @IsOptional()
  staleThresholdMinutes?: number;
}

@Controller("settings")
@UseGuards(RolesGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Public()
  @Get()
  get() {
    return this.settingsService.get();
  }

  @Roles("admin")
  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }

  @Roles("admin")
  @Post("reset")
  reset() {
    return this.settingsService.reset();
  }
}
