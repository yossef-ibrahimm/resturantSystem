export const ORDER_STATUS_FLOW = ["received", "preparing", "ready", "completed"] as const;

export const ORDER_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  received: { ar: "تم الاستلام", en: "Received" },
  preparing: { ar: "جاري التحضير", en: "Preparing" },
  ready: { ar: "جاهز", en: "Ready" },
  completed: { ar: "تم التسليم", en: "Completed" },
};

export const ORDER_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  dine_in: { ar: "صالة", en: "Dine-in" },
  takeaway: { ar: "تيك أواي", en: "Takeaway" },
};

export const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-amber-100 text-amber-800 border-amber-200",
  ready: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
};
