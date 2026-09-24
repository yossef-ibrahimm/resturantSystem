import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore, selectIsAuthenticated } from "@/stores/authStore";
import { ROLE_LANDING } from "@/lib/constants";

interface ProtectedRouteProps {
  allowedRoles?: string[];
  publicOnly?: boolean;
  children?: React.ReactNode;
}

export default function ProtectedRoute({ allowedRoles, publicOnly, children }: ProtectedRouteProps) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (publicOnly) {
    if (isAuthenticated && user) {
      if (user.mustChangePassword) {
        return <Navigate to="/change-password" replace />;
      }
      return <Navigate to={ROLE_LANDING[user.role] || "/admin"} replace />;
    }
    return children ?? <Outlet />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_LANDING[user.role] || "/admin"} replace />;
  }

  return children ?? <Outlet />;
}
