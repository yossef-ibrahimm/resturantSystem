export interface MainExpenseCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  description: string;
  active: boolean;
  subCategories?: SubExpenseCategory[];
  _count?: { subCategories: number };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface SubExpenseCategory {
  id: string;
  mainCategoryId: string;
  nameAr: string;
  nameEn: string;
  description: string;
  active: boolean;
  mainCategory?: { id: string; nameAr: string; nameEn: string };
  _count?: { expenses: number };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Expense {
  id: string;
  subCategoryId: string;
  amount: number;
  spentAt: string;
  paymentMethod: string;
  description: string;
  note?: string | null;
  receiptUrl?: string | null;
  recordedById?: string | null;
  recordedBy?: { id: string; name: string } | null;
  cashShiftId?: string | null;
  cashShift?: { id: string; openedAt: string; status: string } | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed from relations
  subCategory?: SubExpenseCategory;
  mainCategoryNameAr?: string;
  mainCategoryNameEn?: string;
  subCategoryNameAr?: string;
  subCategoryNameEn?: string;
}

export interface ExpenseSummary {
  grandTotal: number;
  totalCount: number;
  byMainCategory: {
    mainCategoryId: string;
    nameAr: string;
    nameEn: string;
    total: number;
    count: number;
  }[];
  byPaymentMethod: {
    method: string;
    total: number;
  }[];
}

export interface ExpenseListResponse {
  items: Expense[];
  total: number;
  take: number;
  skip: number;
}
