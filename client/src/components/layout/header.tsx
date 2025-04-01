import { useTheme } from "@/components/ui/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useLocation } from "wouter";

type HeaderProps = {
  onMenuToggle: () => void;
};

export default function Header({ onMenuToggle }: HeaderProps) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Get page title from location
  const getPageTitle = () => {
    const path = location === "/" ? "/dashboard" : location;
    const titles: Record<string, string> = {
      "/dashboard": "Dashboard",
      "/patients": "Pasien",
      "/transactions": "Transaksi",
      "/schedule": "Jadwal",
      "/products": "Produk",
      "/reports": "Laporan",
      "/settings": "Pengaturan",
    };
    return titles[path] || "Dashboard";
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Mobile menu button */}
        <button 
          onClick={onMenuToggle} 
          className="md:hidden text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Page title */}
        <h2 className="text-lg md:text-xl font-bold font-heading text-gray-800 dark:text-white">{getPageTitle()}</h2>

        {/* User menu & Dark mode toggle */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")} 
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            {theme === "dark" ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setUserMenuOpen(!userMenuOpen)} 
              className="flex items-center focus:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                <span className="font-medium">{user?.name?.[0] || 'A'}</span>
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-200 hidden md:block">
                {user?.name || 'Admin'}
              </span>
            </button>
            
            {userMenuOpen && (
              <div 
                className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700"
                onClick={() => setUserMenuOpen(false)}
              >
                <a href="#profile" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Profil</a>
                <a href="#settings" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Pengaturan</a>
                <button 
                  onClick={logout}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
