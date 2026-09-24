import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";
import { AttendanceService } from "./attendance.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";

class ClockInDto {
  @IsOptional()
  @IsString()
  note?: string;
}

@Controller("attendance")
@UseGuards(RolesGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Roles("admin", "kitchen_staff", "waiter", "cashier")
  @Get("me/status")
  status(@CurrentUser() user: { id: string }) {
    return this.attendanceService.status(user.id);
  }

  @Roles("admin", "kitchen_staff", "waiter", "cashier")
  @Post("me/clock-in")
  clockIn(@CurrentUser() user: { id: string }, @Body() dto: ClockInDto) {
    return this.attendanceService.clockIn(user.id, dto.note);
  }

  @Roles("admin", "kitchen_staff", "waiter", "cashier")
  @Post("me/clock-out")
  clockOut(@CurrentUser() user: { id: string }) {
    return this.attendanceService.clockOut(user.id);
  }

  @Roles("admin")
  @Get("today")
  today() {
    return this.attendanceService.today();
  }

  @Roles("admin")
  @Get("records")
  records(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("userId") userId?: string
  ) {
    return this.attendanceService.records(from, to, userId);
  }

  @Roles("admin")
  @Get("summary")
  summary(@Query("from") from?: string, @Query("to") to?: string) {
    return this.attendanceService.summary(from, to);
  }
}