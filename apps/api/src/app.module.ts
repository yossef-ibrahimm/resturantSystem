import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { MenuModule } from "./menu/menu.module";
import { OrdersModule } from "./orders/orders.module";
import { UsersModule } from "./users/users.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { ReportsModule } from "./reports/reports.module";
import { StorageModule } from "./storage/storage.module";
import { WebsocketModule } from "./websocket/websocket.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MenuModule,
    OrdersModule,
    UsersModule,
    DashboardModule,
    ReportsModule,
    StorageModule,
    WebsocketModule,
  ],
})
export class AppModule {}
