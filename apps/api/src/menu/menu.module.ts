import { Module } from "@nestjs/common";
import { MenuService } from "./menu.service";
import { CategoriesController, MenuItemsController } from "./menu.controller";

@Module({
  providers: [MenuService],
  controllers: [CategoriesController, MenuItemsController],
  exports: [MenuService],
})
export class MenuModule {}
