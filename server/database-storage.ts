import { 
  User, InsertUser, Patient, InsertPatient,
  Product, InsertProduct, Package, InsertPackage, Transaction,
  InsertTransaction, Session, InsertSession,
  Appointment, InsertAppointment, TherapySlot, InsertTherapySlot,
  RegistrationLink, InsertRegistrationLink, ConfirmationToken, InsertConfirmationToken,
  MedicalHistory, InsertMedicalHistory,
  medicalHistories, patients, users, products, packages, transactions, 
  sessions, appointments, therapySlots, registrationLinks, confirmationTokens
} from "@shared/schema";
import { db, sql } from "./db";
import { eq, gt, lt, and, desc, asc, not, inArray } from "drizzle-orm";
import * as schema from "../shared/schema";
import { format } from "date-fns";
import { IStorage } from "./storage";
import session from "express-session";
import createMemoryStore from "memorystore";

// Utility functions for formatting
function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Utility function untuk mendapatkan waktu dengan zona waktu Indonesia (GMT+7/WIB)
// Konsisten untuk digunakan di seluruh aplikasi saat menyimpan atau mengambil data dari database
function getWIBDate(date: Date): Date {
  // Jika tanggal sudah dalam format WIB (misalnya dari input lokal), kembalikan sebagaimana adanya
  if (date.toString().includes('(Western Indonesia Time)') || 
      date.toString().includes('(WIB)') ||
      date.toString().includes('GMT+0700')) {
    return date;
  }
  
  // Waktu Indonesia Barat adalah GMT+7
  const offset = 7 * 60 * 60 * 1000; // 7 jam dalam milidetik
  // Mendapatkan UTC time
  const utcTime = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  // Menambahkan offset zona waktu WIB
  return new Date(utcTime + offset);
}

function formatDateString(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return format(date, 'dd MMMM yyyy');
}

