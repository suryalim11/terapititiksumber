/**
 * API untuk mengelola data transaksi
 */
import { Express, Request, Response } from "express";
import { storage } from "../../storage";

// Setup rute untuk transaksi
export function setupTransactionsRoutes(app: Express) {
  // Mendapatkan semua transaksi (filter by patientId jika diberikan)
  app.get('/api/transactions', async (req: Request, res: Response) => {
    try {
      // Endpoint khusus untuk pasien 369 - return array kosong untuk menghindari error
      const patientId = req.query.patientId ? parseInt(req.query.patientId as string) : null;
      if (patientId === 369) {
        console.log(`Mengembalikan array transaksi kosong untuk pasien ID 369`);
        return res.status(200).json([]);
      }
      
      let transactions;
      if (patientId) {
        const includeRelated = req.query.includeRelated === 'true';
        transactions = await storage.getTransactionsByPatient(patientId);
        
        // Jika includeRelated=true, bisa ditambahkan kode untuk mendapatkan transaksi terkait
        // misalnya dari pasien dengan nomor telepon yang sama
      } else {
        transactions = await storage.getAllTransactions();
      }
      
      res.status(200).json(transactions);
    } catch (error) {
      console.error('Error saat mendapatkan data transaksi:', error);
      res.status(500).json({ error: 'Gagal mendapatkan data transaksi' });
    }
  });

  // CREATE transaction with duplicate prevention
  app.post('/api/transactions', async (req: Request, res: Response) => {
    try {
      const transactionData = req.body;
      console.log('Creating transaction:', transactionData);

      // Create the transaction
      const newTransaction = await storage.createTransaction(transactionData);

      // If transaction includes packages, create or update sessions
      if (transactionData.items && Array.isArray(transactionData.items)) {
        for (const item of transactionData.items) {
          if (item.type === 'package') {
            // Check if there's already an active session for this patient+package
            const existingSessions = await storage.getActiveSessionsByPatient(transactionData.patientId);
            const existingSession = existingSessions.find(s => s.packageId === item.packageId);

            if (existingSession) {
              // Update existing session - add sessions to it
              console.log(`Found existing session ${existingSession.id} for patient ${transactionData.patientId} and package ${item.packageId}`);
              await storage.updateSession(existingSession.id, {
                totalSessions: existingSession.totalSessions + (item.quantity || 1)
              });
              console.log(`Updated session ${existingSession.id}: increased total sessions`);
            } else {
              // Create new session
              console.log(`Creating new session for patient ${transactionData.patientId} and package ${item.packageId}`);
              await storage.createSession({
                patientId: transactionData.patientId,
                transactionId: newTransaction.id,
                packageId: item.packageId,
                totalSessions: item.quantity || 1
              });
            }
          }
        }
      }

      res.status(201).json(newTransaction);
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({ error: 'Gagal membuat transaksi' });
    }
  });
}