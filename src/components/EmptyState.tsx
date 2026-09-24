import type { LucideIcon } from "lucide-react";
import { isValidElement } from "react";
import { cn } from "@/lib/utils";

type IconType = LucideIcon | React.ReactElement;

interface EmptyStateProps {
  icon: IconType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function renderIcon(icon: IconType) {
  if (isValidElement(icon)) return icon;
  const Icon = icon as LucideIcon;
  return <Icon className="h-7 w-7 text-muted-foreground/50" />;
}

export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
        {renderIcon(icon)}
      </div>
      <p className="text-base font-medium text-foreground/80 mb-1">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
