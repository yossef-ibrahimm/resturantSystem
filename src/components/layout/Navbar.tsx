import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, UtensilsCrossed, ShoppingCart, Globe } from "lucide-react";
import { useAuthStore, selectIsAuthenticated } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const { itemCount } = useCartStore();
  const { t, toggleLanguage, isArabic } = useLanguage();
  const navigate = useNavigate();

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
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <UtensilsCrossed className="h-5 w-5 text-accent" />
          {t.appName}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {publicLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative text-sm font-medium transition-colors hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground",
                  isActive && "after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:bg-accent"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
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
            className="relative h-9 w-9"
            onClick={() => navigate("/checkout")}
          >
            <ShoppingCart className="h-4 w-4" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Button>

          {isAuthenticated ? (
            <>
              <span className="text-sm text-muted-foreground">{user?.name}</span>
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
          <Button variant="ghost" size="icon" onClick={toggleLanguage} className="h-9 w-9">
            <Globe className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            onClick={() => navigate("/checkout")}
          >
            <ShoppingCart className="h-4 w-4" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
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
          "overflow-hidden border-t border-border/60 bg-background md:hidden",
          open ? "max-h-96" : "max-h-0"
        )}
        style={{ transition: "max-height 0.3s ease" }}
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
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
          <div className="mt-2 border-t border-border pt-3">
            {isAuthenticated ? (
              <Button variant="outline" className="w-full" onClick={handleLogout}>
                {t.nav.logout} ({user?.name})
              </Button>
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
