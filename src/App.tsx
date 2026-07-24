import { lazy, Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n";

import Navbar from "@/components/layout/Navbar";
import MenuPage from "@/features/menu/components/MenuPage";
import CheckoutPage from "@/features/checkout/components/CheckoutPage";
import OrderStatusPage from "@/features/orders/components/OrderStatusPage";

const AdminLayout = lazy(() => import("@/features/admin/components/AdminLayout"));
const AdminDashboard = lazy(() => import("@/features/admin/components/AdminDashboard"));
const MenuManagement = lazy(() => import("@/features/admin/components/MenuManagement"));
const OrderHistory = lazy(() => import("@/features/admin/components/OrderHistory"));
const StaffManagement = lazy(() => import("@/features/admin/components/StaffManagement"));
const KitchenPage = lazy(() => import("@/features/kitchen/components/KitchenPage"));
const WaiterPage = lazy(() => import("@/features/waiter/components/WaiterPage"));
const LoginPage = lazy(() => import("@/features/auth/components/LoginPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-6 text-center">
        <p className="text-sm text-muted-foreground italic">
          © {new Date().getFullYear()} Tasty Table — Fresh, Delicious, Made with Love
        </p>
      </footer>
    </div>
  );
}

const App = () => (
  <LanguageProvider>
    <TooltipProvider>
        <Toaster />
        <HashRouter>
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading...</div>}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<PublicLayout><MenuPage /></PublicLayout>} />
              <Route path="/order-status" element={<PublicLayout><OrderStatusPage /></PublicLayout>} />
              <Route path="/checkout" element={<PublicLayout><CheckoutPage /></PublicLayout>} />

              {/* Auth */}
              <Route path="/admin/login" element={<LoginPage />} />

              {/* Admin routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="menu" element={<MenuManagement />} />
                <Route path="orders" element={<OrderHistory />} />
                <Route path="staff" element={<StaffManagement />} />
              </Route>

              {/* Kitchen route */}
              <Route path="/kitchen" element={<KitchenPage />} />

              {/* Waiter route */}
              <Route path="/waiter" element={<WaiterPage />} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </TooltipProvider>
    </LanguageProvider>
);

export default App;
