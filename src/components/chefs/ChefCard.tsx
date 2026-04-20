import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Chef } from "@/data/dummyChefs";

const ChefCard = ({ chef, index = 0 }: { chef: Chef; index?: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.4, 0, 0.2, 1] }}
    >
      <Link
        to={`/chefs/${chef.id}`}
        className="group block overflow-hidden rounded-lg bg-card shadow-soft transition-smooth hover:shadow-card"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          <img
            src={chef.image}
            alt={`Portrait of chef ${chef.name}`}
            loading="lazy"
            width={800}
            height={1000}
            className="h-full w-full object-cover transition-transform duration-700 ease-smooth group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-hero opacity-60" />
          <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground backdrop-blur">
            {chef.cuisine}
          </span>
          <div className="absolute bottom-4 left-4 right-4 text-primary-foreground">
            <p className="text-xs uppercase tracking-[0.2em] opacity-80">{chef.city}</p>
            <h3 className="mt-1 font-display text-2xl font-semibold leading-tight">{chef.name}</h3>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Signature</p>
            <p className="mt-0.5 text-sm font-medium italic">{chef.signature}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{chef.recipes.length} recipes</span>
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default ChefCard;
