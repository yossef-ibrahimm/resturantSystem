import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useAuthStore, selectIsAuthenticated } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, UtensilsCrossed, ClipboardList, Users,
  LogOut, Menu, X, ChefHat, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout() {
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/admin/login", { state: { from: location.pathname } });
    }
  }, [isAuthenticated, user, navigate, location]);

  if (!isAuthenticated || user?.role !== "admin") return null;

  const links = [
    { to: "/admin", label: t.admin.dashboard, icon: LayoutDashboard, end: true },
    { to: "/admin/menu", label: t.admin.menuManagement, icon: UtensilsCrossed },
    { to: "/admin/orders", label: t.admin.orderHistory, icon: ClipboardList },
    { to: "/admin/staff", label: t.admin.staffManagement, icon: Users },
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-xl p-2.5">
            <ChefHat className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base tracking-tight">{t.admin.title}</h2>
            <p className="text-[11px] text-muted-foreground -mt-0.5">{t.appName}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all group relative",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <link.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary-foreground")} />
                <span className="flex-1">{link.label}</span>
                {isActive && (
                  <ChevronRight className="h-3.5 w-3.5 opacity-60 rtl:rotate-180" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5 mb-2">
          <div className="bg-primary/10 rounded-lg p-2">
            <span className="text-xs font-bold text-primary">
              {user?.name?.charAt(0)?.toUpperCase() || "A"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 me-2" />
          {t.nav.logout}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-e border-border bg-card/50">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <div className="lg:hidden">
        <div
          className={cn(
            "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity",
            sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          className={cn(
            "fixed inset-y-0 start-0 z-50 w-64 flex flex-col border-e border-border bg-card transition-transform lg:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-14 items-center justify-between border-b border-border px-5">
            <span className="font-display font-bold">{t.admin.title}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {sidebarContent}
        </aside>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-muted/20">
        <div className="lg:hidden flex items-center gap-3 border-b border-border bg-card px-4 h-14">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-sm">{t.admin.title}</span>
          </div>
        </div>
        <div className="p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
