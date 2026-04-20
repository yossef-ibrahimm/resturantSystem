import { BookOpen } from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import RecipeForm from "@/components/recipes/RecipeForm";
import RecipeItem from "@/components/recipes/RecipeItem";
import { useRecipes } from "@/context/RecipesContext";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { useAuth } from "@/context/AuthContext";

const MyRecipes = () => {
  const isAuth = useAuthRedirect();
  const { user } = useAuth();
  const { recipes, deleteRecipe } = useRecipes();

  if (!isAuth) return null;

  return (
    <PageWrapper>
      <section className="container py-16 md:py-24">
        <header className="mb-12 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.3em] text-accent">Personal cookbook</p>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
            Your recipes, {user?.name}
          </h1>
          <p className="mt-4 text-muted-foreground">
            A private journal of things you cooked, want to cook, or never want to make again.
          </p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <RecipeForm />

          <div>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-2xl font-semibold">Saved</h2>
              <span className="text-sm text-muted-foreground">
                {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
              </span>
            </div>

            {recipes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
                <BookOpen className="mb-4 h-10 w-10 text-muted-foreground" />
                <h3 className="font-display text-lg">Your cookbook is empty</h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  Add your first recipe using the form on the left.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recipes.map((r) => (
                  <RecipeItem key={r.id} recipe={r} onDelete={deleteRecipe} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </PageWrapper>
  );
};

export default MyRecipes;
