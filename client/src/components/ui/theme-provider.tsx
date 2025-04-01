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
  // Inicializa o tema a partir do localStorage ou usa o padrão
  const [theme, setTheme] = useState<Theme>(
    () => {
      // Verifica se existe um tema salvo no localStorage
      const savedTheme = localStorage.getItem(storageKey);
      
      // Se existe e é válido, use-o
      if (savedTheme && ["dark", "light", "system"].includes(savedTheme)) {
        return savedTheme as Theme;
      }
      
      // Caso contrário, use o tema padrão
      return defaultTheme;
    }
  );

  // Função para aplicar o tema diretamente ao documento
  const applyTheme = (newTheme: Theme) => {
    const root = window.document.documentElement;
    
    // Remove classes anteriores de tema
    root.classList.remove("light", "dark");

    // Se o tema for "system", determine baseado nas preferências do sistema
    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      console.log("Tema do sistema aplicado:", systemTheme);
      return;
    }

    // Adiciona a classe correspondente ao tema
    root.classList.add(newTheme);
    console.log("Tema aplicado diretamente:", newTheme);
  };

  // Aplica o tema inicial
  useEffect(() => {
    applyTheme(theme);
  }, []);

  // Fornece os valores e funções para o contexto
  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      // Salva no localStorage
      localStorage.setItem(storageKey, newTheme);
      
      // Aplica o tema diretamente ao DOM - isso causa a mudança instantânea
      applyTheme(newTheme);
      
      // Atualiza o estado do componente
      setTheme(newTheme);
      
      // Log para depuração
      console.log("Tema alterado para:", newTheme);
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