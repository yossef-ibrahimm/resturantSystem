import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { StockService } from "./stock.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import {
  IsString, IsNumber, IsOptional, IsBoolean, Min, IsDateString, IsIn, MinLength, IsNotEmpty,
} from "class-validator";

// ─── Category DTOs ───

class CreateInventoryCategoryDto {
  @IsString() @MinLength(1) nameAr: string;
  @IsString() @MinLength(1) nameEn: string;
  @IsString() @IsOptional() description?: string;
  @IsNumber() @IsOptional() sortOrder?: number;
}

class UpdateInventoryCategoryDto {
  @IsString() @IsOptional() nameAr?: string;
  @IsString() @IsOptional() nameEn?: string;
  @IsString() @IsOptional() description?: string;
  @IsNumber() @IsOptional() sortOrder?: number;
  @IsBoolean() @IsOptional() active?: boolean;
}

// ─── Item DTOs ───

class CreateInventoryItemDto {
  @IsString() categoryId: string;
  @IsString() @MinLength(1) nameAr: string;
  @IsString() @MinLength(1) nameEn: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() unit?: string;
  @IsNumber() @IsOptional() @Min(0) minQty?: number;
  @IsNumber() @IsOptional() @Min(0) reorderPoint?: number;
  @IsNumber() @IsOptional() @Min(0) recommendedReorderQty?: number;
}

class UpdateInventoryItemDto {
  @IsString() @IsOptional() categoryId?: string;
  @IsString() @IsOptional() nameAr?: string;
  @IsString() @IsOptional() nameEn?: string;
  @IsString() @IsOptional() code?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() unit?: string;
  @IsNumber() @IsOptional() @Min(0) minQty?: number;
  @IsNumber() @IsOptional() @Min(0) reorderPoint?: number;
  @IsNumber() @IsOptional() @Min(0) recommendedReorderQty?: number;
  @IsBoolean() @IsOptional() active?: boolean;
}

// ─── Stock DTOs ───

class AddStockDto {
  @IsString() inventoryItemId: string;
  @IsNumber() @Min(0.001) quantity: number;
  @IsString() unit: string;
  @IsString() @IsOptional() reason?: string;
  @IsString() @IsOptional() note?: string;
  @IsNumber() @IsOptional() @Min(0) unitCost?: number;
  @IsDateString() @IsOptional() date?: string;
}

class DeductStockDto {
  @IsString() inventoryItemId: string;
  @IsNumber() @Min(0.001) quantity: number;
  @IsString() unit: string;
  @IsString() @IsNotEmpty() reason: string;
  @IsString() @IsOptional() note?: string;
  @IsNumber() @IsOptional() @Min(0) unitCost?: number;
  @IsDateString() @IsOptional() date?: string;
}

class AdjustStockDto {
  @IsString() inventoryItemId: string;
  @IsNumber() @Min(0) newQuantity: number;
  @IsString() @IsNotEmpty() reason: string;
  @IsString() @IsOptional() note?: string;
}

// ─── Controllers ───

@Controller("inventory/categories")
@UseGuards(RolesGuard)
export class InventoryCategoriesController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  findAll() {
    return this.inventoryService.findAllCategories();
  }

  @Get("active")
  findActive() {
    return this.inventoryService.findActiveCategories();
  }

  @Roles("admin")
  @Post()
  create(@Body() dto: CreateInventoryCategoryDto) {
    return this.inventoryService.createCategory(dto);
  }

  @Roles("admin")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateInventoryCategoryDto) {
    return this.inventoryService.updateCategory(id, dto);
  }

  @Roles("admin")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.inventoryService.deleteCategory(id);
  }
}

@Controller("inventory/items")
@UseGuards(RolesGuard)
export class InventoryItemsController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  findAll(
    @Query("categoryId") categoryId?: string,
    @Query("active") active?: string,
    @Query("search") search?: string,
  ) {
    const params: { categoryId?: string; active?: boolean; search?: string } = {};
    if (categoryId) params.categoryId = categoryId;
    if (active !== undefined) params.active = active === "true";
    if (search) params.search = search;
    return this.inventoryService.findAllItems(params);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.inventoryService.findItem(id);
  }

  @Roles("admin")
  @Post()
  create(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.createItem(dto);
  }

  @Roles("admin")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryService.updateItem(id, dto);
  }

  @Roles("admin")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.inventoryService.deleteItem(id);
  }
}

@Controller("inventory/stock")
@UseGuards(RolesGuard)
export class StockController {
  constructor(private stockService: StockService) {}

  @Roles("admin")
  @Post("add")
  addStock(@Body() dto: AddStockDto, @CurrentUser() user: { id: string }) {
    return this.stockService.addStock({
      ...dto,
      type: "purchase",
      actorId: user?.id,
    });
  }

  @Roles("admin")
  @Post("deduct")
  deductStock(@Body() dto: DeductStockDto, @CurrentUser() user: { id: string }) {
    return this.stockService.deductStock({
      ...dto,
      type: "adjustment_down",
      actorId: user?.id,
    });
  }

  @Roles("admin")
  @Post("adjust")
  adjustStock(@Body() dto: AdjustStockDto, @CurrentUser() user: { id: string }) {
    return this.stockService.adjustStock({
      ...dto,
      actorId: user?.id,
    });
  }
}

@Controller("inventory/movements")
@UseGuards(RolesGuard)
export class StockMovementsController {
  constructor(private inventoryService: InventoryService) {}

  @Get("all")
  getAllMovements(
    @Query("take") take?: string,
    @Query("skip") skip?: string,
    @Query("type") type?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("search") search?: string,
  ) {
    return this.inventoryService.getAllMovements({
      take: take ? parseInt(take, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
      type,
      from,
      to,
      search,
    });
  }

  @Get(":itemId")
  getMovements(
    @Param("itemId") itemId: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.inventoryService.getMovements(itemId, {
      take: take ? parseInt(take, 10) : undefined,
      skip: skip ? parseInt(skip, 10) : undefined,
    });
  }
}

@Controller("inventory/dashboard")
@UseGuards(RolesGuard)
export class InventoryDashboardController {
  constructor(private inventoryService: InventoryService) {}

  @Get()
  getDashboard() {
    return this.inventoryService.getDashboard();
  }
}

@Controller("inventory/alerts")
@UseGuards(RolesGuard)
export class InventoryAlertsController {
  constructor(private stockService: StockService) {}

  @Get()
  getAlerts() {
    return this.stockService.getLowStockAlerts();
  }
}

@Controller("inventory/reports")
@UseGuards(RolesGuard)
export class InventoryReportsController {
  constructor(private inventoryService: InventoryService) {}

  @Get("all-items")
  getAllItemsReport(
    @Query("categoryId") categoryId?: string,
    @Query("search") search?: string,
  ) {
    return this.inventoryService.getAllItemsReport({ categoryId, search });
  }

  @Get("low-stock")
  getLowStockReport(
    @Query("categoryId") categoryId?: string,
    @Query("search") search?: string,
  ) {
    return this.inventoryService.getLowStockReport({ categoryId, search });
  }

  @Get("out-of-stock")
  getOutOfStockReport(
    @Query("categoryId") categoryId?: string,
    @Query("search") search?: string,
  ) {
    return this.inventoryService.getOutOfStockReport({ categoryId, search });
  }

  @Get("summary")
  getInventorySummaryReport() {
    return this.inventoryService.getInventorySummaryReport();
  }
}
