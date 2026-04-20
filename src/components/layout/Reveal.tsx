import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/useInView";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "article" | "li";
};

const Reveal = ({ children, delay = 0, className, as: Tag = "div" }: RevealProps) => {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <Tag
      // @ts-expect-error - dynamic tag ref typing
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-700 ease-smooth will-change-transform",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        className
      )}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
