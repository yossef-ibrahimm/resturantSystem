import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { CashShiftsService } from "./cash-shifts.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";

class OpenShiftDto {
  @IsNumber() @Min(0) openingFloat: number;
}

class CloseShiftDto {
  @IsNumber() @Min(0) closingFloat: number;
  @IsString() @IsOptional() @MaxLength(500) notes?: string;
}

@Controller("cash-shifts")
@UseGuards(RolesGuard)
export class CashShiftsController {
  constructor(private service: CashShiftsService) {}

  /**
   * Anyone with a staff role can read the current shift state.
   * Cashier needs this to know "shift is open" before taking cash.
   */
  @Roles("admin", "cashier", "waiter", "kitchen_staff")
  @Get("current")
  current() {
    return this.service.getCurrentOpen();
  }

  /**
   * Admin or cashier opens a shift. (One open shift at a time — single-drawer policy.)
   */
  @Roles("admin", "cashier")
  @Post("open")
  open(@Body() dto: OpenShiftDto, @CurrentUser() user: { id: string }) {
    return this.service.open(user.id, dto.openingFloat);
  }

  /**
   * Admin or cashier closes the open shift. Computes expected vs actual cash variance.
   */
  @Roles("admin", "cashier")
  @Post("close")
  close(@Body() dto: CloseShiftDto, @CurrentUser() user: { id: string }) {
    return this.service.close(user.id, dto.closingFloat, dto.notes);
  }

  @Roles("admin")
  @Get()
  findAll(@Query("take") take?: string, @Query("skip") skip?: string) {
    return this.service.findAll({
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Roles("admin")
  @Get(":id")
  findById(@Param("id") id: string) {
    return this.service.findById(id);
  }
}
