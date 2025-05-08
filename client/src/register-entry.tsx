import React from 'react';
import ReactDOM from 'react-dom/client';
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import Register from "@/pages/register";
import RegistrationSuccess from "@/pages/registration-success";
import '@/index.css';

/**
 * Aplikasi khusus untuk pendaftaran pasien - terpisah dari aplikasi utama
 * untuk mencegah konflik DOM saat navigasi
 */
function RegisterApp() {
  // Pastikan kita mendapatkan kode registrasi dari URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <div className="min-h-screen bg-background">
          <main className="flex-1">
            <Switch>
              <Route path="/register">
                <Register />
              </Route>
              <Route path="/daftar">
                <Register />
              </Route>
              <Route path="/registration-success">
                <RegistrationSuccess />
              </Route>
              <Route>
                <div className="container mx-auto p-8 text-center">
                  <h1 className="text-2xl font-bold mb-4">Halaman Tidak Ditemukan</h1>
                  <p>Silahkan kembali ke halaman utama</p>
                </div>
              </Route>
            </Switch>
          </main>
        </div>
      </ThemeProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

// Render aplikasi pendaftaran secara independen
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RegisterApp />
  </React.StrictMode>,
);