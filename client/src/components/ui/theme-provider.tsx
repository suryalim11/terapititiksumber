import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ui-theme",
  ...props
}: ThemeProviderProps) {
  // Inisialisasi tema dari localStorage atau gunakan default
  const [theme, setTheme] = useState<Theme>(
    () => {
      // Periksa apakah ada tema tersimpan di localStorage
      const savedTheme = localStorage.getItem(storageKey);
      
      // Jika ada dan valid, gunakan
      if (savedTheme && ["dark", "light", "system"].includes(savedTheme)) {
        return savedTheme as Theme;
      }
      
      // Jika tidak, gunakan tema default
      return defaultTheme;
    }
  );

  // Fungsi untuk menerapkan tema langsung ke dokumen
  const applyTheme = (newTheme: Theme) => {
    const root = window.document.documentElement;
    
    // Hapus kelas tema sebelumnya
    root.classList.remove("light", "dark");

    // Jika tema adalah "system", tentukan berdasarkan preferensi sistem
    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      console.log("Tema sistem diterapkan:", systemTheme);
      return;
    }

    // Tambahkan kelas yang sesuai dengan tema
    root.classList.add(newTheme);
    console.log("Tema diterapkan langsung:", newTheme);
  };

  // Terapkan tema awal
  useEffect(() => {
    applyTheme(theme);
  }, []);

  // Sediakan nilai dan fungsi untuk konteks
  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      // Simpan di localStorage
      localStorage.setItem(storageKey, newTheme);
      
      // Terapkan tema langsung ke DOM - ini menyebabkan perubahan instan
      applyTheme(newTheme);
      
      // Perbarui state komponen
      setTheme(newTheme);
      
      // Log untuk debugging
      console.log("Tema diubah menjadi:", newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};