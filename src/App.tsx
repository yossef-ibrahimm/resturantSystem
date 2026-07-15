import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n";

import Navbar from "@/components/layout/Navbar";
import MenuPage from "@/features/menu/components/MenuPage";
import CheckoutPage from "@/features/checkout/components/CheckoutPage";
import OrderStatusPage from "@/features/orders/components/OrderStatusPage";
import AdminLayout from "@/features/admin/components/AdminLayout";
import AdminDashboard from "@/features/admin/components/AdminDashboard";
import MenuManagement from "@/features/admin/components/MenuManagement";
import OrderHistory from "@/features/admin/components/OrderHistory";
import StaffManagement from "@/features/admin/components/StaffManagement";
import KitchenPage from "@/features/kitchen/components/KitchenPage";
import LoginPage from "@/features/auth/components/LoginPage";
import NotFound from "./pages/NotFound";

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
        <Sonner />
        <BrowserRouter>
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

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
);

export default App;
