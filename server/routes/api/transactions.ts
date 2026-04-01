/**
 * API untuk mengelola data transaksi
 */
import { Express, Request, Response } from "express";
import { storage } from "../../storage";

// Setup rute untuk transaksi
export function setupTransactionsRoutes(app: Express) {
  // Mendapatkan semua transaksi yang belum lunas (isPaid = false)
  app.get('/api/transactions/unpaid', async (req: Request, res: Response) => {
    try {
      const unpaidTransactions = await storage.getUnpaidTransactions();
      res.status(200).json(unpaidTransactions);
    } catch (error) {
      console.error('Error saat mendapatkan transaksi belum lunas:', error);
      res.status(500).json({ error: 'Gagal mendapatkan transaksi belum lunas' });
    }
  });

  // Mendapatkan transaksi belum lunas berdasarkan pasien
  app.get('/api/transactions/unpaid-by-patient/:patientId', async (req: Request, res: Response) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId)) {
        return res.status(400).json({ error: 'ID pasien tidak valid' });
      }
      const unpaidTransactions = await storage.getUnpaidTransactionsByPatient(patientId);
      res.status(200).json(unpaidTransactions);
    } catch (error) {
      console.error('Error saat mendapatkan transaksi belum lunas pasien:', error);
      res.status(500).json({ error: 'Gagal mendapatkan transaksi belum lunas pasien' });
    }
  });

  // Membuat pembayaran hutang (bisa dikombinasikan dengan transaksi baru)
  app.post('/api/transactions/debt-payment', async (req: Request, res: Response) => {
    try {
      const { transactionId, amount, paymentMethod, notes, newTransactionData } = req.body;

      if (!transactionId || !amount || !paymentMethod) {
        return res.status(400).json({ error: 'transactionId, amount, dan paymentMethod wajib diisi' });
      }

      const transaction = await storage.getTransaction(parseInt(transactionId));
      if (!transaction) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
      }

      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ error: 'Jumlah pembayaran tidak valid' });
      }

      const totalAmount = parseFloat(transaction.totalAmount as string);
      const paidAmount = parseFloat((transaction.paidAmount as string) || '0');
      const remainingDebt = Math.max(0, totalAmount - paidAmount);

      if (paymentAmount > remainingDebt) {
        return res.status(400).json({
          error: `Jumlah pembayaran (${paymentAmount}) melebihi sisa hutang (${remainingDebt})`
        });
      }

      // Simpan data pembayaran hutang ke tabel debt_payments
      const debtPayment = await storage.createDebtPayment({
        transactionId: parseInt(transactionId),
        amount: paymentAmount.toString(),
        paymentMethod,
        notes: notes || 'Pembayaran hutang'
      });

      // Jika ada data transaksi baru (pembelian sekaligus bayar hutang), buat transaksi baru juga
      let newTransaction = null;
      if (newTransactionData) {
        try {
          console.log('Creating combined new transaction alongside debt payment');
          newTransaction = await storage.createTransaction(newTransactionData);
          console.log('Combined new transaction created:', newTransaction.id);

          // Proses sesi paket jika ada
          if (newTransactionData.items && Array.isArray(newTransactionData.items)) {
            for (const item of newTransactionData.items) {
              if (item.type === 'package') {
                try {
                  if (item.sessionId) {
                    console.log(`[debtPayment+new] useExistingPackage sesi ${item.sessionId}`);
                  } else {
                    const existingSessions = await storage.getActiveSessionsByPatient(newTransactionData.patientId);
                    const existingSession = existingSessions.find((s: any) => s.packageId === item.packageId);
                    if (existingSession) {
                      const sessionsToAdd = item.totalSessions || item.quantity || 1;
                      await storage.addSessionsToPackage(existingSession.id, sessionsToAdd);
                    } else {
                      const totalSessions = item.totalSessions || item.quantity || 1;
                      await storage.createSession({
                        patientId: newTransactionData.patientId,
                        transactionId: newTransaction.id,
                        packageId: item.packageId,
                        totalSessions: totalSessions
                      });
                    }
                  }
                } catch (sessionError) {
                  console.error('Error processing session for debt+new transaction:', sessionError);
                }
              }
            }
          }
        } catch (newTxError) {
          console.error('Error creating new transaction in debt payment:', newTxError);
          // Debt payment sudah berhasil, kembalikan sukses meski transaksi baru gagal
        }
      }

      res.status(201).json({
        success: true,
        message: newTransaction
          ? 'Pembayaran hutang dan transaksi baru berhasil dicatat'
          : 'Pembayaran hutang berhasil dicatat',
        debtPayment,
        newTransaction
      });
    } catch (error) {
      console.error('Error saat membuat pembayaran hutang:', error);
      res.status(500).json({ error: 'Gagal memproses pembayaran hutang' });
    }
  });

  // Mendapatkan semua transaksi (filter by patientId jika diberikan)
  app.get('/api/transactions', async (req: Request, res: Response) => {
    try {
      // BUG FIX #11: Hapus hardcode pasien ID 369
      const patientId = req.query.patientId ? parseInt(req.query.patientId as string) : null;

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
                // BUG FIX #3: Jangan increment sessionsUsed di sini.
                // Session increment sudah ditangani oleh appointment creation (POST /api/appointments)
                // yang auto-increment ketika appointment dibuat untuk pasien yang punya sesi aktif.
                // Melakukan increment di sini juga menyebabkan double-count:
                //   1x saat appointment dibuat → appointments.ts auto-increment
                //   1x saat transaksi dibuat  → transactions.ts (kode lama, sudah dihapus)
                // Transaksi dengan useExistingPackage hanya mencatat billing/pembayaran,
                // bukan menambah penggunaan sesi baru.
                console.log(`[useExistingPackage] Transaksi menggunakan sesi ${item.sessionId} untuk pasien ${transactionData.patientId}. Session increment ditangani oleh appointment.`);
                const session = await storage.getSession(item.sessionId);
                if (!session) {
                  sessionWarnings.push(`Session ${item.sessionId} tidak ditemukan`);
                  console.warn(`Session ${item.sessionId} not found`);
                }
              } else {
                // Creating new package or adding to existing
                const existingSessions = await storage.getActiveSessionsByPatient(transactionData.patientId);
                const existingSession = existingSessions.find(s => s.packageId === item.packageId);

                if (existingSession) {
                  // Update existing session - add sessions to it
                  // BUG FIX #2: Gunakan item.totalSessions (jumlah sesi dalam paket), bukan item.quantity (jumlah item dibeli)
                  const sessionsToAdd = item.totalSessions || item.quantity || 1;
                  console.log(`Found existing session ${existingSession.id} for patient ${transactionData.patientId} and package ${item.packageId}`);
                  console.log(`Adding ${sessionsToAdd} sessions (totalSessions=${item.totalSessions}, quantity=${item.quantity})`);
                  await storage.addSessionsToPackage(existingSession.id, sessionsToAdd);
                  console.log(`Updated session ${existingSession.id}: increased total sessions by ${sessionsToAdd}`);
                } else {
                  // Create new session
                  // BUG FIX #1: Gunakan item.totalSessions (jumlah sesi dalam paket), bukan item.quantity (jumlah item dibeli)
                  const totalSessions = item.totalSessions || item.quantity || 1;
                  console.log(`Creating new session for patient ${transactionData.patientId} and package ${item.packageId}`);
                  console.log(`Total sessions: ${totalSessions} (totalSessions=${item.totalSessions}, quantity=${item.quantity})`);
                  await storage.createSession({
                    patientId: transactionData.patientId,
                    transactionId: newTransaction.id,
                    packageId: item.packageId,
                    totalSessions: totalSessions
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

      // BUG FIX #3 (rollback): Transaksi dengan useExistingPackage tidak lagi melakukan
      // increment sessionsUsed saat dibuat (lihat POST handler di atas).
      // Oleh karena itu, saat transaksi dihapus, TIDAK perlu rollback sessionsUsed.
      // Session decrement ditangani oleh appointment cancellation (PATCH /api/appointments/:id/status).
      // Kode rollback lama dihapus untuk menghindari decrement yang salah.
      if (transaction.items && Array.isArray(transaction.items)) {
        for (const item of transaction.items) {
          if (item.type === 'package' && item.sessionId && item.useExistingPackage) {
            console.log(`[DELETE TX] Transaksi ${transactionId} menggunakan sesi ${item.sessionId} (useExistingPackage). Tidak ada rollback sessionsUsed karena increment ditangani oleh appointment.`);
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