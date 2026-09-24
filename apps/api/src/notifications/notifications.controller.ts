import { Controller, Get, Patch, Delete, Param, Query, Body, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";

@Controller("notifications")
@UseGuards(RolesGuard)
@Roles("admin")
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(@Query("unreadOnly") unreadOnly?: string) {
    return this.notificationsService.findAll({
      unreadOnly: unreadOnly === "true",
    });
  }

  @Get("unread-count")
  getUnreadCount() {
    return this.notificationsService.getUnreadCount();
  }

  @Patch(":id/read")
  markAsRead(@Param("id") id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch("read-all")
  markAllAsRead() {
    return this.notificationsService.markAllAsRead();
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    return this.notificationsService.delete(id);
  }
}
