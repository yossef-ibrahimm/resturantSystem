import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { ExpensesService } from "./expenses.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";

class CreateExpenseDto {
  @IsString() subCategoryId: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsDateString() spentAt: string;
  @IsString() @IsOptional() paymentMethod?: string;
  @IsString() description: string;
  @IsString() @IsOptional() @MaxLength(500) note?: string;
  @IsString() @IsOptional() receiptUrl?: string;
  @IsString() @IsOptional() cashShiftId?: string;
}

class UpdateExpenseDto {
  @IsString() @IsOptional() subCategoryId?: string;
  @IsNumber() @Min(0.01) @IsOptional() amount?: number;
  @IsDateString() @IsOptional() spentAt?: string;
  @IsString() @IsOptional() paymentMethod?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() @MaxLength(500) note?: string;
  @IsString() @IsOptional() receiptUrl?: string;
}

@Controller("expenses")
@UseGuards(RolesGuard)
export class ExpensesController {
  constructor(private service: ExpensesService) {}

  @Roles("admin")
  @Get()
  findAll(
    @Query("take") take?: string,
    @Query("skip") skip?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("subCategoryId") subCategoryId?: string,
    @Query("mainCategoryId") mainCategoryId?: string,
    @Query("paymentMethod") paymentMethod?: string,
    @Query("search") search?: string
  ) {
    return this.service.findAll({
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
      from,
      to,
      subCategoryId,
      mainCategoryId,
      paymentMethod,
      search,
    });
  }

  @Roles("admin")
  @Get("summary")
  getSummary(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("mainCategoryId") mainCategoryId?: string,
    @Query("paymentMethod") paymentMethod?: string,
    @Query("search") search?: string
  ) {
    return this.service.getSummary({ from, to, mainCategoryId, paymentMethod, search });
  }

  @Roles("admin")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Roles("admin", "cashier")
  @Post()
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: { id: string }) {
    return this.service.create({
      ...dto,
      recordedById: user.id,
    });
  }

  @Roles("admin")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateExpenseDto) {
    return this.service.update(id, dto);
  }

  @Roles("admin")
  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.service.delete(id);
  }
}