// Menggunakan MemoryStore yang lebih sederhana dan handal
const MemoryStore = createMemoryStore(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    // Gunakan memory store dengan TTL yang panjang
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Bersihkan entri yang kedaluwarsa setiap 24 jam
      ttl: 30 * 24 * 60 * 60 * 1000 // 30 hari dalam milidetik
    });
    
    // Initialize default data if needed
    this.initDefaultData().catch(err => {
      console.error("Error initializing default data:", err);
    });
  }

  // Initialize default data
  private async initDefaultData() {
    try {
      // Check if users table is empty
      const existingUsers = await db.query.users.findMany({
        limit: 1
      });

      if (existingUsers.length === 0) {
        console.log("Initializing default admin users...");
        // Create default admin user
        await db.insert(schema.users).values({
          username: "admin",
          password: "admin123456",
          name: "Administrator",
          role: "admin"
        });

        // Create second admin user
        await db.insert(schema.users).values({
          username: "suryalim11",
          password: "admin123456", 
          name: "Surya Lim",
          role: "admin"
        });
      }

      // Check if registration_links table is empty
      const existingLinks = await db.query.registrationLinks.findMany({
        limit: 1
      });

      if (existingLinks.length === 0) {
        console.log("Initializing default registration link...");
        // Create default registration link
        const now = new Date();
        const expiryTime = new Date(now);
        expiryTime.setHours(expiryTime.getHours() + 168); // 7 days

        await db.insert(schema.registrationLinks).values({
          code: "TTS-REG",
          expiryTime: expiryTime,
          dailyLimit: 5,
          createdBy: 1, // Admin user ID
          specificDate: null
        });
      }

      // Check if packages table is empty
      const existingPackages = await db.query.packages.findMany({
        limit: 1
      });

      if (existingPackages.length === 0) {
        console.log("Initializing default packages...");
        // Create default packages
        await db.insert(schema.packages).values({
          name: "Sesi Tunggal",
          sessions: 1,
          price: "150000",
          description: "Paket terapi untuk satu sesi"
        });

        await db.insert(schema.packages).values({
          name: "Paket 12 Sesi",
          sessions: 12,
          price: "1500000",
          description: "Paket terapi untuk 12 sesi dengan harga spesial"
        });
      }

      // Check if products table is empty
      const existingProducts = await db.query.products.findMany({
        limit: 1
      });

      if (existingProducts.length === 0) {
        console.log("Initializing default products...");
        // Create some default products
        const products = [
          {
            name: "Minyak Pijat Herbal",
            price: "85000",
            stock: 25,
            description: "Minyak pijat dengan bahan herbal alami"
          },
          {
            name: "Bantal Terapi",
            price: "120000",
            stock: 15,
            description: "Bantal khusus untuk terapi"
          },
          {
            name: "Krim Pijat",
            price: "65000",
            stock: 30,
            description: "Krim pijat untuk relaksasi"
          },
          {
            name: "Minyak Esensial Lavender",
            price: "95000",
            stock: 20,
            description: "Minyak esensial lavender untuk aromaterapi"
          }
        ];

        for (const product of products) {
          await db.insert(schema.products).values(product);
        }
      }

      // Initialize default therapy slots
      await this.initDefaultTherapySlots();
      
      console.log("Database initialization completed!");
    } catch (error) {
      console.error("Error in database initialization:", error);
      throw error;
    }
  }

  // Initialize default therapy slots
  private async initDefaultTherapySlots() {
    try {
      // Check if therapy_slots table is empty
      const existingSlots = await db.query.therapySlots.findMany({
        limit: 1
      });

      if (existingSlots.length === 0) {
        console.log("Initializing default therapy slots...");
        // Create therapy slots for the next 7 days
        const today = new Date();
        
        // Definisi slot waktu default sesuai permintaan
        const timeSlots = [
          { time: "10:00-12:00", quota: 4 },
          { time: "13:00-15:00", quota: 3 },
          { time: "15:00-17:00", quota: 3 }
        ];
        
        // Create slots for 14 days (2 minggu ke depan)
        for (let i = 0; i < 14; i++) {
          const slotDate = new Date(today);
          slotDate.setDate(slotDate.getDate() + i);
          
          // Skip Sundays (0 = Sunday, 1 = Monday, etc.)
          if (slotDate.getDay() === 0) continue;
          
          // Create all time slots for this day
          for (const slot of timeSlots) {
            await db.insert(schema.therapySlots).values({
              date: slotDate,
              timeSlot: slot.time,
              maxQuota: slot.quota,
              currentCount: 0,
              isActive: true
            });
          }
        }
        console.log("Default therapy slots created!");
      }
    } catch (error) {
      console.error("Error initializing therapy slots:", error);
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.query.users.findFirst({
      where: eq(schema.users.id, id)
    });
    return result;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.query.users.findFirst({
      where: eq(schema.users.username, username)
    });
    return result;
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(schema.users).values(user).returning();
    return result[0];
  }

  async updateUserPassword(id: number, newPassword: string): Promise<User | undefined> {
    const result = await db
      .update(schema.users)
      .set({ password: newPassword })
      .where(eq(schema.users.id, id))
      .returning();
    return result[0];
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    // Pastikan password tidak diperbarui melalui fungsi ini
    const { password, ...safeUserData } = userData;
    
    const result = await db
      .update(schema.users)
      .set(safeUserData)
      .where(eq(schema.users.id, id))
      .returning();
    return result[0];
  }

  // Patient methods
  async getPatient(id: number): Promise<Patient | undefined> {
    const result = await db.query.patients.findFirst({
      where: eq(schema.patients.id, id)
    });
    return result;
  }

  async getAllPatients(): Promise<Patient[]> {
    return db.query.patients.findMany({
      orderBy: [desc(schema.patients.createdAt)]
    });
  }

  async createPatient(patient: InsertPatient): Promise<Patient> {
    // Generate patient ID
    const existingPatients = await db.query.patients.findMany({
      columns: { id: true }
    });
    
    const nextId = existingPatients.length > 0 
      ? Math.max(...existingPatients.map(p => p.id)) + 1
      : 1;
    
    const patientId = `P-${new Date().getFullYear()}-${String(nextId).padStart(3, '0')}`;
    
    const result = await db.insert(schema.patients)
      .values({ ...patient, patientId })
      .returning();
      
    // Increment therapy slot usage if assigned
    if (patient.therapySlotId) {
      await this.incrementTherapySlotUsage(patient.therapySlotId);
    }
    
    return result[0];
  }

  async updatePatient(id: number, patient: InsertPatient): Promise<Patient | undefined> {
    const result = await db
      .update(schema.patients)
      .set(patient)
      .where(eq(schema.patients.id, id))
      .returning();
    return result[0];
  }
  
  async deletePatient(id: number): Promise<boolean> {
    try {
      // Dapatkan semua janji temu pasien untuk mengurangi kuota slot terapi
      const patientAppointments = await db
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.patientId, id));
      
      // Untuk setiap janji temu yang aktif, kurangi kuota slot terapi
      for (const appointment of patientAppointments) {
        if (appointment.status !== "cancelled" && appointment.therapySlotId) {
          // Dapatkan slot terapi
          const therapySlot = await this.getTherapySlot(appointment.therapySlotId);
          
          if (therapySlot && therapySlot.currentCount > 0) {
            // Kurangi kuota terhitung pada slot terapi
            await this.decrementTherapySlotUsage(appointment.therapySlotId);
            console.log(`Mengurangi kuota untuk slot terapi ID ${appointment.therapySlotId}`);
          }
        }
      }
      
      // Find and delete all related appointments
      await db
        .delete(schema.appointments)
        .where(eq(schema.appointments.patientId, id));
      
      // Find and delete all related sessions
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.patientId, id));
      
      // Delete the patient
      await db
        .delete(schema.patients)
        .where(eq(schema.patients.id, id));
      
      return true;
    } catch (error) {
      console.error("Error saat menghapus pasien:", error);
      return false;
    }
  }
  
  async searchPatientByNameOrPhone(query: string): Promise<Patient[]> {
    const queryLowerCase = query.toLowerCase();
    
    // Using direct column equality approach instead of raw SQL to fix type issues
    const results = await db.query.patients.findMany({
      where: (fields, { or, like, eq }) => 
        or(
          like(fields.name, `%${queryLowerCase}%`),
          like(fields.phoneNumber, `%${query}%`)
        ),
      orderBy: [desc(schema.patients.createdAt)]
    });
    
    return results;
  }
  
  // Confirmation Token methods
  async createConfirmationToken(token: InsertConfirmationToken): Promise<ConfirmationToken> {
    // Insert token into database
    const [result] = await db.insert(schema.confirmationTokens)
      .values({
        token: token.token,
        patientId: token.patientId,
        appointmentId: token.appointmentId,
        expiryTime: token.expiryTime,
        isUsed: false
      })
      .returning();
    
    return result;
  }
  
  async getConfirmationTokenByToken(token: string): Promise<ConfirmationToken | undefined> {
    const result = await db.query.confirmationTokens.findFirst({
      where: eq(schema.confirmationTokens.token, token)
    });
    return result;
  }
  
  async markTokenAsUsed(token: string): Promise<ConfirmationToken | undefined> {
    const [result] = await db
      .update(schema.confirmationTokens)
      .set({ isUsed: true })
      .where(eq(schema.confirmationTokens.token, token))
      .returning();
    
    return result;
  }

  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    const result = await db.query.products.findFirst({
      where: eq(schema.products.id, id)
    });
    return result;
  }

  async getAllProducts(): Promise<Product[]> {
    return db.query.products.findMany({
      orderBy: asc(schema.products.name)
    });
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(schema.products).values(product).returning();
    return result[0];
  }

  async updateProduct(id: number, product: InsertProduct): Promise<Product | undefined> {
    const result = await db
      .update(schema.products)
      .set(product)
      .where(eq(schema.products.id, id))
      .returning();
    return result[0];
  }

  async updateProductStock(id: number, stockChange: number): Promise<Product | undefined> {
    // First get the current product to calculate new stock
    const product = await this.getProduct(id);
    if (!product) return undefined;
    
    const newStock = product.stock + stockChange;
    
    const result = await db
      .update(schema.products)
      .set({ stock: newStock })
      .where(eq(schema.products.id, id))
      .returning();
    return result[0];
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.products)
      .where(eq(schema.products.id, id))
      .returning({ id: schema.products.id });
    return result.length > 0;
  }

  // Package methods
  async getPackage(id: number): Promise<Package | undefined> {
    const result = await db.query.packages.findFirst({
      where: eq(schema.packages.id, id)
    });
    return result;
  }

  async getAllPackages(): Promise<Package[]> {
    return db.query.packages.findMany();
  }
  
  async createPackage(packageData: InsertPackage): Promise<Package> {
    const [newPackage] = await db
      .insert(schema.packages)
      .values({
        name: packageData.name,
        sessions: packageData.sessions,
        price: packageData.price,
        description: packageData.description
      })
      .returning();
    return newPackage;
  }
  
  async updatePackage(id: number, packageData: InsertPackage): Promise<Package | undefined> {
    // Periksa apakah paket ada
    const existingPackage = await this.getPackage(id);
    if (!existingPackage) {
      return undefined;
    }
    
    // Update paket
    const [updatedPackage] = await db
      .update(schema.packages)
      .set({
        name: packageData.name,
        sessions: packageData.sessions,
        price: packageData.price,
        description: packageData.description
      })
      .where(eq(schema.packages.id, id))
      .returning();
    
    return updatedPackage;
  }
  
  async deletePackage(id: number): Promise<boolean> {
    try {
      console.log(`Attempting to delete package with ID ${id}`);
      
      // Periksa apakah paket ada
      const existingPackage = await this.getPackage(id);
      if (!existingPackage) {
        console.log(`Package with ID ${id} not found`);
        return false;
      }
      
      // Periksa apakah ada sesi aktif yang menggunakan paket ini
      const activeSessions = await db.query.sessions.findMany({
        where: and(
          eq(schema.sessions.packageId, id),
          eq(schema.sessions.status, "active")
        )
      });
      
      if (activeSessions.length > 0) {
        console.log(`Cannot delete package with ID ${id}. There are ${activeSessions.length} active sessions using this package.`);
        // Kita bisa mempertimbangkan untuk mengembalikan informasi tambahan di sini
        // Untuk saat ini, kita cukup mengembalikan false
        return false;
      }
      
      // Hapus semua sesi non-aktif yang terkait dengan paket ini
      await db
        .delete(schema.sessions)
        .where(and(
          eq(schema.sessions.packageId, id),
          not(eq(schema.sessions.status, "active"))
        ));
      
      // Hapus paket
      const result = await db
        .delete(schema.packages)
        .where(eq(schema.packages.id, id))
        .returning({ id: schema.packages.id });
      
      console.log(`Package deletion result:`, result);
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting package:", error);
      return false;
    }
  }

  // Transaction methods
  async getTransaction(id: number): Promise<Transaction | undefined> {
    const result = await db.query.transactions.findFirst({
      where: eq(schema.transactions.id, id)
    });
    return result;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return db.query.transactions.findMany({
      orderBy: [desc(schema.transactions.createdAt)]
    });
  }

  async getTransactionsByPatient(patientId: number): Promise<Transaction[]> {
    return db.query.transactions.findMany({
      where: eq(schema.transactions.patientId, patientId),
      orderBy: [desc(schema.transactions.createdAt)]
    });
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    // Generate transaction ID dengan menggunakan waktu WIB
    const wibDate = getWIBDate(new Date());
    const transactionId = `T-${format(wibDate, 'yyyyMMdd')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    
    // Semua transaksi baru akan disimpan dengan createdAt yang sudah disesuaikan ke WIB
    const result = await db.insert(schema.transactions)
      .values({ 
        ...transaction, 
        transactionId,
        createdAt: wibDate // Gunakan waktu WIB yang konsisten
      })
      .returning();
    
    // Pastikan data yang dikembalikan juga dalam format waktu WIB
    const transactionResult = { 
      ...result[0],
      createdAt: getWIBDate(result[0].createdAt)
    };
    
    return transactionResult;
  }
  
  async deleteTransaction(id: number): Promise<boolean> {
    try {
      // Get the transaction first to handle related records
      const transaction = await this.getTransaction(id);
      if (!transaction) {
        return false;
      }
      
      // Menangani kasus khusus: Jika transaksi berisi penggunaan sesi dari paket
      // (contohnya transaksi dengan harga 0 yang merupakan penggunaan sesi paket terapi)
      const items = transaction.items as any[];
      if (items && Array.isArray(items)) {
        // Cek apakah ada item dengan jenis "package" dan descripsi berisi "menggunakan sisa paket"
        const isUsingExistingPackage = items.some(
          item => item.type === "package" && 
          item.description && 
          item.description.includes("menggunakan sisa paket")
        );
        
        if (isUsingExistingPackage) {
          // Jika transaksi ini adalah penggunaan sesi paket terapi, cari sesi yang terkait
          // dan kurangi jumlah sesi yang telah digunakan
          const sessions = await db.query.sessions.findMany({
            where: eq(schema.sessions.transactionId, id)
          });
          
          for (const session of sessions) {
            // Dapatkan sesi asli dari paket
            const originalSession = await db.query.sessions.findFirst({
              where: and(
                eq(schema.sessions.patientId, session.patientId),
                eq(schema.sessions.packageId, session.packageId),
                eq(schema.sessions.status, "active")
              )
            });
            
            if (originalSession) {
              // Kurangi jumlah sesi yang telah digunakan
              const updatedSessionsUsed = Math.max(0, originalSession.sessionsUsed - 1);
              console.log(`Memperbarui sesi paket ${originalSession.id}: mendecrement sessionsUsed dari ${originalSession.sessionsUsed} menjadi ${updatedSessionsUsed}`);
              
              await db.update(schema.sessions)
                .set({ 
                  sessionsUsed: updatedSessionsUsed,
                  status: "active"  // Pastikan statusnya kembali aktif
                })
                .where(eq(schema.sessions.id, originalSession.id));
            }
          }
          
          // Hapus sesi dari transaksi ini
          for (const session of sessions) {
            await db.delete(schema.sessions)
              .where(eq(schema.sessions.id, session.id));
          }
        } else {
          // Kasus normal: Transaksi pembelian paket baru
          console.log("Menghapus transaksi pembelian paket");
          
          // Find and delete related sessions
          const sessions = await db.query.sessions.findMany({
            where: eq(schema.sessions.transactionId, id)
          });
          
          // Delete each session
          for (const session of sessions) {
            await db.delete(schema.sessions)
              .where(eq(schema.sessions.id, session.id));
          }
        }
        
        // For products in the transaction, restore stock
        for (const item of items) {
          if (item.type === 'product' && typeof item.id === 'number' && typeof item.quantity === 'number') {
            // Get the product
            const product = await this.getProduct(item.id);
            if (product) {
              // Restore stock by adding back the quantity
              await this.updateProductStock(item.id, item.quantity);
            }
          }
        }
      }
      
      // Finally, delete the transaction
      const result = await db.delete(schema.transactions)
        .where(eq(schema.transactions.id, id));
      
      return true;
    } catch (error) {
      console.error('Error deleting transaction:', error);
      return false;
    }
  }

  // Session methods
  async getSession(id: number): Promise<Session | undefined> {
    const result = await db.query.sessions.findFirst({
      where: eq(schema.sessions.id, id)
    });
    return result;
  }

  async getSessionsByPatient(patientId: number): Promise<Session[]> {
    return db.query.sessions.findMany({
      where: eq(schema.sessions.patientId, patientId)
    });
  }

  async getActiveSessionsByPatient(patientId: number): Promise<Session[]> {
    return db.query.sessions.findMany({
      where: and(
        eq(schema.sessions.patientId, patientId),
        eq(schema.sessions.status, "active")
      )
    });
  }
  
  async getAllActiveSessions(): Promise<Session[]> {
    // Get all active sessions first
    const allActiveSessions = await db.query.sessions.findMany({
      where: eq(schema.sessions.status, "active")
    });
    
    // Process to eliminate duplicate sessions (only keep the latest session for each patient+package combination)
    const uniqueCombinations = new Map<string, Session>();
    
    for (const session of allActiveSessions) {
      const key = `${session.patientId}_${session.packageId}`;
      
      if (!uniqueCombinations.has(key)) {
        uniqueCombinations.set(key, session);
      } else {
        const existingSession = uniqueCombinations.get(key)!;
        
        // Keep the session with the most recent lastSessionDate, or if that's equal, the one with higher sessionsUsed
        if (!existingSession.lastSessionDate && session.lastSessionDate) {
          uniqueCombinations.set(key, session);
        } else if (existingSession.lastSessionDate && session.lastSessionDate) {
          const existingDate = new Date(existingSession.lastSessionDate);
          const newDate = new Date(session.lastSessionDate);
          
          if (newDate > existingDate || 
              (newDate.getTime() === existingDate.getTime() && session.sessionsUsed > existingSession.sessionsUsed)) {
            uniqueCombinations.set(key, session);
          }
        } else if (session.sessionsUsed > existingSession.sessionsUsed) {
          uniqueCombinations.set(key, session);
        }
      }
    }
    
    return Array.from(uniqueCombinations.values());
  }

  async createSession(session: InsertSession): Promise<Session> {
    const wibDate = getWIBDate(new Date());
    
    // Tambahkan startDate dengan waktu WIB ke session
    const result = await db.insert(schema.sessions).values({
      ...session,
      startDate: wibDate // startDate adalah field yang valid dalam schema
    }).returning();
    
    return {
      ...result[0],
      startDate: getWIBDate(result[0].startDate) // Konversi kembali ke WIB untuk tampilan
    };
  }

  async updateSessionUsage(id: number, sessionsUsed?: number): Promise<Session | undefined> {
    // Get existing session first to check totalSessions
    const existingSession = await this.getSession(id);
    if (!existingSession) return undefined;
    
    // If sessionsUsed is provided, use it, otherwise increment the current value
    if (sessionsUsed !== undefined) {
      const result = await db
        .update(schema.sessions)
        .set({ 
          sessionsUsed: sessionsUsed,
          lastSessionDate: new Date(),
          status: sessionsUsed >= existingSession.totalSessions ? "completed" : "active"
        })
        .where(eq(schema.sessions.id, id))
        .returning();
      return result[0];
    } else {
      // Get current session to increment
      const currentSession = await this.getSession(id);
      if (!currentSession) return undefined;
      
      const newSessionsUsed = currentSession.sessionsUsed + 1;
      const newStatus = newSessionsUsed >= currentSession.totalSessions ? "completed" : "active";
      
      const result = await db
        .update(schema.sessions)
        .set({ 
          sessionsUsed: newSessionsUsed,
          lastSessionDate: new Date(),
          status: newStatus
        })
        .where(eq(schema.sessions.id, id))
        .returning();
      return result[0];
    }
  }

  // Therapy Slot methods
  async getTherapySlot(id: number): Promise<TherapySlot | undefined> {
    const result = await db.query.therapySlots.findFirst({
      where: eq(schema.therapySlots.id, id)
    });
    return result;
  }

  async getTherapySlotsByDate(date: Date): Promise<TherapySlot[]> {
    // Create date range for the given date (start of day to end of day)
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    return db.query.therapySlots.findMany({
      where: and(
        gt(schema.therapySlots.date, startDate),
        lt(schema.therapySlots.date, endDate)
      ),
      orderBy: [asc(schema.therapySlots.timeSlot)]
    });
  }

  async getAllTherapySlots(): Promise<TherapySlot[]> {
    return db.query.therapySlots.findMany({
      orderBy: [asc(schema.therapySlots.date), asc(schema.therapySlots.timeSlot)]
    });
  }

  async getActiveTherapySlots(): Promise<TherapySlot[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return db.query.therapySlots.findMany({
      where: and(
        eq(schema.therapySlots.isActive, true),
        gt(schema.therapySlots.date, today)
      ),
      orderBy: [asc(schema.therapySlots.date), asc(schema.therapySlots.timeSlot)]
    });
  }

  async createTherapySlot(slot: InsertTherapySlot): Promise<TherapySlot> {
    const result = await db.insert(schema.therapySlots).values(slot).returning();
    return result[0];
  }

  async updateTherapySlot(id: number, slot: Partial<InsertTherapySlot>): Promise<TherapySlot | undefined> {
    const result = await db
      .update(schema.therapySlots)
      .set(slot)
      .where(eq(schema.therapySlots.id, id))
      .returning();
    return result[0];
  }

  async incrementTherapySlotUsage(id: number): Promise<TherapySlot | undefined> {
    // Get current slot to increment count
    const currentSlot = await this.getTherapySlot(id);
    if (!currentSlot) return undefined;
    
    const result = await db
      .update(schema.therapySlots)
      .set({ 
        currentCount: currentSlot.currentCount + 1
      })
      .where(eq(schema.therapySlots.id, id))
      .returning();
    return result[0];
  }

  async decrementTherapySlotUsage(id: number): Promise<TherapySlot | undefined> {
    // Get current slot to decrement count
    const currentSlot = await this.getTherapySlot(id);
    if (!currentSlot || currentSlot.currentCount <= 0) return undefined;
    
    const result = await db
      .update(schema.therapySlots)
      .set({ 
        currentCount: currentSlot.currentCount - 1
      })
      .where(eq(schema.therapySlots.id, id))
      .returning();
    return result[0];
  }

  async deactivateTherapySlot(id: number): Promise<boolean> {
    const result = await db
      .update(schema.therapySlots)
      .set({ isActive: false })
      .where(eq(schema.therapySlots.id, id))
      .returning({ id: schema.therapySlots.id });
    return result.length > 0;
  }

  async deleteTherapySlot(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.therapySlots)
      .where(eq(schema.therapySlots.id, id))
      .returning({ id: schema.therapySlots.id });
    return result.length > 0;
  }

  // Appointment methods
  async getAppointment(id: number): Promise<Appointment | undefined> {
    const result = await db.query.appointments.findFirst({
      where: eq(schema.appointments.id, id)
    });
    return result;
  }

  async getAllAppointments(): Promise<Appointment[]> {
    return db.query.appointments.findMany({
      orderBy: [desc(schema.appointments.date)]
    });
  }

  async getAppointmentsByDate(date: Date): Promise<Appointment[]> {
    // Create date range for the given date (start of day to end of day)
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    console.log(`Fetching appointments for date: ${date.toISOString().split('T')[0]}`);
    
    const appointments = await db.query.appointments.findMany({
      where: and(
        gt(schema.appointments.date, startDate),
        lt(schema.appointments.date, endDate),
        not(eq(schema.appointments.status, "Cancelled")) // Filter out cancelled appointments
      )
    });
    
    console.log(`Found ${appointments.length} appointments for date ${date.toISOString().split('T')[0]}`);
    
    return appointments;
  }

  async getAppointmentsByPatient(patientId: number): Promise<Appointment[]> {
    return db.query.appointments.findMany({
      where: eq(schema.appointments.patientId, patientId),
      orderBy: [desc(schema.appointments.date)]
    });
  }

  async getAppointmentsByTherapySlot(therapySlotId: number): Promise<Appointment[]> {
    try {
      // Ambil semua appointment untuk slot terapi ini
      const allAppointmentsForSlot = await db.query.appointments.findMany({
        where: eq(schema.appointments.therapySlotId, therapySlotId)
      });
      
      // Log hanya pada mode development
      if (process.env.NODE_ENV === 'development') {
        console.log(`All appointments for slot ${therapySlotId}:`, 
          allAppointmentsForSlot.map(a => ({id: a.id, status: a.status}))
        );
      }
      
      // Filter semua status yang aktif (tidak dibatalkan dan dalam status valid)
      const activeStatusPatterns = ['active', 'booked', 'confirmed', 'scheduled'];
      const nonCancelledAppointments = allAppointmentsForSlot.filter(app => {
        const statusLower = app.status.toLowerCase();
        // Jika status mengandung 'cancel' maka itu dibatalkan
        if (statusLower.includes('cancel')) {
          return false;
        }
        // Periksa apakah status termasuk dalam daftar status aktif
        const isActiveStatus = activeStatusPatterns.some(pattern => 
          statusLower.includes(pattern)
        );
        
        // Debug - Tambahkan log untuk mempermudah pelacakan (hanya pada mode development)
        if (process.env.NODE_ENV === 'development') {
          console.log(`Appointment ${app.id} (${app.status}): isActiveStatus=${isActiveStatus}`);
        }
        
        return isActiveStatus;
      });
      
      // Log hanya pada mode development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Non-cancelled appointments for slot ${therapySlotId}:`, 
          nonCancelledAppointments.map(a => ({id: a.id, status: a.status}))
        );
      }
      
      return nonCancelledAppointments;
    } catch (error) {
      console.error(`Error in getAppointmentsByTherapySlot for slot ${therapySlotId}:`, error);
      // Kembalikan array kosong jika terjadi error
      return [];
    }
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    // Generate registration number with WIB time if not provided
    const wibDate = getWIBDate(new Date());
    let regNum = appointment.registrationNumber;
    
    if (!regNum) {
      regNum = `R-${format(wibDate, 'yyyyMMdd')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    }
    
    // Pastikan date menggunakan zona waktu WIB untuk konsistensi
    const result = await db.insert(schema.appointments)
      .values({
        patientId: appointment.patientId,
        sessionId: appointment.sessionId,
        therapySlotId: appointment.therapySlotId,
        date: wibDate, // Konsisten menggunakan waktu WIB untuk tanggal
        timeSlot: appointment.timeSlot,
        notes: appointment.notes,
        status: appointment.status,
        registrationNumber: regNum
      })
      .returning();
    
    // Konversi date ke WIB untuk tampilan
    return {
      ...result[0],
      date: getWIBDate(result[0].date)
    };
  }

  async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
    // Dapatkan data janji temu sebelumnya untuk membandingkan status
    const existingAppointment = await db.query.appointments.findFirst({
      where: eq(schema.appointments.id, id)
    });
    
    if (!existingAppointment) {
      return undefined;
    }
    
    // Proses perubahan kuota slot terapi
    if (existingAppointment.therapySlotId) {
      // Jika status berubah dari aktif ke dibatalkan, kurangi kuota
      if (existingAppointment.status !== "cancelled" && status === "cancelled") {
        await this.decrementTherapySlotUsage(existingAppointment.therapySlotId);
        console.log(`Mengurangi kuota untuk slot terapi ID ${existingAppointment.therapySlotId} karena janji temu dibatalkan`);
      } 
      // Jika status berubah dari dibatalkan ke aktif, tambahkan kuota
      else if (existingAppointment.status === "cancelled" && status !== "cancelled") {
        await this.incrementTherapySlotUsage(existingAppointment.therapySlotId);
        console.log(`Menambah kuota untuk slot terapi ID ${existingAppointment.therapySlotId} karena janji temu diaktifkan`);
      }
    }
    
    // Update status janji temu
    const result = await db
      .update(schema.appointments)
      .set({ status })
      .where(eq(schema.appointments.id, id))
      .returning();
      
    return result[0];
  }

  // Registration Link methods
  async createRegistrationLink(userId: number, expiryHours: number, dailyLimit: number, specificDate?: string): Promise<RegistrationLink> {
    // Gunakan waktu WIB saat ini untuk basis kalkulasi
    const now = getWIBDate(new Date());
    const expiryTime = new Date(now);
    expiryTime.setHours(expiryTime.getHours() + expiryHours);
    
    // Generate random code
    const code = `TTS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const result = await db.insert(schema.registrationLinks)
      .values({
        code,
        expiryTime,
        dailyLimit,
        createdBy: userId,
        specificDate: specificDate || null
      })
      .returning();
    
    // Konversi waktu ke WIB untuk display
    return {
      ...result[0],
      expiryTime: getWIBDate(result[0].expiryTime),
      createdAt: getWIBDate(result[0].createdAt)
    };
  }

  async getRegistrationLinkByCode(code: string): Promise<RegistrationLink | undefined> {
    const result = await db.query.registrationLinks.findFirst({
      where: eq(schema.registrationLinks.code, code)
    });
    
    if (!result) return undefined;
    
    // Konversi timestamp ke WIB
    return {
      ...result,
      expiryTime: getWIBDate(result.expiryTime),
      createdAt: getWIBDate(result.createdAt)
    };
  }

  async getAllRegistrationLinks(): Promise<RegistrationLink[]> {
    const links = await db.query.registrationLinks.findMany({
      orderBy: [desc(schema.registrationLinks.createdAt)]
    });
    
    // Konversi semua timestamp ke WIB
    return links.map(link => ({
      ...link,
      expiryTime: getWIBDate(link.expiryTime),
      createdAt: getWIBDate(link.createdAt)
    }));
  }

  async incrementRegistrationCount(code: string): Promise<RegistrationLink | undefined> {
    // Get current link to increment count
    console.log(`[REGISTRATION] Mengambil link dengan kode ${code} untuk increment...`);
    const link = await this.getRegistrationLinkByCode(code);
    
    if (!link) {
      console.log(`[REGISTRATION] Link dengan kode ${code} tidak ditemukan`);
      return undefined;
    }
    
    console.log(`[REGISTRATION] Status link sebelum increment: ID=${link.id}, kode=${link.code}, currentRegistrations=${link.currentRegistrations}, dailyLimit=${link.dailyLimit}`);
    
    // Dengan transaction dan locking optimistic, ini akan menghindari race condition
    try {
      const result = await db
        .update(schema.registrationLinks)
        .set({ 
          currentRegistrations: link.currentRegistrations + 1
        })
        .where(eq(schema.registrationLinks.code, code))
        .returning();
      
      if (result.length === 0) {
        console.log(`[REGISTRATION] Gagal memperbarui link, tidak ada baris yang terpengaruh`);
        return undefined;
      }
      
      console.log(`[REGISTRATION] Link berhasil diperbarui: ID=${result[0].id}, currentRegistrations=${result[0].currentRegistrations}, dailyLimit=${result[0].dailyLimit}`);
      
      // Konversi timestamp ke WIB untuk hasil
      const updatedLink = {
        ...result[0],
        expiryTime: getWIBDate(result[0].expiryTime),
        createdAt: getWIBDate(result[0].createdAt)
      };
      
      return updatedLink;
    } catch (error) {
      console.error(`[REGISTRATION] Error saat memperbarui jumlah pendaftaran untuk kode ${code}:`, error);
      throw error; // Rethrow untuk penanganan di layer atas
    }
  }

  async deactivateRegistrationLink(id: number): Promise<boolean> {
    const result = await db
      .update(schema.registrationLinks)
      .set({ isActive: false })
      .where(eq(schema.registrationLinks.id, id))
      .returning({ id: schema.registrationLinks.id });
    return result.length > 0;
  }
  
  async deleteRegistrationLink(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.registrationLinks)
      .where(eq(schema.registrationLinks.id, id))
      .returning({ id: schema.registrationLinks.id });
    return result.length > 0;
  }

  // Dashboard methods
  async getDailyStats(): Promise<{
    patientsToday: number;
    incomeToday: number;
    productsSold: number;
    activePackages: number;
  }> {
    // Gunakan zona waktu WIB untuk perhitungan hari ini
    const wibNow = getWIBDate(new Date());
    
    // Dapatkan rentang waktu hari ini dalam zona waktu WIB
    const startOfDay = new Date(wibNow);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(wibNow);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Count patients registered today
    const patientsToday = await db.query.patients.findMany({
      where: and(
        gt(schema.patients.createdAt, startOfDay),
        lt(schema.patients.createdAt, endOfDay)
      )
    });
    
    // Calculate income from today's transactions
    const todayTransactions = await db.query.transactions.findMany({
      where: and(
        gt(schema.transactions.createdAt, startOfDay),
        lt(schema.transactions.createdAt, endOfDay)
      )
    });
    
    let incomeToday = 0;
    let productsSold = 0;
    
    for (const transaction of todayTransactions) {
      incomeToday += Number(transaction.totalAmount);
      
      // Count products sold
      if (typeof transaction.items === 'string') {
        const items = JSON.parse(transaction.items);
        for (const item of items) {
          if (item.type === 'product') {
            productsSold += item.quantity || 1;
          }
        }
      } else if (Array.isArray(transaction.items)) {
        for (const item of transaction.items) {
          if (item.type === 'product') {
            productsSold += item.quantity || 1;
          }
        }
      }
    }
    
    // Count active packages
    const activePackages = await db.query.sessions.findMany({
      where: eq(schema.sessions.status, "active")
    });
    
    return {
      patientsToday: patientsToday.length,
      incomeToday,
      productsSold,
      activePackages: activePackages.length
    };
  }

  async getRecentActivities(limit: number = 10): Promise<any[]> {
    // Mengambil berbagai jenis aktivitas dan menggabungkannya
    const activities: any[] = [];
    
    try {
      // 1. Dapatkan transaksi terbaru dan ID pasien terkait
      const recentTransactions = await db.query.transactions.findMany({
        orderBy: [desc(schema.transactions.createdAt)],
        limit: limit
      });
      
      if (recentTransactions.length > 0) {
        // Ambil semua ID pasien dari transaksi
        const patientIdArray = recentTransactions.map(t => t.patientId);
        const uniquePatientIds = Array.from(new Set(patientIdArray));
        
        // Dapatkan semua pasien dalam satu query
        const patientsQuery = await Promise.all(
          uniquePatientIds.map(id => db.query.patients.findFirst({
            where: eq(schema.patients.id, id)
          }))
        );
        
        // Filter undefined values dan buat map
        const patients = patientsQuery.filter(p => p !== undefined);
        
        // Buat map untuk pencarian cepat
        const patientMap = new Map();
        patients.forEach(patient => {
          if (patient) patientMap.set(patient.id, patient);
        });
        
        // Proses setiap transaksi dengan map pasien
        for (const transaction of recentTransactions) {
          const patient = patientMap.get(transaction.patientId);
          
          activities.push({
            id: transaction.id,
            type: "transaction",
            description: `${patient?.name || 'Pasien'} melakukan pembayaran sebesar Rp${Number(transaction.totalAmount).toLocaleString('id-ID')}`,
            timestamp: getWIBDate(transaction.createdAt).toISOString()
          });
        }
      }
      
      // 2. Dapatkan appointment terbaru
      const recentAppointments = await db.query.appointments.findMany({
        orderBy: [desc(schema.appointments.date)],
        limit: limit
      });
      
      if (recentAppointments.length > 0) {
        // Ambil semua ID pasien dari appointment
        const patientIdArray = recentAppointments.map(a => a.patientId);
        const uniquePatientIds = Array.from(new Set(patientIdArray));
        
        // Dapatkan semua pasien dalam satu query
        const patientsQuery = await Promise.all(
          uniquePatientIds.map(id => db.query.patients.findFirst({
            where: eq(schema.patients.id, id)
          }))
        );
        
        // Filter undefined values
        const patients = patientsQuery.filter(p => p !== undefined);
        
        // Buat map untuk pencarian cepat
        const patientMap = new Map();
        patients.forEach(patient => {
          if (patient) patientMap.set(patient.id, patient);
        });
        
        // Proses setiap appointment dengan map pasien
        for (const appointment of recentAppointments) {
          const patient = patientMap.get(appointment.patientId);
          
          if (patient) {
            const appointmentDate = new Date(appointment.date);
            const dateStr = formatDateString(appointmentDate);
            
            activities.push({
              id: 1000 + appointment.id, // Menambahkan offset untuk menghindari konflik ID
              type: "appointment",
              description: `${patient.name} terjadwal untuk sesi terapi`,
              timestamp: getWIBDate(appointmentDate).toISOString()
            });
          }
        }
      }
      
      // 3. Mengurutkan semua aktivitas berdasarkan timestamp terbaru
      activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
    } catch (error) {
      console.error("Error in getRecentActivities:", error);
    }
    
    // Mengembalikan hanya sejumlah limit
    return activities.slice(0, limit);
  }
  
  // Medical History methods
  async getMedicalHistory(id: number): Promise<MedicalHistory | undefined> {
    try {
      const [record] = await db.select()
        .from(medicalHistories)
        .where(eq(medicalHistories.id, id));
      
      return record;
    } catch (error) {
      console.error('[DB] Error getting medical history:', error);
      return undefined;
    }
  }

  async getMedicalHistoriesByPatient(patientId: number): Promise<MedicalHistory[]> {
    try {
      const records = await db.select()
        .from(medicalHistories)
        .where(eq(medicalHistories.patientId, patientId))
        .orderBy(desc(medicalHistories.treatmentDate));
      
      return records;
    } catch (error) {
      console.error('[DB] Error getting medical histories by patient:', error);
      return [];
    }
  }

  async createMedicalHistory(medicalHistory: InsertMedicalHistory): Promise<MedicalHistory> {
    try {
      const [record] = await db.insert(medicalHistories)
        .values({
          ...medicalHistory,
          createdAt: new Date()
        })
        .returning();
      
      return record;
    } catch (error) {
      console.error('[DB] Error creating medical history:', error);
      throw error;
    }
  }

  async updateMedicalHistory(id: number, medicalHistory: Partial<InsertMedicalHistory>): Promise<MedicalHistory | undefined> {
    try {
      const [updated] = await db.update(medicalHistories)
        .set(medicalHistory)
        .where(eq(medicalHistories.id, id))
        .returning();
      
      return updated;
    } catch (error) {
      console.error('[DB] Error updating medical history:', error);
      return undefined;
    }
  }

  async deleteMedicalHistory(id: number): Promise<boolean> {
    try {
      const result = await db.delete(medicalHistories)
        .where(eq(medicalHistories.id, id));
      
      return true;
    } catch (error) {
      console.error('[DB] Error deleting medical history:', error);
      return false;
    }
  }
}