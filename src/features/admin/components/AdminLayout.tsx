import { useState, useEffect, useRef, useCallback } from "react";
import type { ComponentType } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useAuthStore } from "@/stores/authStore";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";
import type { TranslationKeys } from "@/i18n/ar";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  Users,
  LogOut,
  Menu,
  X,
  ChefHat,
  ChevronRight,
  CalendarClock,
  Palette,
  PanelLeft,
  BarChart3,
  Package,
  Receipt,
  Grid3X3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationBell from "./NotificationBell";

const COLLAPSE_STORAGE_KEY = "admin:sidebar-collapsed";
// Persistent sidebar now kicks in at md (tablet) instead of lg, so there is
// no more "orphan zone" between ~640px and ~1024px where users were stuck
// with only the hamburger drawer.
const DESKTOP_BREAKPOINT = 1024;

interface NavLinkItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

interface SidebarContentProps {
  links: NavLinkItem[];
  user: User | null;
  t: TranslationKeys;
  isArabic: boolean;
  collapsedRail: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
  showCollapseToggle?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  hideBrand?: boolean;
}

function SidebarContent({
  links,
  user,
  t,
  isArabic,
  collapsedRail,
  onNavigate,
  onLogout,
  showCollapseToggle,
  collapsed,
  onToggleCollapse,
  hideBrand,
}: SidebarContentProps) {
  return (
    <>
      {/* Brand — hidden when parent renders its own header */}
      {!hideBrand && (
        <div
          className={cn(
            "flex items-center gap-3 border-b border-border/60 px-5 py-5",
            collapsedRail && "justify-center px-3"
          )}
        >
          <div className="shrink-0 rounded-xl bg-primary p-2.5 shadow-md shadow-primary/15">
            <ChefHat className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsedRail && (
            <div className="min-w-0">
              <h2 className="truncate font-display text-sm font-bold tracking-tight">
                {t.admin.title}
              </h2>
              <p className="-mt-0.5 truncate text-[11px] text-muted-foreground">{t.appName}</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav
        aria-label={isArabic ? "التنقل الرئيسي" : "Primary navigation"}
        className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-3"
      >
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={onNavigate}
            title={collapsedRail ? link.label : undefined}
            className={({ isActive }) =>
              cn(
                "group relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                collapsedRail && "justify-center px-0",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted"
              )
            }
          >
            {({ isActive }) => (
              <>
                <link.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary-foreground")} />
                {!collapsedRail && (
                  <>
                    <span className="flex-1 truncate">{link.label}</span>
                    {isActive && (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60 rtl:rotate-180" />
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle — persistent-sidebar viewports only */}
      {showCollapseToggle && (
        <div className="hidden border-t border-border/60 p-3 md:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              "w-full min-h-[40px] touch-manipulation text-muted-foreground hover:text-foreground",
              collapsedRail ? "justify-center px-0" : "justify-start"
            )}
            aria-label={
              isArabic
                ? collapsed
                  ? "توسيع القائمة الجانبية"
                  : "طي القائمة الجانبية"
                : collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
          >
            <PanelLeft
              className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
                collapsed && "rotate-180"
              )}
            />
            {!collapsedRail && <span className="ms-2">{isArabic ? "طي القائمة" : "Collapse"}</span>}
          </Button>
        </div>
      )}

      {/* User section */}
      <div className={cn("border-t border-border/60 p-3", collapsedRail && "px-2")}>
        <div
          className={cn(
            "mb-2 flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5",
            collapsedRail && "justify-center px-0"
          )}
        >
          <div className="shrink-0 rounded-lg bg-primary/10 p-2">
            <span className="text-xs font-bold text-primary">
              {user?.name?.charAt(0)?.toUpperCase() || "A"}
            </span>
          </div>
          {!collapsedRail && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          title={collapsedRail ? (isArabic ? "تسجيل الخروج" : "Log out") : undefined}
          className={cn(
            "w-full min-h-[44px] touch-manipulation text-muted-foreground hover:text-destructive",
            collapsedRail ? "justify-center px-0" : "justify-start"
          )}
          onClick={onLogout}
        >
          <LogOut className="me-2 h-4 w-4 shrink-0" />
          {!collapsedRail && t.nav.logout}
        </Button>
      </div>
    </>
  );
}

export default function AdminLayout() {
  const { t, isArabic } = useLanguage();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  useAdminSocket();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored !== null) return stored === "1";
    // No saved preference yet: default to the compact rail on
    // tablet-sized viewports so content has more room to breathe.
    return window.innerWidth < DESKTOP_BREAKPOINT;
  });

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close the mobile drawer automatically if the viewport grows into the
  // persistent-sidebar range (e.g. rotating a tablet, or resizing a window).
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setSidebarOpen(false);
    };
    handleChange(mql);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  // Lock body scroll, trap focus, and close on Escape while the mobile drawer is open
  useEffect(() => {
    if (!sidebarOpen) return;
    const menuButton = menuButtonRef.current;
    const drawer = drawerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const getFocusable = () =>
      drawer
        ? Array.from(
            drawer.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          )
        : [];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const elements = getFocusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    getFocusable()[0]?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      menuButton?.focus();
    };
  }, [sidebarOpen]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const links: NavLinkItem[] = [
    { to: "/admin", label: t.admin.dashboard, icon: LayoutDashboard, end: true },
    { to: "/admin/menu", label: t.admin.menuManagement, icon: UtensilsCrossed },
    { to: "/admin/orders", label: t.admin.orderHistory, icon: ClipboardList },
    { to: "/admin/inventory", label: isArabic ? "المخزون" : "Inventory", icon: Package },
    { to: "/admin/expenses", label: isArabic ? "المصروفات" : "Expenses", icon: Receipt },
    { to: "/admin/staff", label: t.admin.staffManagement, icon: Users },
    { to: "/admin/attendance", label: t.admin.attendance, icon: CalendarClock },
    { to: "/admin/branding", label: t.admin.branding, icon: Palette },
    { to: "/admin/reports/tables", label: isArabic ? "تقارير الطاولات" : "Table Reports", icon: Grid3X3 },
    { to: "/admin/reports/sales", label: t.reports.title, icon: BarChart3 },
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Persistent sidebar — visible from md (tablet) up, collapsible to an icon rail */}
      <aside
        className={cn(
          "relative hidden h-full shrink-0 flex-col border-e border-border/60 bg-card/50 transition-[width] duration-300 ease-in-out motion-reduce:transition-none md:flex",
          collapsed ? "md:w-[76px]" : "md:w-64"
        )}
      >
        {/* Desktop brand header with notification bell */}
        <div
          className={cn(
            "flex items-center gap-3 border-b border-border/60 px-5 py-5",
            collapsed && "justify-center px-3"
          )}
        >
          <div className="shrink-0 rounded-xl bg-primary p-2.5 shadow-md shadow-primary/15">
            <ChefHat className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-sm font-bold tracking-tight">
                {t.admin.title}
              </h2>
              <p className="-mt-0.5 truncate text-[11px] text-muted-foreground">{t.appName}</p>
            </div>
          )}
          {!collapsed && <NotificationBell />}
        </div>

        <SidebarContent
          links={links}
          user={user}
          t={t}
          isArabic={isArabic}
          collapsedRail={collapsed}
          onLogout={handleLogout}
          showCollapseToggle
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          hideBrand
        />
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={
            isArabic
              ? collapsed
                ? "توسيع القائمة الجانبية"
                : "طي القائمة الجانبية"
              : collapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
          className="absolute -end-3 top-20 z-10 hidden h-7 w-7 touch-manipulation items-center justify-center rounded-full border border-border bg-card shadow-sm transition-colors hover:bg-muted md:flex"
        >
          <PanelLeft
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </aside>

      {/* Mobile drawer — phones only (below md) */}
      <div className="md:hidden">
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity motion-reduce:transition-none",
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          id="admin-mobile-drawer"
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label={isArabic ? "قائمة التنقل" : "Navigation menu"}
          className={cn(
            "fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col overscroll-contain border-e border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-elevated transition-transform duration-300 ease-in-out motion-reduce:transition-none md:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
          )}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 px-5 pt-[env(safe-area-inset-top)]">
            <span className="truncate font-display font-bold">{t.admin.title}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 touch-manipulation"
              onClick={() => setSidebarOpen(false)}
              aria-label={isArabic ? "إغلاق" : "Close"}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <SidebarContent
            links={links}
            user={user}
            t={t}
            isArabic={isArabic}
            collapsedRail={false}
            onNavigate={() => setSidebarOpen(false)}
            onLogout={handleLogout}
          />
        </aside>
      </div>

      {/* Main content — scrolls independently of the sidebar */}
      <main className="h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-muted/20">
        <div className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border/60 bg-card/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:px-4 md:hidden">
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 touch-manipulation"
            onClick={() => setSidebarOpen(true)}
            aria-label={isArabic ? "فتح القائمة" : "Open menu"}
            aria-expanded={sidebarOpen}
            aria-controls="admin-mobile-drawer"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <ChefHat className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-display text-sm font-semibold">{t.admin.title}</span>
          </div>
          <div className="ms-auto shrink-0">
            <NotificationBell />
          </div>
        </div>
        <div className="mx-auto max-w-[1400px] p-3 sm:p-5 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}