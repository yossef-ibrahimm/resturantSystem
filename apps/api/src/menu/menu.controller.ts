import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { MenuService } from "./menu.service";
import { Public } from "../common/guards/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { IsString, IsNumber, IsOptional, IsBoolean, Min } from "class-validator";

// ─── DTOs ───

class CreateCategoryDto {
  @IsString() nameAr: string;
  @IsString() nameEn: string;
  @IsNumber() @IsOptional() sortOrder?: number;
}

class UpdateCategoryDto {
  @IsString() @IsOptional() nameAr?: string;
  @IsString() @IsOptional() nameEn?: string;
  @IsNumber() @IsOptional() sortOrder?: number;
}

class CreateMenuItemDto {
  @IsString() categoryId: string;
  @IsString() nameAr: string;
  @IsString() nameEn: string;
  @IsString() @IsOptional() descriptionAr?: string;
  @IsString() @IsOptional() descriptionEn?: string;
  @IsNumber() @Min(0) price: number;
  @IsString() @IsOptional() image?: string;
  @IsBoolean() @IsOptional() available?: boolean;
}

class UpdateMenuItemDto {
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() nameAr?: string;
  @IsString() @IsOptional() nameEn?: string;
  @IsString() @IsOptional() descriptionAr?: string;
  @IsString() @IsOptional() descriptionEn?: string;
  @IsNumber() @IsOptional() price?: number;
  @IsString() @IsOptional() image?: string;
  @IsBoolean() @IsOptional() available?: boolean;
}

// ─── Controllers ───

@Controller("categories")
@UseGuards(RolesGuard)
export class CategoriesController {
  constructor(private menuService: MenuService) {}

  @Public()
  @Get()
  findAll() {
    return this.menuService.findAllCategories();
  }

  @Roles("admin")
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.menuService.createCategory(dto);
  }

  @Roles("admin")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCategoryDto) {
    return this.menuService.updateCategory(id, dto);
  }

  @Roles("admin")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.menuService.deleteCategory(id);
  }
}

@Controller("menu-items")
@UseGuards(RolesGuard)
export class MenuItemsController {
  constructor(private menuService: MenuService) {}

  @Public()
  @Get()
  findAll() {
    return this.menuService.findAllMenuItems();
  }

  @Public()
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.menuService.findMenuItem(id);
  }

  @Roles("admin")
  @Post()
  create(@Body() dto: CreateMenuItemDto) {
    return this.menuService.createMenuItem(dto);
  }

  @Roles("admin")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateMenuItemDto) {
    return this.menuService.updateMenuItem(id, dto);
  }

  @Roles("admin")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.menuService.deleteMenuItem(id);
  }
}
