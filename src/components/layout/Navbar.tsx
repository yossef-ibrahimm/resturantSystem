import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, ChefHat } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Chefs" },
  { to: "/my-recipes", label: "My Cookbook" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <ChefHat className="h-5 w-5 text-accent" />
          Maison
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative text-sm font-medium transition-colors hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground",
                  isActive &&
                    "after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:bg-accent"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              <span className="text-sm text-muted-foreground">Hi, {user?.name}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => navigate("/auth")}>
              Sign in
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
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

      {/* Mobile menu */}
      <div
        className={cn(
          "overflow-hidden border-t border-border/60 bg-background md:hidden",
          open ? "max-h-96" : "max-h-0"
        )}
        style={{ transition: "max-height 0.3s ease" }}
      >
        <div className="container flex flex-col gap-1 py-4">
          {links.map((l) => (
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
                Sign out ({user?.name})
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  navigate("/auth");
                }}
              >
                Sign in
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
