import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Flame } from "lucide-react";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { chefs } from "@/data/dummyChefs";
import { Button } from "@/components/ui/button";

const ChefRecipes = () => {
  const { chefId } = useParams<{ chefId: string }>();
  const chef = chefs.find((c) => c.id === chefId);

  if (!chef) {
    return (
      <PageWrapper>
        <div className="container py-32 text-center">
          <h1 className="font-display text-3xl">Chef not found</h1>
          <Button asChild className="mt-6">
            <Link to="/">Back to chefs</Link>
          </Button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <article>
        {/* Header */}
        <header className="border-b border-border bg-secondary/40">
          <div className="container grid gap-10 py-16 md:grid-cols-[1.2fr_1fr] md:gap-16 md:py-24">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> All chefs
              </Link>
              <p className="mt-6 text-xs uppercase tracking-[0.3em] text-accent">
                {chef.cuisine} · {chef.city}
              </p>
              <h1 className="mt-3 font-display text-5xl font-semibold leading-tight md:text-6xl">{chef.name}</h1>
              <p className="mt-6 max-w-lg text-lg text-muted-foreground">{chef.bio}</p>
              <p className="mt-6 font-display italic text-foreground">
                Signature: <span className="text-accent">{chef.signature}</span>
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7 }}
              className="relative overflow-hidden rounded-lg shadow-elegant"
            >
              <img
                src={chef.image}
                alt={`Portrait of ${chef.name}`}
                width={800}
                height={1000}
                className="aspect-[4/5] w-full object-cover"
              />
            </motion.div>
          </div>
        </header>

        {/* Recipes */}
        <section className="container py-16 md:py-24">
          <div className="mb-10 flex items-baseline justify-between">
            <h2 className="font-display text-3xl font-semibold">Signature recipes</h2>
            <span className="text-sm text-muted-foreground">{chef.recipes.length} dishes</span>
          </div>

          <ul className="divide-y divide-border border-y border-border">
            {chef.recipes.map((r, i) => (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="grid gap-4 py-6 md:grid-cols-[1fr_2fr_auto] md:items-center md:gap-10"
              >
                <h3 className="font-display text-2xl font-semibold">{r.title}</h3>
                <p className="text-muted-foreground">{r.description}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" /> {r.duration}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Flame className="h-4 w-4" /> {r.difficulty}
                  </span>
                </div>
              </motion.li>
            ))}
          </ul>
        </section>
      </article>
    </PageWrapper>
  );
};

export default ChefRecipes;
