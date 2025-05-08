import React from "react";
import { ThemeProvider } from "@/components/ui/theme-provider";

/**
 * Layout sederhana untuk halaman publik tanpa navigasi/sidebar
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <div className="min-h-screen bg-background">
        <main className="flex-1">
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}