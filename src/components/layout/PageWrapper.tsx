import { ReactNode } from "react";
import Navbar from "./Navbar";

const PageWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
        <p className="font-display italic">Maison — A cookbook in progress.</p>
      </footer>
    </div>
  );
};

export default PageWrapper;
