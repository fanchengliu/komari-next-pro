"use client";

import { Github } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t bg-gradient-to-b from-card/30 to-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Komari-Next and LIU</span>
          <a
            href="https://github.com/fanchengliu/komari-next-pro"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Komari Next Pro GitHub Repository"
            className="inline-flex items-center rounded-sm transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <Github className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
