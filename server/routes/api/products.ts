/**
 * API endpoint untuk manajemen produk
 */
import { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertProductSchema } from "@shared/schema";

/**
 * Mendaftarkan rute-rute untuk produk
 */
export function setupProductRoutes(app: Express) {
  // Mendapatkan semua produk - ARAHKAN KE ENDPOINT FIXED
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      console.log("DEBUG-PRODUCTS: Redirecting to fixed endpoint");
      
      // Ambil dari fixed endpoint yang terbukti bekerja dengan baik
      const products = await storage.getAllProducts();
      
      // Pastikan header diatur dengan jelas
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Pragma', 'no-cache');
      
      // Format produk untuk keamanan, seperti di endpoint fixed
      const safeProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        description: p.description || ''
      }));
      
      // Langsung gunakan res.json bukan string manual
      res.json(safeProducts);
      
    } catch (error) {
      console.error("DEBUG-PRODUCTS: Error getting products:", error);
      res.status(500).json({ error: "Failed to get products", message: "Please use /api/fixed/products instead" });
    }
  });

  // Mendapatkan produk berdasarkan ID
  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error getting product:", error);
      res.status(500).json({ error: "Failed to get product" });
    }
  });

  // Membuat produk baru
  app.post("/api/products", requireAuth, async (req: Request, res: Response) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const newProduct = await storage.createProduct(productData);
      res.status(201).json(newProduct);
    } catch (error) {
      console.error("Error creating product:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  // Update produk
  app.put("/api/products/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const productData = insertProductSchema.parse(req.body);
      
      const updatedProduct = await storage.updateProduct(id, productData);
      
      if (!updatedProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  // Update stok produk
  app.patch("/api/products/:id/stock", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { stockChange } = req.body;
      
      if (typeof stockChange !== 'number') {
        return res.status(400).json({ error: "Stock change must be a number" });
      }
      
      const updatedProduct = await storage.updateProductStock(id, stockChange);
      
      if (!updatedProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      res.json(updatedProduct);
    } catch (error) {
      console.error("Error updating product stock:", error);
      res.status(500).json({ error: "Failed to update product stock" });
    }
  });

  // Hapus produk
  app.delete("/api/products/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteProduct(id);
      
      if (!success) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      res.json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });
}