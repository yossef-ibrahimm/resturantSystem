import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  createdAt: number;
};

type MenuContextValue = {
  items: MenuItem[];
  addItem: (item: Omit<MenuItem, "id" | "createdAt">) => void;
  deleteItem: (id: string) => void;
};

const MenuContext = createContext<MenuContextValue | undefined>(undefined);
const STORAGE_KEY = "maison.menu";

const seed: MenuItem[] = [
  {
    id: "seed-1",
    name: "Heirloom tomato tartine",
    category: "Starter",
    price: 12,
    description: "Sourdough, whipped ricotta, basil oil, sea salt.",
    createdAt: Date.now() - 5000,
  },
  {
    id: "seed-2",
    name: "Saffron risotto",
    category: "Main",
    price: 26,
    description: "Carnaroli rice, vegetable broth, aged parmesan, brown butter.",
    createdAt: Date.now() - 4000,
  },
  {
    id: "seed-3",
    name: "Olive oil cake",
    category: "Dessert",
    price: 11,
    description: "Citrus zest, mascarpone cream, crushed pistachio.",
    createdAt: Date.now() - 3000,
  },
];

export const MenuProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setItems(raw ? JSON.parse(raw) : seed);
    } catch {
      setItems(seed);
    }
  }, []);

  useEffect(() => {
    if (items.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem: MenuContextValue["addItem"] = (item) => {
    setItems((prev) => [
      { ...item, id: crypto.randomUUID(), createdAt: Date.now() },
      ...prev,
    ]);
  };

  const deleteItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  return <MenuContext.Provider value={{ items, addItem, deleteItem }}>{children}</MenuContext.Provider>;
};

export const useMenu = () => {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("useMenu must be used within MenuProvider");
  return ctx;
};
