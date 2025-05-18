/**
 * Modul untuk menangani request API dengan pengiriman respons langsung (tanpa Vite/Express middleware)
 * Khusus digunakan untuk mengatasi masalah parsing JSON
 */
import { Express, Request, Response } from "express";
import { storage } from "./storage";

/**
 * Setup API endpoint khusus untuk produk dan paket yang melewati middleware
 */
export function setupDirectApi(app: Express) {
  // Endpoint produk dengan format JSON sederhana
  app.get("/api/direct/products", async (req: Request, res: Response) => {
    try {
      console.log("[DIRECT API] Mengambil data produk");
      const products = await storage.getAllProducts();
      
      // Format data untuk menghindari masalah serialisasi
      const safeProducts = products.map(product => ({
        id: product.id,
        name: product.name,
        price: typeof product.price === 'string' ? product.price : String(product.price),
        stock: product.stock,
        description: product.description || ''
      }));
      
      // Hapus semua header yang mungkin mempengaruhi intepretasi respon
      res.removeHeader('X-Powered-By');
      
      // Set header yang jelas untuk JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store, no-cache');
      
      // Kirim respons JSON sebagai string
      const jsonString = JSON.stringify(safeProducts);
      console.log(`[DIRECT API] Mengirim ${safeProducts.length} produk`);
      
      // Jika empty, kirim array kosong
      if (safeProducts.length === 0) {
        res.send("[]");
      } else {
        res.send(jsonString);
      }
    } catch (error) {
      console.error("[DIRECT API] Error mendapatkan produk:", error);
      res.status(500).json({ error: "Gagal mengambil data produk" });
    }
  });

  // Endpoint paket dengan format JSON sederhana
  app.get("/api/direct/packages", async (req: Request, res: Response) => {
    try {
      console.log("[DIRECT API] Mengambil data paket");
      const packages = await storage.getAllPackages();
      
      // Format data untuk menghindari masalah serialisasi
      const safePackages = packages.map(pkg => ({
        id: pkg.id,
        name: pkg.name,
        sessions: pkg.sessions,
        price: typeof pkg.price === 'string' ? pkg.price : String(pkg.price),
        description: pkg.description || ''
      }));
      
      // Hapus semua header yang mungkin mempengaruhi intepretasi respon
      res.removeHeader('X-Powered-By');
      
      // Set header yang jelas untuk JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store, no-cache');
      
      // Kirim respons JSON sebagai string
      const jsonString = JSON.stringify(safePackages);
      console.log(`[DIRECT API] Mengirim ${safePackages.length} paket`);
      
      // Jika empty, kirim array kosong
      if (safePackages.length === 0) {
        res.send("[]");
      } else {
        res.send(jsonString);
      }
    } catch (error) {
      console.error("[DIRECT API] Error mendapatkan paket:", error);
      res.status(500).json({ error: "Gagal mengambil data paket" });
    }
  });

  console.log("Direct API endpoints terdaftar: /api/direct/*");
}