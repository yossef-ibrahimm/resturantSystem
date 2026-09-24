export const ORDER_STATUS_FLOW = ["received", "preparing", "ready", "completed"] as const;

export const ORDER_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  received: { ar: "تم الاستلام", en: "Received" },
  preparing: { ar: "جاري التحضير", en: "Preparing" },
  ready: { ar: "جاهز", en: "Ready" },
  completed: { ar: "تم التسليم", en: "Completed" },
  cancelled: { ar: "ملغي", en: "Cancelled" },
};

export const ORDER_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  dine_in: { ar: "صالة", en: "Dine-in" },
  takeaway: { ar: "تيك أواي", en: "Takeaway" },
};

export const STATUS_COLORS: Record<string, string> = {
  received: "bg-status-received text-status-received-fg border border-status-received-border",
  preparing: "bg-status-preparing text-status-preparing-fg border border-status-preparing-border",
  ready: "bg-status-ready text-status-ready-fg border border-status-ready-border",
  completed: "bg-status-completed text-status-completed-fg border border-status-completed-border",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/20 line-through decoration-1",
};

export const STATUS_BAR_COLORS: Record<string, string> = {
  received: "bg-status-received",
  preparing: "bg-status-preparing",
  ready: "bg-status-ready",
  completed: "bg-status-completed",
  cancelled: "bg-destructive/40",
};

export const ROLE_LANDING: Record<string, string> = {
  admin: "/admin",
  kitchen_staff: "/kitchen",
  waiter: "/waiter",
  cashier: "/cashier",
};
