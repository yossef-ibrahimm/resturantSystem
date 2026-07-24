import { Controller, Get, Post, Patch, Body, Param, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { OrdersService } from "./orders.service";
import { Public } from "../common/guards/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
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
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Roles("admin", "kitchen_staff", "waiter")
  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Public()
  @Get("by-number/:orderNumber")
  findByNumber(@Param("orderNumber") orderNumber: string) {
    return this.ordersService.findByNumber(orderNumber);
  }

  @Roles("admin", "kitchen_staff", "waiter")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.ordersService.findById(id);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create({
      ...dto,
      orderType: dto.orderType as "dine_in" | "takeaway",
    });
  }

  @Roles("admin", "kitchen_staff", "waiter")
  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateStatusDto) {
    return this.ordersService.updateStatus(id, dto.status);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Patch("by-number/:orderNumber/request-bill")
  requestBillByNumber(@Param("orderNumber") orderNumber: string) {
    return this.ordersService.requestBillByNumber(orderNumber);
  }

  @Roles("admin", "waiter")
  @Patch(":id/acknowledge-bill")
  acknowledgeBill(@Param("id") id: string) {
    return this.ordersService.acknowledgeBill(id);
  }
}
