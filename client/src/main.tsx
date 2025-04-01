import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./components/ui/theme-provider";

// Chave constante para armazenamento do tema
export const THEME_STORAGE_KEY = "terapinya-theme";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" storageKey={THEME_STORAGE_KEY}>
    <App />
  </ThemeProvider>
);
