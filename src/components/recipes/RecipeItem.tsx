import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MyRecipe } from "@/context/RecipesContext";

type Props = {
  recipe: MyRecipe;
  onDelete: (id: string) => void;
};

const RecipeItem = ({ recipe, onDelete }: Props) => {
  return (
    <article className="group flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-5 shadow-soft transition-smooth hover:shadow-card">
      <div className="flex-1">
        <h3 className="font-display text-lg font-semibold">{recipe.title}</h3>
        {recipe.notes && <p className="mt-1 text-sm text-muted-foreground">{recipe.notes}</p>}
        <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
          Added {new Date(recipe.createdAt).toLocaleDateString()}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${recipe.title}`}
        onClick={() => onDelete(recipe.id)}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </article>
  );
};

export default RecipeItem;
