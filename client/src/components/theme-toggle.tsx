import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { THEME_STORAGE_KEY } from "../main";

export function ThemeToggle() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Cek jika tema gelap sudah diaktifkan
    if (typeof window !== "undefined") {
      // Cek dari localStorage dengan kunci yang benar
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      // Cek juga dari HTML class untuk memastikan UI sinkron dengan state actual
      const isDark = document.documentElement.classList.contains("dark");
      
      // Jika ada tema tersimpan, gunakan itu
      if (savedTheme) {
        return savedTheme === "dark";
      }
      
      // Jika tidak ada tema tersimpan tapi HTML sudah dark, gunakan itu
      return isDark;
    }
    return false;
  });

  // Fungsi untuk mengubah tema
  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Effect untuk menerapkan tema saat state berubah
  useEffect(() => {
    // Perbarui HTML classes
    if (isDarkMode) {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }

    // Perbarui localStorage
    localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? "dark" : "light");
    
    // Perbarui juga di app_settings untuk kompatibilitas
    try {
      const appSettings = localStorage.getItem('app_settings');
      if (appSettings) {
        const settings = JSON.parse(appSettings);
        localStorage.setItem('app_settings', JSON.stringify({
          ...settings,
          theme: isDarkMode ? "dark" : "light"
        }));
      }
    } catch (error) {
      console.error("Error updating app settings:", error);
    }
    
    console.log("Tema diubah menjadi:", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  return (
    <div className="flex items-center space-x-2">
      <Sun className="h-4 w-4 text-muted-foreground" />
      <Switch 
        id="theme-direct-toggle"
        checked={isDarkMode}
        onCheckedChange={toggleTheme}
      />
      <Moon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}