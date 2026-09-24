import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { ExpenseCategoriesService } from "./expense-categories.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";

class CreateMainCategoryDto {
  @IsString() nameAr: string;
  @IsString() nameEn: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
}

class UpdateMainCategoryDto {
  @IsString() @IsOptional() nameAr?: string;
  @IsString() @IsOptional() nameEn?: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

class CreateSubCategoryDto {
  @IsString() mainCategoryId: string;
  @IsString() nameAr: string;
  @IsString() nameEn: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
}

class UpdateSubCategoryDto {
  @IsString() @IsOptional() mainCategoryId?: string;
  @IsString() @IsOptional() nameAr?: string;
  @IsString() @IsOptional() nameEn?: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

@Controller("expense-categories")
@UseGuards(RolesGuard)
export class ExpenseCategoriesController {
  constructor(private service: ExpenseCategoriesService) {}

  // ─── Main Categories ───

  @Roles("admin")
  @Get("main")
  findAllMain() {
    return this.service.findAllMainCategories();
  }

  @Roles("admin", "cashier", "waiter")
  @Get("main/active")
  findActiveMain() {
    return this.service.findActiveMainCategories();
  }

  @Roles("admin")
  @Get("main/:id")
  findOneMain(@Param("id") id: string) {
    return this.service.findMainCategory(id);
  }

  @Roles("admin")
  @Post("main")
  createMain(@Body() dto: CreateMainCategoryDto) {
    return this.service.createMainCategory(dto);
  }

  @Roles("admin")
  @Patch("main/:id")
  updateMain(@Param("id") id: string, @Body() dto: UpdateMainCategoryDto) {
    return this.service.updateMainCategory(id, dto);
  }

  @Roles("admin")
  @Delete("main/:id")
  deleteMain(@Param("id") id: string) {
    return this.service.deleteMainCategory(id);
  }

  // ─── Sub Categories ───

  @Roles("admin")
  @Get("sub")
  findAllSub(@Query("mainCategoryId") mainCategoryId?: string) {
    return this.service.findAllSubCategories({ mainCategoryId });
  }

  @Roles("admin", "cashier", "waiter")
  @Get("sub/active")
  findActiveSub() {
    return this.service.findActiveSubCategories();
  }

  @Roles("admin")
  @Get("sub/:id")
  findOneSub(@Param("id") id: string) {
    return this.service.findSubCategory(id);
  }

  @Roles("admin")
  @Post("sub")
  createSub(@Body() dto: CreateSubCategoryDto) {
    return this.service.createSubCategory(dto);
  }

  @Roles("admin")
  @Patch("sub/:id")
  updateSub(@Param("id") id: string, @Body() dto: UpdateSubCategoryDto) {
    return this.service.updateSubCategory(id, dto);
  }

  @Roles("admin")
  @Delete("sub/:id")
  deleteSub(@Param("id") id: string) {
    return this.service.deleteSubCategory(id);
  }
}
