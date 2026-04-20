import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MenuItem } from "@/context/MenuContext";

type Props = { item: MenuItem; onDelete: (id: string) => void };

const MenuItemCard = ({ item, onDelete }: Props) => {
  return (
    <article className="group flex items-start justify-between gap-6 rounded-lg border border-border bg-card p-5 shadow-soft transition-all hover:shadow-card">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-xl font-semibold">{item.name}</h3>
          <span className="text-xs uppercase tracking-[0.2em] text-accent">{item.category}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="font-display text-lg font-semibold text-foreground">
          ${item.price.toFixed(2)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${item.name}`}
          onClick={() => onDelete(item.id)}
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </article>
  );
};

export default MenuItemCard;
