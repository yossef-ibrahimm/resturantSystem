import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import ChefsList from "@/components/chefs/ChefsList";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { chefs as allChefs, cuisines, type Chef } from "@/data/dummyChefs";
import heroImage from "@/assets/hero-table.jpg";

const Home = () => {
  const [chefs, setChefs] = useState<Chef[] | null>(null);
  const [query, setQuery] = useState("");
  const [activeCuisine, setActiveCuisine] = useState("All");

  // Simulate async load (useEffect requirement)
  useEffect(() => {
    const t = setTimeout(() => setChefs(allChefs), 400);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    if (!chefs) return [];
    return chefs.filter((c) => {
      const matchesQuery = c.name.toLowerCase().includes(query.toLowerCase());
      const matchesCuisine = activeCuisine === "All" || c.cuisine === activeCuisine;
      return matchesQuery && matchesCuisine;
    });
  }, [chefs, query, activeCuisine]);

  return (
    <PageWrapper>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Editorial overhead shot of a rustic chef's table with herbs, ceramics, and candlelight"
            className="h-full w-full object-cover"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/50 to-background" />
        </div>

        <div className="container relative z-10 flex min-h-[78vh] flex-col justify-end pb-16 pt-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="max-w-3xl"
          >
            <p className="mb-4 text-sm uppercase tracking-[0.3em] text-accent">Issue Nº 01 — Spring</p>
            <h1 className="text-balance font-display text-5xl font-semibold leading-[1.05] sm:text-6xl md:text-7xl">
              The chefs who shape <em className="font-display italic text-accent">how we eat</em>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              A curated cookbook of signature recipes from six masters. Read, save, and add your own
              kitchen experiments.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filters + grid */}
      <section className="container py-16 md:py-24">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">The Roster</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Meet the chefs</h2>
          </div>
          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              aria-label="Search chefs by name"
            />
          </div>
        </div>

        <div className="mb-10 flex flex-wrap gap-2">
          {cuisines.map((c) => (
            <Button
              key={c}
              variant={activeCuisine === c ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCuisine(c)}
              className="rounded-full"
            >
              {c}
            </Button>
          ))}
        </div>

        {chefs === null ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : (
          <ChefsList chefs={filtered} />
        )}
      </section>
    </PageWrapper>
  );
};

export default Home;
