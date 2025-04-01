import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./components/ui/theme-provider";

// Chave constante para armazenamento do tema
export const THEME_STORAGE_KEY = "terapinya-ui-theme";

// Inicializa ou recupera o tema antes de renderizar a aplicação
const getInitialTheme = () => {
  try {
    // Verificar se há um tema salvo no localStorage para compatibilidade com as configurações do app
    const appSettings = localStorage.getItem('app_settings');
    if (appSettings) {
      const settings = JSON.parse(appSettings);
      if (settings.theme && ['light', 'dark', 'system'].includes(settings.theme)) {
        // Se existir, salvar na nova chave para garantir consistência
        localStorage.setItem(THEME_STORAGE_KEY, settings.theme);
        return settings.theme;
      }
    }
    
    // Se não encontrou nas configurações do app, verifica se já existe na chave do tema
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      return savedTheme;
    }
    
    // Caso não encontre, retorna o tema padrão
    return 'light';
  } catch (error) {
    console.error('Erro ao inicializar tema:', error);
    return 'light';
  }
};

// Obtém o tema inicial
const initialTheme = getInitialTheme();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme={initialTheme as 'light' | 'dark' | 'system'} storageKey={THEME_STORAGE_KEY}>
    <App />
  </ThemeProvider>
);
