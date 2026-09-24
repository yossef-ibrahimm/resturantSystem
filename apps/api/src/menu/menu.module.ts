import { Module } from "@nestjs/common";
import { MenuService } from "./menu.service";
import { CategoriesController, MenuItemsController } from "./menu.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { WebsocketModule } from "../websocket/websocket.module";

@Module({
  imports: [NotificationsModule, WebsocketModule],
  providers: [MenuService],
  controllers: [CategoriesController, MenuItemsController],
  exports: [MenuService],
})
export class MenuModule {}
