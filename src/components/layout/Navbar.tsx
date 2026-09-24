import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, UtensilsCrossed, ShoppingCart, Globe, Moon, Sun, Package, LayoutDashboard } from "lucide-react";
import { useAuthStore, selectIsAuthenticated } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { useActiveOrderStore } from "@/stores/activeOrderStore";
import { useLanguage } from "@/i18n";
import { useSettingsQuery } from "@/hooks/useSettings";
import { ORDER_STATUS_LABELS, ROLE_LANDING } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("tastytable.darkMode");
    if (stored !== null) return stored === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("tastytable.darkMode", String(dark));
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const { itemCount } = useCartStore();
  const { orderNumber: activeOrderNumber, orderToken: activeOrderToken, status: activeOrderStatus } = useActiveOrderStore();
  const { t, toggleLanguage, isArabic } = useLanguage();
  const navigate = useNavigate();
  const { data: settings } = useSettingsQuery();
  const { dark, toggle: toggleDark } = useDarkMode();

  // FE-001: JWT is HttpOnly cookie — no client token. Presence of user = authenticated session.
  const showDashboardButton = hasHydrated && isAuthenticated && !!user;
  const dashboardPath = user ? ROLE_LANDING[user.role] : undefined;

  const restaurantName = isArabic
    ? (settings?.nameAr || t.appName)
    : (settings?.nameEn || t.appName);

  const publicLinks = [
    { to: "/", label: t.nav.menu },
    { to: "/order-status", label: t.nav.orderStatus },
  ];

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight hover:opacity-90 transition-opacity">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt={restaurantName} className="h-7 w-auto" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
          )}
          <span>{restaurantName}</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {publicLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative text-sm font-medium transition-colors hover:text-foreground py-1",
                  isActive ? "text-foreground" : "text-muted-foreground",
                  isActive && "after:absolute after:-bottom-1.5 after:left-0 after:h-0.5 after:w-full after:bg-accent after:rounded-full"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLanguage}
            className="h-9 w-9"
            aria-label="Toggle language"
          >
            <Globe className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            className="h-9 w-9"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {activeOrderNumber && activeOrderStatus && (
            <Link
              to={`/order-status?token=${activeOrderToken}`}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary/60",
                activeOrderStatus === "completed"
                  ? "border-status-ready-border text-status-ready-fg"
                  : "border-accent/40 text-accent"
              )}
            >
              <Package className="h-3 w-3" />
              <span>#{activeOrderNumber}</span>
              <span className="text-muted-foreground">·</span>
              <span>{ORDER_STATUS_LABELS[activeOrderStatus][isArabic ? "ar" : "en"]}</span>
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            onClick={() => navigate("/checkout")}
            aria-label={`${isArabic ? "سلة المشتريات" : "Shopping cart"}: ${itemCount} ${isArabic ? "أصناف" : "items"}`}
          >
            <ShoppingCart className="h-4 w-4" />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground" aria-hidden="true">
                {itemCount}
              </span>
            )}
          </Button>

          {isAuthenticated ? (
            <>
              {showDashboardButton && dashboardPath && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(dashboardPath)}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden lg:inline">{t.nav.backToDashboard}</span>
                </Button>
              )}
              <span className="text-sm text-muted-foreground ms-1">{user?.name}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                {t.nav.logout}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => navigate("/admin/login")}>
              {t.nav.login}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <Button variant="ghost" size="icon" onClick={toggleLanguage} className="h-9 w-9" aria-label={isArabic ? "تغيير اللغة" : "Toggle language"}>
            <Globe className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleDark} className="h-9 w-9" aria-label={dark ? "الوضع الفاتح" : "الوضع الداكن"}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            onClick={() => navigate("/checkout")}
            aria-label={`${isArabic ? "سلة المشتريات" : "Shopping cart"}: ${itemCount} ${isArabic ? "أصناف" : "items"}`}
          >
            <ShoppingCart className="h-4 w-4" />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground" aria-hidden="true">
                {itemCount}
              </span>
            )}
          </Button>
          <button
            aria-label="Toggle menu"
            aria-expanded={open}
            className="relative grid h-10 w-10 place-items-center"
            onClick={() => setOpen((v) => !v)}
          >
            <Menu className={cn("h-5 w-5 transition-all", open && "rotate-90 scale-0 opacity-0")} />
            <X className={cn("absolute h-5 w-5 transition-all", !open && "-rotate-90 scale-0 opacity-0")} />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-border/60 bg-background md:hidden transition-[max-height] duration-300 ease-in-out",
          open ? "max-h-96" : "max-h-0"
        )}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      >
        <div className="container flex flex-col gap-1 py-4">
          {publicLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
          {activeOrderNumber && activeOrderStatus && (
            <Link
              to={`/order-status?token=${activeOrderToken}`}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                activeOrderStatus === "completed"
                  ? "bg-status-ready/20 text-status-ready-fg"
                  : "bg-accent/10 text-accent"
              )}
            >
              <Package className="h-3.5 w-3.5" />
              <span>#{activeOrderNumber}</span>
              <span className="text-muted-foreground">·</span>
              <span>{ORDER_STATUS_LABELS[activeOrderStatus][isArabic ? "ar" : "en"]}</span>
            </Link>
          )}
          <div className="mt-2 border-t border-border pt-3">
            {isAuthenticated ? (
              <div className="flex flex-col gap-2">
                {showDashboardButton && dashboardPath && (
                  <Button
                    variant="default"
                    className="w-full gap-2"
                    onClick={() => {
                      setOpen(false);
                      navigate(dashboardPath);
                    }}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {t.nav.backToDashboard}
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={handleLogout}>
                  {t.nav.logout} ({user?.name})
                </Button>
              </div>
            ) : (
              <Button
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  navigate("/admin/login");
                }}
              >
                {t.nav.login}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
