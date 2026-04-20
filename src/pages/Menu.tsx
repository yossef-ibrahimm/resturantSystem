import { UtensilsCrossed } from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import Reveal from "@/components/layout/Reveal";
import MenuForm from "@/components/menu/MenuForm";
import MenuItemCard from "@/components/menu/MenuItemCard";
import { useMenu } from "@/context/MenuContext";

const Menu = () => {
  const { items, deleteItem } = useMenu();

  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  return (
    <PageWrapper>
      <section className="container py-16 md:py-24">
        <Reveal>
          <header className="mb-12 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-accent">The house menu</p>
            <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Our menu</h1>
            <p className="mt-4 text-muted-foreground">
              A living menu — every dish curated, priced, and seasoned by you.
            </p>
          </header>
        </Reveal>

        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <Reveal delay={80}>
            <MenuForm />
          </Reveal>

          <div>
            {items.length === 0 ? (
              <Reveal>
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
                  <UtensilsCrossed className="mb-4 h-10 w-10 text-muted-foreground" />
                  <h3 className="font-display text-lg">No dishes yet</h3>
                  <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                    Add your first dish using the form on the left.
                  </p>
                </div>
              </Reveal>
            ) : (
              <div className="space-y-10">
                {Object.entries(grouped).map(([category, list]) => (
                  <Reveal key={category}>
                    <div>
                      <h2 className="mb-4 font-display text-2xl font-semibold">{category}</h2>
                      <div className="space-y-3">
                        {list.map((item, i) => (
                          <Reveal key={item.id} delay={i * 60}>
                            <MenuItemCard item={item} onDelete={deleteItem} />
                          </Reveal>
                        ))}
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </PageWrapper>
  );
};

export default Menu;
