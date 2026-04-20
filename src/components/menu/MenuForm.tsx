import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMenu } from "@/context/MenuContext";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = ["Starter", "Main", "Dessert", "Drink"];

const MenuForm = () => {
  const { addItem } = useMenu();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Main");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "Name must be at least 2 characters.";
    const priceNum = Number(price);
    if (!price || isNaN(priceNum) || priceNum <= 0) next.price = "Enter a valid price.";
    setErrors(next);
    if (Object.keys(next).length) return;

    addItem({ name: name.trim(), category, price: priceNum, description: description.trim() });
    toast({ title: "Added to the menu", description: `${name} is now on the menu.` });
    setName("");
    setPrice("");
    setDescription("");
    setCategory("Main");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-6 shadow-soft"
      aria-label="Add a new food item"
    >
      <h2 className="font-display text-xl font-semibold">Add to the menu</h2>
      <p className="mt-1 text-sm text-muted-foreground">Build your house menu, one dish at a time.</p>

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="food-name">Dish name</Label>
          <Input
            id="food-name"
            placeholder="e.g. Wild mushroom pappardelle"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="food-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="food-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="food-price">Price ($)</Label>
            <Input
              id="food-price"
              type="number"
              min="0"
              step="0.5"
              placeholder="14"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-invalid={!!errors.price}
            />
            {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="food-description">Description</Label>
          <Textarea
            id="food-description"
            placeholder="Ingredients, technique, story…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <Button type="submit" className="w-full sm:w-auto">
          <Plus className="mr-1 h-4 w-4" /> Add dish
        </Button>
      </div>
    </form>
  );
};

export default MenuForm;
