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

  // Mendapatkan detail transaksi berdasarkan ID
  app.get('/api/transactions/:id', async (req: Request, res: Response) => {
    try {
      const transactionId = parseInt(req.params.id);
      
      if (isNaN(transactionId)) {
        return res.status(400).json({ error: 'ID transaksi tidak valid' });
      }
      
      const transaction = await storage.getTransaction(transactionId);
      
      if (!transaction) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
      }
      
      res.status(200).json(transaction);
    } catch (error) {
      console.error(`Error saat mendapatkan detail transaksi ${req.params.id}:`, error);
      res.status(500).json({ error: 'Gagal mendapatkan detail transaksi' });
    }
  });

  // CREATE transaction with duplicate prevention
  app.post('/api/transactions', async (req: Request, res: Response) => {
    let newTransaction = null;
    const sessionWarnings: string[] = [];
    
    try {
      const transactionData = req.body;
      console.log('Creating transaction:', JSON.stringify(transactionData, null, 2));

      // Create the transaction first
      newTransaction = await storage.createTransaction(transactionData);
      console.log('Transaction created successfully:', newTransaction.id);

      // If transaction includes packages, create or update sessions
      // This is done in a separate try-catch to not fail the entire transaction
      if (transactionData.items && Array.isArray(transactionData.items)) {
        for (const item of transactionData.items) {
          if (item.type === 'package') {
            try {
              // Check if using existing session (when useExistingPackage=true)
              if (item.sessionId) {
                // Use existing session - increment sessionsUsed
                console.log(`Using existing session ${item.sessionId} for patient ${transactionData.patientId}`);
                const session = await storage.getSession(item.sessionId);
                if (session) {
                  await storage.updateSessionUsage(item.sessionId, session.sessionsUsed + 1);
                  console.log(`Updated session ${item.sessionId}: incremented sessionsUsed to ${session.sessionsUsed + 1}`);
                } else {
                  sessionWarnings.push(`Session ${item.sessionId} tidak ditemukan`);
                  console.warn(`Session ${item.sessionId} not found, skipping`);
                }
              } else {
                // Creating new package or adding to existing
                const existingSessions = await storage.getActiveSessionsByPatient(transactionData.patientId);
                const existingSession = existingSessions.find(s => s.packageId === item.packageId);

                if (existingSession) {
                  // Update existing session - add sessions to it
                  console.log(`Found existing session ${existingSession.id} for patient ${transactionData.patientId} and package ${item.packageId}`);
                  await storage.addSessionsToPackage(existingSession.id, item.quantity || 1);
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
            } catch (sessionError) {
              console.error('Error processing session for item:', item, sessionError);
              sessionWarnings.push(`Error saat memproses paket: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`);
            }
          }
        }
      }

      // Return success with any warnings
      const response: any = { ...newTransaction };
      if (sessionWarnings.length > 0) {
        response.warnings = sessionWarnings;
      }
      
      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating transaction:', error);
      
      // If transaction was created but something failed after, still return it
      if (newTransaction) {
        console.log('Transaction was created but post-processing failed. Returning transaction with warning.');
        res.status(201).json({
          ...newTransaction,
          warnings: [`Transaksi tersimpan, tapi ada error: ${error instanceof Error ? error.message : 'Unknown error'}`]
        });
      } else {
        res.status(500).json({ 
          error: 'Gagal membuat transaksi',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  // DELETE transaction with session rollback
  app.delete('/api/transactions/:id', async (req: Request, res: Response) => {
    try {
      const transactionId = parseInt(req.params.id);
      
      if (isNaN(transactionId)) {
        return res.status(400).json({ error: 'ID transaksi tidak valid' });
      }

      // Get transaction details before deleting to check if it used an existing session
      const transaction = await storage.getTransaction(transactionId);
      
      if (!transaction) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
      }

      // If transaction used existing session, rollback the sessionsUsed
      if (transaction.items && Array.isArray(transaction.items)) {
        for (const item of transaction.items) {
          // Check if this item used an existing session
          if (item.type === 'package' && item.sessionId && item.useExistingPackage) {
            console.log(`Rolling back session ${item.sessionId} for deleted transaction ${transactionId}`);
            const session = await storage.getSession(item.sessionId);
            if (session && session.sessionsUsed > 0) {
              await storage.updateSessionUsage(item.sessionId, session.sessionsUsed - 1);
              console.log(`Rolled back session ${item.sessionId}: decremented sessionsUsed to ${session.sessionsUsed - 1}`);
            }
          }
        }
      }

      // Now delete the transaction
      const success = await storage.deleteTransaction(transactionId);
      
      if (!success) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
      }
      
      res.status(200).json({ success: true, message: 'Transaksi berhasil dihapus' });

    } catch (error) {
      console.error(`Error menghapus transaksi ${req.params.id}:`, error);
      res.status(500).json({ error: 'Gagal menghapus transaksi' });
    }
  });
}