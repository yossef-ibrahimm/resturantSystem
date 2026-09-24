import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n";
import BrandingProvider from "@/components/BrandingProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";

import Navbar from "@/components/layout/Navbar";
import MenuPage from "@/features/menu/components/MenuPage";
import CheckoutPage from "@/features/checkout/components/CheckoutPage";
import OrderStatusPage from "@/features/orders/components/OrderStatusPage";

const AdminLayout = lazy(() => import("@/features/admin/components/AdminLayout"));
const AdminDashboard = lazy(() => import("@/features/admin/components/AdminDashboard"));
const MenuManagement = lazy(() => import("@/features/admin/components/MenuManagement"));
const OrderHistory = lazy(() => import("@/features/admin/components/OrderHistory"));
const StaffManagement = lazy(() => import("@/features/admin/components/StaffManagement"));
const AttendancePage = lazy(() => import("@/features/attendance/components/AttendancePage"));
const BrandingSettings = lazy(() => import("@/features/admin/components/BrandingSettings"));
const ReportsLayout = lazy(() => import("@/features/reports/components/ReportsLayout"));
const SalesReportPage = lazy(() => import("@/features/reports/pages/SalesReportPage"));
const OrdersReportPage = lazy(() => import("@/features/reports/pages/OrdersReportPage"));
const MenuReportPage = lazy(() => import("@/features/reports/pages/MenuReportPage"));
const RevenueReportPage = lazy(() => import("@/features/reports/pages/RevenueReportPage"));
const StaffReportPage = lazy(() => import("@/features/reports/pages/StaffReportPage"));
const ExpensesReportPage = lazy(() => import("@/features/reports/pages/ExpensesReportPage"));
const TableReportsPage = lazy(() => import("@/features/reports/pages/TableReportsPage"));
const KitchenPage = lazy(() => import("@/features/kitchen/components/KitchenPage"));
const WaiterPage = lazy(() => import("@/features/waiter/components/WaiterPage"));
const CashierPage = lazy(() => import("@/features/cashier/components/CashierPage"));
const LoginPage = lazy(() => import("@/features/auth/components/LoginPage"));
const ChangePasswordPage = lazy(() => import("@/features/auth/components/ChangePasswordPage"));
const InventoryDashboardPage = lazy(() => import("@/features/inventory/components/InventoryDashboardPage"));
const InventoryCategoriesPage = lazy(() => import("@/features/inventory/components/InventoryCategoriesPage"));
const InventoryItemsPage = lazy(() => import("@/features/inventory/components/InventoryItemsPage"));
const StockOperationsPage = lazy(() => import("@/features/inventory/components/StockOperationsPage"));
const AllItemsReportPage = lazy(() => import("@/features/inventory/components/reports/AllItemsReportPage"));
const LowStockReportPage = lazy(() => import("@/features/inventory/components/reports/LowStockReportPage"));
const OutOfStockReportPage = lazy(() => import("@/features/inventory/components/reports/OutOfStockReportPage"));
const StockMovementsReportPage = lazy(() => import("@/features/inventory/components/reports/StockMovementsReportPage"));
const ExpenseCategoriesPage = lazy(() => import("@/features/expense/components/ExpenseCategoriesPage"));
const ExpenseEntriesPage = lazy(() => import("@/features/expense/components/ExpenseEntriesPage"));
const ExpenseManagementPage = lazy(() => import("@/features/expense/components/ExpenseManagementPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const staffFallback = (
  <div className="flex min-h-screen items-center justify-center text-muted-foreground">
    Loading...
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <BrandingProvider>
        <TooltipProvider>
          <Toaster />
          <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ErrorBoundary>
              <Routes>
                {/* Public routes — eagerly loaded, no auth */}
                <Route path="/" element={<PublicLayout><MenuPage /></PublicLayout>} />
                <Route path="/order-status" element={<PublicLayout><OrderStatusPage /></PublicLayout>} />
                <Route path="/checkout" element={<PublicLayout><CheckoutPage /></PublicLayout>} />

                {/* Public auth routes — no auth required */}
                <Route path="/admin/login" element={<ProtectedRoute publicOnly><Suspense fallback={staffFallback}><LoginPage /></Suspense></ProtectedRoute>} />
                <Route path="/change-password" element={<ProtectedRoute><Suspense fallback={staffFallback}><ChangePasswordPage /></Suspense></ProtectedRoute>} /> 

                {/* Staff routes — lazy loaded, auth-gated */}
                <Route path="/kitchen" element={<Suspense fallback={staffFallback}><ProtectedRoute allowedRoles={["kitchen_staff"]}><KitchenPage /></ProtectedRoute></Suspense>} />
                <Route path="/waiter" element={<Suspense fallback={staffFallback}><ProtectedRoute allowedRoles={["waiter"]}><WaiterPage /></ProtectedRoute></Suspense>} />
                <Route path="/cashier" element={<Suspense fallback={staffFallback}><ProtectedRoute allowedRoles={["cashier"]}><CashierPage /></ProtectedRoute></Suspense>} />

                <Route path="/admin" element={<Suspense fallback={staffFallback}><ProtectedRoute allowedRoles={["admin"]}><AdminLayout /></ProtectedRoute></Suspense>}>
                  <Route index element={<Suspense fallback={staffFallback}><AdminDashboard /></Suspense>} />
                  <Route path="menu" element={<Suspense fallback={staffFallback}><MenuManagement /></Suspense>} />
                  <Route path="orders" element={<Suspense fallback={staffFallback}><OrderHistory /></Suspense>} />
                  <Route path="staff" element={<Suspense fallback={staffFallback}><StaffManagement /></Suspense>} />
                  <Route path="attendance" element={<Suspense fallback={staffFallback}><AttendancePage /></Suspense>} />
                  <Route path="branding" element={<Suspense fallback={staffFallback}><BrandingSettings /></Suspense>} />
                  <Route path="inventory" element={<Suspense fallback={staffFallback}><InventoryDashboardPage /></Suspense>} />
                  <Route path="inventory/categories" element={<Suspense fallback={staffFallback}><InventoryCategoriesPage /></Suspense>} />
                  <Route path="inventory/items" element={<Suspense fallback={staffFallback}><InventoryItemsPage /></Suspense>} />
                  <Route path="inventory/stock" element={<Suspense fallback={staffFallback}><StockOperationsPage /></Suspense>} />
                  <Route path="expenses" element={<Suspense fallback={staffFallback}><ExpenseManagementPage /></Suspense>}>
                    <Route index element={<Suspense fallback={staffFallback}><ExpenseEntriesPage /></Suspense>} />
                    <Route path="categories" element={<Suspense fallback={staffFallback}><ExpenseCategoriesPage /></Suspense>} />
                  </Route>
                  <Route path="reports" element={<Suspense fallback={staffFallback}><ReportsLayout /></Suspense>}>
                    <Route index element={<Suspense fallback={staffFallback}><SalesReportPage /></Suspense>} />
                    <Route path="sales" element={<Suspense fallback={staffFallback}><SalesReportPage /></Suspense>} />
                    <Route path="orders" element={<Suspense fallback={staffFallback}><OrdersReportPage /></Suspense>} />
                    <Route path="menu" element={<Suspense fallback={staffFallback}><MenuReportPage /></Suspense>} />
                    <Route path="revenue" element={<Suspense fallback={staffFallback}><RevenueReportPage /></Suspense>} />
                    <Route path="staff" element={<Suspense fallback={staffFallback}><StaffReportPage /></Suspense>} />
                    <Route path="expenses" element={<Suspense fallback={staffFallback}><ExpensesReportPage /></Suspense>} />
                    <Route path="inventory" element={<Suspense fallback={staffFallback}><AllItemsReportPage /></Suspense>} />
                    <Route path="inventory/all-items" element={<Suspense fallback={staffFallback}><AllItemsReportPage /></Suspense>} />
                    <Route path="inventory/low-stock" element={<Suspense fallback={staffFallback}><LowStockReportPage /></Suspense>} />
                    <Route path="inventory/out-of-stock" element={<Suspense fallback={staffFallback}><OutOfStockReportPage /></Suspense>} />
                    <Route path="inventory/summary" element={<Suspense fallback={staffFallback}><AllItemsReportPage /></Suspense>} />
                    <Route path="inventory/movements" element={<Suspense fallback={staffFallback}><StockMovementsReportPage /></Suspense>} />
                    <Route path="tables" element={<Suspense fallback={staffFallback}><TableReportsPage /></Suspense>} />
                  </Route>
                </Route>

                {/* 404 */}
                <Route path="*" element={<Suspense fallback={staffFallback}><NotFound /></Suspense>} />
              </Routes>
            </ErrorBoundary>
          </HashRouter>
        </TooltipProvider>
      </BrandingProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
