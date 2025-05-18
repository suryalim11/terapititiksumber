/**
 * Endpoint alternatif khusus untuk produk dengan format JSON yang disederhanakan
 */
import { Express, Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Mendaftarkan rute-rute untuk versi raw produk
 */
export function setupRawProductRoutes(app: Express) {
  // Mendapatkan semua produk dalam format minimal
  app.get("/api/raw/products", async (req: Request, res: Response) => {
    try {
      console.log("[RAW API] Fetching all products from database");
      const products = await storage.getAllProducts();
      console.log(`[RAW API] Retrieved ${products.length} products from database`);
      
      // Membuat versi yang disederhanakan
      const simplifiedProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        description: p.description || ''
      }));
      
      // Pastikan header diatur dengan benar
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json');
      
      // Kirim string JSON langsung
      res.send(JSON.stringify(simplifiedProducts));
    } catch (error) {
      console.error("[RAW API] Error getting products:", error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  // Mendapatkan semua paket dalam format minimal
  app.get("/api/raw/packages", async (req: Request, res: Response) => {
    try {
      console.log("[RAW API] Fetching all packages from database");
      const packages = await storage.getAllPackages();
      console.log(`[RAW API] Retrieved ${packages.length} packages from database`);
      
      // Membuat versi yang disederhanakan
      const simplifiedPackages = packages.map(p => ({
        id: p.id,
        name: p.name,
        sessions: p.sessions,
        price: p.price,
        description: p.description || ''
      }));
      
      // Pastikan header diatur dengan benar
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json');
      
      // Kirim string JSON langsung
      res.send(JSON.stringify(simplifiedPackages));
    } catch (error) {
      console.error("[RAW API] Error getting packages:", error);
      res.status(500).json({ error: "Failed to get packages" });
    }
  });
}