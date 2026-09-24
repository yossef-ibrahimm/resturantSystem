import { Module } from "@nestjs/common";
import { CashShiftsService } from "./cash-shifts.service";
import { CashShiftsController } from "./cash-shifts.controller";

@Module({
  providers: [CashShiftsService],
  controllers: [CashShiftsController],
  exports: [CashShiftsService],
})
export class CashShiftsModule {}
