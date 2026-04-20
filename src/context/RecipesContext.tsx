import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type MyRecipe = {
  id: string;
  title: string;
  notes: string;
  createdAt: number;
};

type RecipesContextValue = {
  recipes: MyRecipe[];
  addRecipe: (title: string, notes: string) => void;
  deleteRecipe: (id: string) => void;
};

const RecipesContext = createContext<RecipesContextValue | undefined>(undefined);
const STORAGE_KEY = "maison.my.recipes";

export const RecipesProvider = ({ children }: { children: ReactNode }) => {
  const [recipes, setRecipes] = useState<MyRecipe[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRecipes(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  }, [recipes]);

  const addRecipe = (title: string, notes: string) => {
    setRecipes((prev) => [
      { id: crypto.randomUUID(), title: title.trim(), notes: notes.trim(), createdAt: Date.now() },
      ...prev,
    ]);
  };

  const deleteRecipe = (id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <RecipesContext.Provider value={{ recipes, addRecipe, deleteRecipe }}>{children}</RecipesContext.Provider>
  );
};

export const useRecipes = () => {
  const ctx = useContext(RecipesContext);
  if (!ctx) throw new Error("useRecipes must be used within RecipesProvider");
  return ctx;
};
