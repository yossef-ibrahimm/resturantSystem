import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/i18n";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "@/lib/api";
import { onSocketEvent } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, Trash2, Package, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import type { Notification } from "@/lib/types";

function timeAgo(dateStr: string, isArabic: boolean): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return isArabic ? "الآن" : "Just now";
  if (diffMin < 60) return isArabic ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return isArabic ? `منذ ${diffH} ساعة` : `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return isArabic ? `منذ ${diffD} يوم` : `${diffD}d ago`;
}

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "inventory_out_of_stock":
    case "inventory_low_stock":
      return Package;
    case "menu_out_of_stock":
      return UtensilsCrossed;
    default:
      return Bell;
  }
}

function getNotificationBadgeClass(type: Notification["type"]): string {
  switch (type) {
    case "inventory_out_of_stock":
    case "menu_out_of_stock":
      return "bg-destructive/10 text-destructive";
    case "inventory_low_stock":
      return "bg-amber-500/10 text-amber-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function NotificationBell() {
  const { t, isArabic } = useLanguage();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const [notifs, { count }] = await Promise.all([
        getNotifications(),
        getUnreadNotificationCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch {
      /* silently fail */
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const unsubNew = onSocketEvent("notification:new", () => {
      fetchNotifications();
    });
    const unsubResolved = onSocketEvent("notification:resolved", () => {
      fetchNotifications();
    });
    return () => {
      unsubNew();
      unsubResolved();
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error(isArabic ? "فشل التحديث" : "Failed to update");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      toast.error(isArabic ? "فشل التحديث" : "Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const wasUnread = notifications.find((n) => n.id === id && !n.isRead);
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error(isArabic ? "فشل الحذف" : "Failed to delete");
    }
  };

  const getLabel = (n: Notification) => {
    return isArabic ? n.titleAr : n.titleEn;
  };

  const getMessage = (n: Notification) => {
    return isArabic ? n.messageAr : n.messageEn;
  };

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) fetchNotifications();
        }}
        aria-label={isArabic ? "الإشعارات" : "Notifications"}
        aria-expanded={open}
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -end-1 h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="absolute top-full left--20 z-50 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card shadow-elevated"
          role="menu"
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <h3 className="font-display text-sm font-semibold">
              {t.notifications.title}
            </h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleMarkAllRead}
              >
                <Check className="me-1 h-3 w-3" />
                {t.notifications.markAllRead}
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-80">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-2 rounded-full bg-muted p-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t.notifications.noNotifications}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {t.notifications.emptyDesc}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {notifications.map((n) => {
                  const Icon = getNotificationIcon(n.type);
                  return (
                    <div
                      key={n.id}
                      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                        !n.isRead ? "bg-primary/5" : ""
                      }`}
                    >
                      <div
                        className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${getNotificationBadgeClass(
                          n.type
                        )}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm leading-snug ${
                              !n.isRead ? "font-semibold" : "font-medium"
                            }`}
                          >
                            {getLabel(n)}
                          </p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {timeAgo(n.createdAt, isArabic)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {getMessage(n)}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1">
                          {!n.isRead && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => handleMarkAsRead(n.id)}
                            >
                              <Check className="me-0.5 h-2.5 w-2.5" />
                              {t.notifications.markAsRead}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                            onClick={() => handleDelete(n.id)}
                          >
                            <Trash2 className="me-0.5 h-2.5 w-2.5" />
                            {t.notifications.delete}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
