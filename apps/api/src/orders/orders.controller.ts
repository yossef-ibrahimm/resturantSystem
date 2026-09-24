import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request } from "express";
import { OrdersService } from "./orders.service";
import { Public } from "../common/guards/public.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import {
  IsString, IsNumber, IsOptional, IsArray, ValidateNested, Min, Max,
  IsIn, IsNotEmpty, MaxLength, ArrayMaxSize, ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Phase 1 (audit SEC-1): the client no longer sends names or prices.
 * The server resolves everything from MenuItem.
 */
class CreateOrderItemDto {
  @IsString() menuItemId: string;
  @IsNumber() @Min(1) @Max(99) quantity: number;
  @IsString() @IsOptional() @MaxLength(100) variant?: string;
  @IsString() @IsOptional() @MaxLength(280) notes?: string;
}

class CreateOrderDto {
  @IsString() @IsNotEmpty() @MaxLength(80) customerName: string;
  @IsString() @IsOptional() @MaxLength(20) phone?: string;
  @IsString() @IsIn(["dine_in", "takeaway"]) orderType: string;
  @IsNumber() @IsOptional() @Min(1) @Max(500) tableNumber?: number;
  @IsString() @IsOptional() @MaxLength(280) notes?: string;
  @IsString() @IsOptional() @MaxLength(100) idempotencyKey?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto) items: CreateOrderItemDto[];
}

class UpdateStatusDto {
  @IsString() @IsIn(["received", "preparing", "ready", "completed"]) status: string;
}

class CancelOrderDto {
  @IsString() @IsNotEmpty() @MaxLength(280) reason: string;
}

class ApplyDiscountDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsString() @IsNotEmpty() @MaxLength(280) reason: string;
}

@Controller("orders")
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Roles("admin", "kitchen_staff", "waiter", "cashier")
  @Get()
  findAll(
    @Query("status") status?: string,
    @Query("take") take?: string,
    @Query("cursor") cursor?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.ordersService.findAll({
      status,
      take: take ? Number(take) : undefined,
      cursor: cursor || undefined,
      from,
      to,
    });
  }

  /**
   * Public lookup by opaque token. The 4-digit orderNumber endpoint is gone —
   * orderNumber remains a display-only field. Throttled as defense-in-depth.
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get("by-token/:orderToken")
  findByToken(@Param("orderToken") orderToken: string) {
    return this.ordersService.findByToken(orderToken);
  }

  @Roles("admin", "kitchen_staff", "waiter", "cashier")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.ordersService.findById(id);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateOrderDto, @Req() req: Request) {
    const createdByUserId = (req.user as { id?: string } | undefined)?.id;

    return this.ordersService.create({
      ...dto,
      orderType: dto.orderType as "dine_in" | "takeaway",
      idempotencyKey: dto.idempotencyKey,
      createdByUserId,
    });
  }

  @Roles("admin", "kitchen_staff", "waiter", "cashier")
  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.ordersService.updateStatus(id, dto.status, user?.id);
  }

  /**
   * Cashier can cancel only "received" orders (no reason required).
   * Admin can cancel "received" or "preparing" with a required reason.
   */
  @Roles("admin", "cashier")
  @Patch(":id/cancel")
  cancel(
    @Param("id") id: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    if (user?.role === "cashier") {
      return this.ordersService.cancelByCashier(id, user.id);
    }
    return this.ordersService.cancel(id, dto.reason, user?.id);
  }

  /**
   * Admin-only discount endpoint. Recalculates Order.total.
   */
  @Roles("admin")
  @Patch(":id/discount")
  applyDiscount(
    @Param("id") id: string,
    @Body() dto: ApplyDiscountDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.ordersService.applyDiscount(id, dto.amount, dto.reason, user?.id);
  }

  /**
   * Public bill-request, keyed by opaque token. The by-number variant is removed.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch("by-token/:orderToken/request-bill")
  requestBillByToken(@Param("orderToken") orderToken: string) {
    return this.ordersService.requestBillByToken(orderToken);
  }

  @Roles("admin", "waiter", "cashier")
  @Patch(":id/acknowledge-bill")
  acknowledgeBill(@Param("id") id: string, @CurrentUser() user: { id: string }) {
    return this.ordersService.acknowledgeBill(id, user?.id);
  }
}
