import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { WebsocketModule } from "../websocket/websocket.module";
import { InventoryModule } from "../inventory/inventory.module";
import { CashShiftsModule } from "../cash-shifts/cash-shifts.module";

@Module({
  imports: [WebsocketModule, InventoryModule, CashShiftsModule],
  providers: [OrdersService, PaymentsService],
  controllers: [OrdersController, PaymentsController],
  exports: [OrdersService, PaymentsService],
})
export class OrdersModule {}
