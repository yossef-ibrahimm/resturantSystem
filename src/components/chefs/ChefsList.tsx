import { UtensilsCrossed } from "lucide-react";
import ChefCard from "./ChefCard";
import type { Chef } from "@/data/dummyChefs";

const ChefsList = ({ chefs }: { chefs: Chef[] }) => {
  if (chefs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-20 text-center">
        <UtensilsCrossed className="mb-4 h-10 w-10 text-muted-foreground" />
        <h3 className="font-display text-xl">No chefs match your search</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Try a different cuisine or clear the filters to see the full roster.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {chefs.map((chef, i) => (
        <ChefCard key={chef.id} chef={chef} index={i} />
      ))}
    </div>
  );
};

export default ChefsList;
