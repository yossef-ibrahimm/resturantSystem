import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useRecipes } from "@/context/RecipesContext";
import { validateRecipeTitle } from "@/utils/validators";
import { toast } from "@/hooks/use-toast";

const RecipeForm = () => {
  const { addRecipe } = useRecipes();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const titleError = validateRecipeTitle(title);
    if (titleError) {
      setError(titleError);
      return;
    }
    addRecipe(title, notes);
    setTitle("");
    setNotes("");
    setError(null);
    toast({ title: "Recipe saved", description: `${title} added to your cookbook.` });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-6 shadow-soft"
      aria-label="Add new recipe"
    >
      <h2 className="font-display text-xl font-semibold">Add a new recipe</h2>
      <p className="mt-1 text-sm text-muted-foreground">A few words now, the technique can come later.</p>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recipe-title">Title</Label>
          <Input
            id="recipe-title"
            placeholder="e.g. Sunday roast chicken"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? "title-error" : undefined}
          />
          {error && (
            <p id="title-error" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipe-notes">Notes</Label>
          <Textarea
            id="recipe-notes"
            placeholder="Ingredients, method, memories…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          <Plus className="mr-1 h-4 w-4" /> Save recipe
        </Button>
      </div>
    </form>
  );
};

export default RecipeForm;
