import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { MenuModule } from "./menu/menu.module";
import { OrdersModule } from "./orders/orders.module";
import { UsersModule } from "./users/users.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { ReportsModule } from "./reports/reports.module";
import { StorageModule } from "./storage/storage.module";
import { WebsocketModule } from "./websocket/websocket.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { SettingsModule } from "./settings/settings.module";
import { InventoryModule } from "./inventory/inventory.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { CashShiftsModule } from "./cash-shifts/cash-shifts.module";
import { ExpenseModule } from "./expense/expense.module";
import { TablesModule } from "./tables/tables.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { StaffAwareThrottlerGuard } from "./common/guards/staff-throttler.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    PrismaModule,
    AuthModule,
    MenuModule,
    OrdersModule,
    UsersModule,
    DashboardModule,
    ReportsModule,
    StorageModule,
    WebsocketModule,
    AttendanceModule,
    SettingsModule,
    InventoryModule,
    NotificationsModule,
    CashShiftsModule,
    ExpenseModule,
    TablesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: StaffAwareThrottlerGuard,
    },
  ],
})
export class AppModule {}
