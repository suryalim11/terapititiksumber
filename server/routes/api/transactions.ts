/**
 * API endpoint untuk manajemen transaksi
 */
import { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertTransactionSchema } from "@shared/schema";
import { getWIBDate, formatDateString } from "../../utils/date-utils";

/**
 * Mendaftarkan rute-rute untuk transaksi
 */
export function setupTransactionRoutes(app: Express) {
  // Mendapatkan semua transaksi
  app.get("/api/transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Error getting transactions:", error);
      res.status(500).json({ error: "Failed to get transactions" });
    }
  });

  // Mendapatkan transaksi berdasarkan ID
  app.get("/api/transactions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await storage.getTransaction(id);
      
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Error getting transaction:", error);
      res.status(500).json({ error: "Failed to get transaction" });
    }
  });

  // Mendapatkan transaksi berdasarkan pasien
  app.get("/api/transactions/patient/:patientId", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.patientId);
      const transactions = await storage.getTransactionsByPatient(patientId);
      res.json(transactions);
    } catch (error) {
      console.error("Error getting transactions for patient:", error);
      res.status(500).json({ error: "Failed to get transactions" });
    }
  });

  // Mendapatkan transaksi yang belum dibayar
  app.get("/api/transactions/unpaid", requireAuth, async (req: Request, res: Response) => {
    try {
      const transactions = await storage.getUnpaidTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Error getting unpaid transactions:", error);
      res.status(500).json({ error: "Failed to get unpaid transactions" });
    }
  });

  // Mendapatkan transaksi yang belum dibayar untuk pasien tertentu
  app.get("/api/transactions/unpaid/patient/:patientId", requireAuth, async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.patientId);
      const transactions = await storage.getUnpaidTransactionsByPatient(patientId);
      res.json(transactions);
    } catch (error) {
      console.error("Error getting unpaid transactions for patient:", error);
      res.status(500).json({ error: "Failed to get unpaid transactions" });
    }
  });

  // Membuat transaksi baru
  app.post("/api/transactions", requireAuth, async (req: Request, res: Response) => {
    try {
      const transactionData = insertTransactionSchema.parse(req.body);
      const newTransaction = await storage.createTransaction(transactionData);
      res.status(201).json(newTransaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid transaction data", details: error.errors });
      }
      
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  // Membuat pembayaran hutang
  app.post("/api/transactions/:id/debt-payment", requireAuth, async (req: Request, res: Response) => {
    try {
      const transactionId = parseInt(req.params.id);
      const { paymentMethod, amount, notes } = req.body;
      
      if (!paymentMethod || !amount) {
        return res.status(400).json({ error: "Payment method and amount are required" });
      }
      
      const debtPayment = await storage.createDebtPayment({
        transactionId,
        paymentMethod,
        amount,
        notes: notes || null
      });
      
      // Cek apakah transaksi sudah lunas setelah pembayaran
      const updatedTransaction = await storage.updateTransactionPaidStatus(transactionId);
      
      res.status(201).json({ 
        success: true, 
        payment: debtPayment,
        transaction: updatedTransaction
      });
    } catch (error) {
      console.error("Error creating debt payment:", error);
      res.status(500).json({ error: "Failed to create debt payment" });
    }
  });

  // Mendapatkan riwayat pembayaran hutang untuk transaksi
  app.get("/api/transactions/:id/debt-payments", requireAuth, async (req: Request, res: Response) => {
    try {
      const transactionId = parseInt(req.params.id);
      const payments = await storage.getDebtPaymentsByTransaction(transactionId);
      res.json(payments);
    } catch (error) {
      console.error("Error getting debt payments:", error);
      res.status(500).json({ error: "Failed to get debt payments" });
    }
  });

  // Update status pembayaran transaksi
  app.patch("/api/transactions/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { isPaid } = req.body;
      
      if (typeof isPaid !== 'boolean') {
        return res.status(400).json({ error: "isPaid must be a boolean" });
      }
      
      const updatedTransaction = await storage.updateTransaction(id, { isPaid });
      
      if (!updatedTransaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      res.json(updatedTransaction);
    } catch (error) {
      console.error("Error updating transaction status:", error);
      res.status(500).json({ error: "Failed to update transaction status" });
    }
  });

  // Menghapus transaksi
  app.delete("/api/transactions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTransaction(id);
      
      if (!success) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      res.json({ success: true, message: "Transaction deleted successfully" });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });
}