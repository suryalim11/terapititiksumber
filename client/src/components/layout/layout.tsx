import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect } from "react";
import {
  BarChart3,
  ClipboardList,
  Home,
  Link as LinkIcon,
  Menu,
  PackageIcon,
  Settings,
  ShoppingCart,
  UserRound,
  X,
  LogOut,
  Database,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Navigation items configuration
const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Patients", href: "/patients", icon: UserRound },
  { name: "Therapy Slots", href: "/therapy-slots", icon: ClipboardList },
  { name: "Products", href: "/products", icon: PackageIcon },
  { name: "Transactions", href: "/transactions", icon: ShoppingCart },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Backup & Restore", href: "/backup-restore", icon: Database },
  { name: "Settings", href: "/settings", icon: Settings },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const isMobile = useIsMobile();
  const [location, navigate] = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const { toast } = useToast();

  // Detect scroll position for header styling and scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setScrolled(scrollTop > 10);
      setShowScrollTop(scrollTop > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  
  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logout berhasil",
        description: "Anda telah keluar dari sistem",
      });
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        variant: "destructive",
        title: "Logout gagal",
        description: "Terjadi kesalahan saat logout",
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar for desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] md:w-64 transform border-r bg-card transition-transform duration-200 ease-in-out overflow-y-auto",
          isMobile ? "-translate-x-full" : "translate-x-0",
          sidebarOpen && "translate-x-0"
        )}
      >
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b px-4 bg-card">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Terapi Titik Sumber</h1>
          </div>
          {isMobile && (
            <button
              onClick={toggleSidebar}
              className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground touch-target"
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
              >
                <div
                  onClick={() => isMobile && setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
          
          {/* Logout button in sidebar for mobile */}
          {isAuthenticated && isMobile && (
            <div
              onClick={() => {
                setSidebarOpen(false);
                handleLogout();
              }}
              className="mt-4 flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-red-500 hover:bg-red-100 hover:text-red-600 cursor-pointer"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span>Logout</span>
            </div>
          )}
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
          "flex flex-1 flex-col min-h-screen",
          !isMobile && "ml-64"
        )}
      >
        {/* Header */}
        <header 
          className={cn(
            "sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur-sm px-4 transition-shadow duration-200",
            scrolled && "shadow-sm"
          )}
        >
          {isMobile && (
            <button
              onClick={toggleSidebar}
              className="rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground touch-target"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          
          {isMobile && (
            <div className="flex items-center mx-auto">
              <ClipboardList className="h-5 w-5 text-primary mr-2" />
              <h1 className="text-base font-bold">Terapi Titik Sumber</h1>
            </div>
          )}
          
          <div className="ml-auto flex items-center gap-2 md:gap-4">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 md:gap-3">
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {user.name}
                  </span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {user.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                    .substring(0, 2)}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  className="flex items-center gap-1 h-9 px-2 md:px-3"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <div className="text-sm text-primary hover:underline cursor-pointer">Login</div>
              </Link>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-3 md:p-6">{children}</main>
        
        {/* Scroll to top button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-40 p-2 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all transform hover:scale-105 touch-target"
            aria-label="Scroll to top"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}