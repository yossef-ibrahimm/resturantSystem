import { NavLink, Outlet } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

export default function ExpenseManagementPage() {
  const { isArabic } = useLanguage();

  const tabs = [
    { to: "/admin/expenses", label: isArabic ? "المصروفات" : "Expenses" },
    { to: "/admin/expenses/categories", label: isArabic ? "فئات المصروفات" : "Expense Categories" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/admin/expenses"}
            className={({ isActive }) =>
              cn(
                "flex items-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}