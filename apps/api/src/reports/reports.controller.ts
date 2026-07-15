import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";

@Controller("reports")
@UseGuards(RolesGuard)
@Roles("admin")
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get("summary")
  getSummary(@Query("from") from?: string, @Query("to") to?: string) {
    return this.reportsService.getSummary(from, to);
  }

  @Get("revenue")
  getRevenueOverTime(@Query("from") from?: string, @Query("to") to?: string) {
    return this.reportsService.getRevenueOverTime(from, to);
  }

  @Get("orders-by-status")
  getOrdersByStatus(@Query("from") from?: string, @Query("to") to?: string) {
    return this.reportsService.getOrdersByStatus(from, to);
  }

  @Get("top-items")
  getTopItems(@Query("from") from?: string, @Query("to") to?: string) {
    return this.reportsService.getTopItems(from, to);
  }

  @Get("peak-hours")
  getPeakHours(@Query("from") from?: string, @Query("to") to?: string) {
    return this.reportsService.getPeakHours(from, to);
  }

  @Get("unavailable-items")
  getUnavailableItems() {
    return this.reportsService.getUnavailableItems();
  }
}
