import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { IsString, IsEmail, IsIn, IsOptional, MinLength } from "class-validator";

class CreateUserDto {
  @IsEmail() email: string;
  @IsString() name: string;
  @IsString() @IsIn(["admin", "kitchen_staff", "waiter"]) role: string;
  @IsString() @MinLength(6) @IsOptional() password?: string;
}

@Controller("users")
@UseGuards(RolesGuard)
@Roles("admin")
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create({
      ...dto,
      role: dto.role as "admin" | "kitchen_staff" | "waiter",
    });
  }

  @Patch(":id/toggle-active")
  toggleActive(@Param("id") id: string) {
    return this.usersService.toggleActive(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.usersService.delete(id);
  }
}
