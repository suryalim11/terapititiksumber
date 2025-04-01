import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Home,
  Menu,
  PackageIcon,
  Settings,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Navigation items configuration
const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Patients", href: "/patients", icon: UserRound },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Products", href: "/products", icon: PackageIcon },
  { name: "Transactions", href: "/transactions", icon: ShoppingCart },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar for desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-card transition-transform duration-200 ease-in-out",
          isMobile ? "-translate-x-full" : "translate-x-0",
          sidebarOpen && "translate-x-0"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">TerapiKlinik</h1>
          </div>
          {isMobile && (
            <button
              onClick={toggleSidebar}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => isMobile && setSidebarOpen(false)}
              >
                <a
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </a>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={toggleSidebar}
        />
      )}

      {/* Main content */}
      <div
        className={cn(
          "flex flex-1 flex-col",
          !isMobile && "ml-64"
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4">
          {isMobile && (
            <button
              onClick={toggleSidebar}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="ml-auto flex items-center gap-4">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {user.name}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {user.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                    .substring(0, 2)}
                </div>
              </div>
            ) : (
              <Link href="/login">
                <a className="text-sm text-primary hover:underline">Login</a>
              </Link>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}