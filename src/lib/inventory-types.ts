export interface InventoryCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  description: string;
  active: boolean;
  sortOrder: number;
  _count?: { items: number };
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  categoryId: string;
  category?: InventoryCategory;
  nameAr: string;
  nameEn: string;
  code?: string | null;
  description: string;
  unit: string;
  qtyOnHand: number;
  minQty: number;
  reorderPoint: number;
  recommendedReorderQty: number;
  avgUnitCost: number;
  active: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StockMovementType =
  | "initial"
  | "purchase"
  | "sale"
  | "consumption"
  | "waste"
  | "damage"
  | "expired"
  | "adjustment_up"
  | "adjustment_down"
  | "return";

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  inventoryItem?: { nameAr: string; nameEn: string };
  type: StockMovementType;
  quantity: number;
  unit: string;
  qtyBefore: number;
  qtyAfter: number;
  refType?: string | null;
  refId?: string | null;
  unitCost?: number | null;
  totalCost?: number | null;
  reason?: string | null;
  note?: string | null;
  actorId?: string | null;
  createdAt: string;
}

export type StockStatus = "normal" | "low" | "critical" | "out_of_stock";

export interface LowStockAlert {
  id: string;
  nameAr: string;
  nameEn: string;
  qtyOnHand: number;
  reorderPoint: number;
  minQty: number;
  unit: string;
  status: StockStatus;
  category?: { nameAr: string; nameEn: string };
}

export interface InventoryDashboard {
  totalItems: number;
  lowStockCount: number;
  criticalStockCount: number;
  outOfStockCount: number;
  lowStock: LowStockAlert[];
  criticalStock: LowStockAlert[];
  outOfStock: { id: string; nameAr: string; nameEn: string; unit: string }[];
  recentMovements: StockMovement[];
  totalInventoryValue: number;
}
