import { Module } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { StockService } from "./stock.service";
import {
  InventoryCategoriesController,
  InventoryItemsController,
  StockController,
  StockMovementsController,
  InventoryDashboardController,
  InventoryAlertsController,
  InventoryReportsController,
} from "./inventory.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { WebsocketModule } from "../websocket/websocket.module";

@Module({
  imports: [NotificationsModule, WebsocketModule],
  providers: [InventoryService, StockService],
  controllers: [
    InventoryCategoriesController,
    InventoryItemsController,
    StockController,
    StockMovementsController,
    InventoryDashboardController,
    InventoryAlertsController,
    InventoryReportsController,
  ],
  exports: [InventoryService, StockService],
})
export class InventoryModule {}
