import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { Public } from "../common/guards/public.decorator";
import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, Min, IsIn } from "class-validator";
import { Type } from "class-transformer";

class CreateOrderItemDto {
  @IsString() menuItemId: string;
  @IsString() nameAr: string;
  @IsString() nameEn: string;
  @IsNumber() @Min(1) quantity: number;
  @IsNumber() @Min(0) unitPrice: number;
  @IsString() @IsOptional() variant?: string;
  @IsString() @IsOptional() notes?: string;
}

class CreateOrderDto {
  @IsString() customerName: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsIn(["dine_in", "takeaway"]) orderType: string;
  @IsNumber() @IsOptional() tableNumber?: number;
  @IsString() @IsOptional() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto) items: CreateOrderItemDto[];
}

class UpdateStatusDto {
  @IsString() @IsIn(["received", "preparing", "ready", "completed"]) status: string;
}

@Controller("orders")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Public()
  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Public()
  @Get("by-number/:orderNumber")
  findByNumber(@Param("orderNumber") orderNumber: string) {
    return this.ordersService.findByNumber(orderNumber);
  }

  @Public()
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.ordersService.findById(id);
  }

  @Public()
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create({
      ...dto,
      orderType: dto.orderType as "dine_in" | "takeaway",
    });
  }

  @Public()
  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateStatusDto) {
    return this.ordersService.updateStatus(id, dto.status);
  }
}
