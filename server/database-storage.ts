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
import { eq, gt, lt, gte, lte, and, desc, asc, not, inArray, ne, or } from "drizzle-orm";
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
export function getWIBDate(date: Date): Date {
  // Metode yang konsisten untuk konversi ke WIB (UTC+7)
  const originalDate = new Date(date);
  
  // 1. Konversi ke UTC
  const utcMillis = originalDate.getTime() + (originalDate.getTimezoneOffset() * 60000);
  
  // 2. Tambahkan 7 jam untuk WIB (UTC+7)
  const WIB_OFFSET = 7; // dalam jam
  const wibDate = new Date(utcMillis + (WIB_OFFSET * 3600000));
  
  // Log konsisten untuk monitoring
  console.log(`Formatting date string: ${originalDate.toISOString()}`);
  console.log(`Original: ${originalDate.toISOString()} -> Corrected date (WIB): ${wibDate.toISOString()}`);
  
  return wibDate;
}

function formatDateString(dateStr: string | Date): string {
  try {
    // Konversi input ke object Date, lalu gunakan getWIBDate untuk mendapat tanggal WIB yang konsisten
    const originalDate = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    
    // Gunakan fungsi getWIBDate yang sudah distandarisasi
    const wibDate = getWIBDate(originalDate);
    
    // Format tanggal menggunakan date-fns
    return format(wibDate, 'dd MMMM yyyy');
  } catch (error) {
    console.error("Error formatting date string:", error, dateStr);
    // Fallback untuk jaga-jaga jika terjadi error
    return typeof dateStr === 'string' ? dateStr : dateStr.toISOString().split('T')[0];
  }
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
        if (appointment.status !== "Cancelled" && appointment.therapySlotId) {
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
    
    // Debug: log apa yang dicari
    console.log(`Search query: "${query}", lowercase: "${queryLowerCase}"`);
    
    // Menggunakan pendekatan JavaScript sederhana - fetch semua pasien dan filter di memory
    // Ini lebih reliable meskipun kurang efisien untuk database besar
    // Tapi untuk kasus klinik dengan ratusan pasien, ini lebih dari cukup
    try {
      console.log("Using JavaScript filtering approach for optimal search");
      const allPatients = await db.query.patients.findMany({
        orderBy: [desc(schema.patients.createdAt)]
      });
      
      // Filter pasien berdasarkan nama (case-insensitive) atau nomor telepon (case-sensitive)
      const filtered = allPatients.filter(patient => 
        // Cek apakah nama mengandung query (case-insensitive)
        patient.name.toLowerCase().includes(queryLowerCase) || 
        // Cek apakah nomor telepon mengandung query (case-sensitive)
        patient.phoneNumber.includes(query)
      );
      
      console.log(`Search found ${filtered.length} patients matching "${query}"`);
      if (filtered.length > 0) {
        console.log("Matched patients:", filtered.map(p => `${p.id}: ${p.name} (${p.phoneNumber})`).join(", "));
      }
      
      return filtered;
    } catch (error) {
      console.error("Error searching patients:", error);
      return []; // Return empty array if there's an error
    }
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
    try {
      console.log(`Getting transaction details for ID: ${id}`);
      
      // Secara eksplisit select semua kolom, termasuk JSON columns
      const result = await db.query.transactions.findFirst({
        where: eq(schema.transactions.id, id),
        columns: {
          id: true,
          transactionId: true,
          patientId: true,
          totalAmount: true,
          discount: true,
          subtotal: true,
          paymentMethod: true,
          items: true, // Pastikan items (JSON) diambil
          creditAmount: true,
          isPaid: true,
          paidAmount: true,
          debtAmount: true,
          createdAt: true
        }
      });
      
      // Log hasil untuk debugging
      if (result) {
        console.log(`Transaction found for ID ${id} with ${result.items ? 'items data' : 'NO items data'}`);
        
        // Parse items jika berbentuk string
        if (result.items && typeof result.items === 'string') {
          try {
            result.items = JSON.parse(result.items);
            console.log(`Items parsed from string for transaction ${id}`);
          } catch (parseError) {
            console.error(`Error parsing items for transaction ${id}:`, parseError);
          }
        }
      } else {
        console.log(`No transaction found for ID ${id}`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error getting transaction ${id}:`, error);
      return undefined;
    }
  }

  async getAllTransactions(): Promise<Transaction[]> {
    try {
      // Secara eksplisit select semua kolom, termasuk JSON columns
      const transactions = await db.query.transactions.findMany({
        columns: {
          id: true,
          transactionId: true,
          patientId: true,
          totalAmount: true,
          discount: true,
          subtotal: true,
          paymentMethod: true,
          items: true, // Pastikan items (JSON) diambil
          creditAmount: true,
          isPaid: true,
          paidAmount: true,
          debtAmount: true,
          createdAt: true
        },
        orderBy: [desc(schema.transactions.createdAt)]
      });
      
      // Proses data items jika perlu
      return transactions.map(transaction => {
        // Parse items jika berbentuk string
        if (transaction.items && typeof transaction.items === 'string') {
          try {
            transaction.items = JSON.parse(transaction.items);
          } catch (parseError) {
            console.error(`Error parsing items for transaction ${transaction.id}:`, parseError);
          }
        }
        
        return transaction;
      });
    } catch (error) {
      console.error("Error getting all transactions:", error);
      // Return empty array if error occurs instead of failing the entire operation
      return [];
    }
  }

  async getTransactionsByPatient(patientId: number, includeRelated: boolean = false): Promise<Transaction[]> {
    try {
      if (!includeRelated) {
        // Secara eksplisit select semua kolom, termasuk JSON columns
        const transactions = await db.query.transactions.findMany({
          columns: {
            id: true,
            transactionId: true,
            patientId: true,
            totalAmount: true,
            discount: true,
            subtotal: true,
            paymentMethod: true,
            items: true, // Pastikan items (JSON) diambil
            creditAmount: true,
            isPaid: true,
            paidAmount: true,
            debtAmount: true,
            createdAt: true
          },
          where: eq(schema.transactions.patientId, patientId),
          orderBy: [desc(schema.transactions.createdAt)]
        });
        
        // Proses data items jika perlu
        return transactions.map(transaction => {
          // Parse items jika berbentuk string
          if (transaction.items && typeof transaction.items === 'string') {
            try {
              transaction.items = JSON.parse(transaction.items);
            } catch (parseError) {
              console.error(`Error parsing items for transaction ${transaction.id}:`, parseError);
            }
          }
          
          return transaction;
        });
      }
      
      // Include transactions from related patients (same phone number)
      // First get the current patient
      const patient = await db.query.patients.findFirst({
        where: eq(schema.patients.id, patientId)
      });
      
      if (!patient) {
        return [];
      }
      
      // Get all patients with the same phone number
      const relatedPatients = await db.select()
        .from(schema.patients)
        .where(eq(schema.patients.phoneNumber, patient.phoneNumber));
      
      // Get IDs of all related patients
      const relatedPatientIds = relatedPatients.map(p => p.id);
      
      console.log(`Including transactions from related patients: ${relatedPatientIds.join(', ')}`);
      
      // Get transactions from all these patients including all fields and items
      const transactions = await db.select({
          id: schema.transactions.id,
          transactionId: schema.transactions.transactionId,
          patientId: schema.transactions.patientId,
          totalAmount: schema.transactions.totalAmount,
          discount: schema.transactions.discount,
          subtotal: schema.transactions.subtotal,
          paymentMethod: schema.transactions.paymentMethod,
          items: schema.transactions.items, // Pastikan items (JSON) diambil
          creditAmount: schema.transactions.creditAmount,
          isPaid: schema.transactions.isPaid,
          paidAmount: schema.transactions.paidAmount,
          debtAmount: schema.transactions.debtAmount,
          createdAt: schema.transactions.createdAt
        })
        .from(schema.transactions)
        .where(inArray(schema.transactions.patientId, relatedPatientIds))
        .orderBy(desc(schema.transactions.createdAt));
      
      // Process items
      const processedTransactions = transactions.map(transaction => {
        // Parse items jika berbentuk string
        if (transaction.items && typeof transaction.items === 'string') {
          try {
            transaction.items = JSON.parse(transaction.items);
          } catch (parseError) {
            console.error(`Error parsing items for transaction ${transaction.id}:`, parseError);
          }
        }
        
        return transaction;
      });
        
      // Tambahkan informasi pasien secara manual
      const transactionsWithPatientInfo = await Promise.all(
        processedTransactions.map(async (transaction) => {
          const patient = await db.query.patients.findFirst({
            where: eq(schema.patients.id, transaction.patientId)
          });
          
          return {
            ...transaction,
            patient
          };
        })
      );
      
      return transactionsWithPatientInfo;
    } catch (error) {
      console.error(`Error getting transactions for patient ${patientId}:`, error);
      // Return empty array if error occurs instead of failing the entire operation
      return [];
    }
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    try {
      console.log("Database Storage: Creating transaction with data:", transaction);
      
      // Pastikan semua field memiliki nilai default yang tepat
      const totalAmount = parseFloat(transaction.totalAmount || "0");
      const paidAmount = parseFloat(transaction.paidAmount || (transaction.isPaid ? transaction.totalAmount : "0"));
      
      // Hitung debtAmount (sisa utang) berdasarkan totalAmount dan paidAmount
      const debtAmount = Math.max(0, totalAmount - paidAmount);
      
      const transactionData = {
        ...transaction,
        discount: transaction.discount || "0",
        subtotal: transaction.subtotal || transaction.totalAmount || "0",
        creditAmount: transaction.creditAmount || "0",
        isPaid: transaction.isPaid !== undefined ? transaction.isPaid : true,
        paidAmount: paidAmount.toString(),
        debtAmount: debtAmount.toString()
      };
      
      // Generate transaction ID dengan menggunakan waktu WIB
      const wibDate = getWIBDate(new Date());
      const transactionId = `T-${format(wibDate, 'yyyyMMdd')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      
      console.log("Database Storage: Processing transaction with data:", transactionData);
      
      // Semua transaksi baru akan disimpan dengan createdAt yang sudah disesuaikan ke WIB
      const result = await db.insert(schema.transactions)
        .values({ 
          ...transactionData, 
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
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }
  
  // Fungsi untuk mendapatkan daftar utang semua pasien
  async getUnpaidTransactions(): Promise<Transaction[]> {
    try {
      // Dapatkan semua transaksi dengan isPaid = false, secara eksplisit pilih semua kolom
      const unpaidTransactions = await db
        .select({
          id: schema.transactions.id,
          transactionId: schema.transactions.transactionId,
          patientId: schema.transactions.patientId,
          totalAmount: schema.transactions.totalAmount,
          discount: schema.transactions.discount,
          subtotal: schema.transactions.subtotal,
          paymentMethod: schema.transactions.paymentMethod,
          items: schema.transactions.items, // Pastikan items (JSON) diambil
          creditAmount: schema.transactions.creditAmount,
          isPaid: schema.transactions.isPaid,
          paidAmount: schema.transactions.paidAmount,
          debtAmount: schema.transactions.debtAmount,
          createdAt: schema.transactions.createdAt
        })
        .from(schema.transactions)
        .where(eq(schema.transactions.isPaid, false))
        .orderBy(desc(schema.transactions.createdAt));
      
      // Filter transaksi yang benar-benar masih memiliki utang berdasarkan debtAmount
      const realUnpaidTransactions = unpaidTransactions.filter(trans => {
        const debtAmount = parseFloat(trans.debtAmount || "0");
        return debtAmount > 0; // Hanya tampilkan jika debtAmount > 0
      });
      
      // Proses items jika perlu dan ubah format date
      return realUnpaidTransactions.map(trans => {
        // Parse items jika berbentuk string
        if (trans.items && typeof trans.items === 'string') {
          try {
            trans.items = JSON.parse(trans.items);
          } catch (parseError) {
            console.error(`Error parsing items for transaction ${trans.id}:`, parseError);
          }
        }
        
        return {
          ...trans,
          createdAt: getWIBDate(trans.createdAt)
        };
      });
    } catch (error) {
      console.error('Error getting unpaid transactions:', error);
      throw error;
    }
  }
  
  // Fungsi untuk mendapatkan daftar utang pasien tertentu
  async getUnpaidTransactionsByPatient(patientId: number): Promise<Transaction[]> {
    try {
      // Dapatkan semua transaksi pasien dengan isPaid = false, secara eksplisit pilih semua kolom
      const unpaidTransactions = await db
        .select({
          id: schema.transactions.id,
          transactionId: schema.transactions.transactionId,
          patientId: schema.transactions.patientId,
          totalAmount: schema.transactions.totalAmount,
          discount: schema.transactions.discount,
          subtotal: schema.transactions.subtotal,
          paymentMethod: schema.transactions.paymentMethod,
          items: schema.transactions.items, // Pastikan items (JSON) diambil
          creditAmount: schema.transactions.creditAmount,
          isPaid: schema.transactions.isPaid,
          paidAmount: schema.transactions.paidAmount,
          debtAmount: schema.transactions.debtAmount,
          createdAt: schema.transactions.createdAt
        })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.patientId, patientId),
            eq(schema.transactions.isPaid, false)
          )
        )
        .orderBy(desc(schema.transactions.createdAt));
      
      // Filter transaksi yang benar-benar masih memiliki utang berdasarkan debtAmount
      const realUnpaidTransactions = unpaidTransactions.filter(trans => {
        const debtAmount = parseFloat(trans.debtAmount || "0");
        return debtAmount > 0; // Hanya tampilkan jika debtAmount > 0
      });
      
      // Proses items jika perlu dan ubah format date
      return realUnpaidTransactions.map(trans => {
        // Parse items jika berbentuk string
        if (trans.items && typeof trans.items === 'string') {
          try {
            trans.items = JSON.parse(trans.items);
          } catch (parseError) {
            console.error(`Error parsing items for transaction ${trans.id}:`, parseError);
          }
        }
        
        return {
          ...trans,
          createdAt: getWIBDate(trans.createdAt)
        };
      });
    } catch (error) {
      console.error(`Error getting unpaid transactions for patient ${patientId}:`, error);
      throw error;
    }
  }
  
  // Fungsi untuk membuat pembayaran utang
  async createDebtPayment(debtPayment: schema.InsertDebtPayment): Promise<schema.DebtPayment> {
    try {
      // Pastikan paymentDate selalu menggunakan waktu WIB
      const wibDate = getWIBDate(new Date());
      
      const [newPayment] = await db
        .insert(schema.debtPayments)
        .values({
          ...debtPayment,
          paymentDate: wibDate,
          createdAt: wibDate
        })
        .returning();
      
      // Update transaction paid status jika perlu
      await this.updateTransactionPaidStatus(debtPayment.transactionId);
      
      return {
        ...newPayment,
        paymentDate: getWIBDate(newPayment.paymentDate),
        createdAt: getWIBDate(newPayment.createdAt)
      };
    } catch (error) {
      console.error('Error creating debt payment:', error);
      throw error;
    }
  }
  
  // Fungsi untuk mendapatkan semua pembayaran utang untuk transaksi tertentu
  async getDebtPaymentsByTransaction(transactionId: number): Promise<schema.DebtPayment[]> {
    try {
      const payments = await db
        .select()
        .from(schema.debtPayments)
        .where(eq(schema.debtPayments.transactionId, transactionId))
        .orderBy(desc(schema.debtPayments.paymentDate));
        
      return payments.map(payment => ({
        ...payment,
        paymentDate: getWIBDate(payment.paymentDate),
        createdAt: getWIBDate(payment.createdAt)
      }));
    } catch (error) {
      console.error(`Error getting debt payments for transaction ${transactionId}:`, error);
      throw error;
    }
  }
  
  // Fungsi untuk mengupdate data transaksi secara umum
  async updateTransaction(id: number, transactionData: Partial<schema.Transaction>): Promise<schema.Transaction | undefined> {
    try {
      // Dapatkan transaksi saat ini
      const currentTransaction = await this.getTransaction(id);
      if (!currentTransaction) {
        return undefined;
      }
      
      // Jika paidAmount ada dalam data yang dikirim, perbarui debtAmount dan isPaid
      if (transactionData.paidAmount !== undefined) {
        const paidAmount = parseFloat(transactionData.paidAmount);
        const totalAmount = parseFloat(currentTransaction.totalAmount);
        
        // Hitung debtAmount (sisa utang) berdasarkan totalAmount dan paidAmount yang baru
        const debtAmount = Math.max(0, totalAmount - paidAmount);
        transactionData.debtAmount = debtAmount.toString();
        
        // Jika pembayaran sudah sama atau lebih dari total, maka tandai sebagai lunas
        if (paidAmount >= totalAmount) {
          transactionData.isPaid = true;
          console.log(`Marking transaction ${id} as paid because paidAmount ${paidAmount} >= totalAmount ${totalAmount}`);
        }
      }
      
      const [updatedTransaction] = await db
        .update(schema.transactions)
        .set(transactionData)
        .where(eq(schema.transactions.id, id))
        .returning();
      
      if (!updatedTransaction) {
        return undefined;
      }
      
      return {
        ...updatedTransaction,
        createdAt: getWIBDate(updatedTransaction.createdAt)
      };
    } catch (error) {
      console.error(`Error updating transaction ${id}:`, error);
      return undefined;
    }
  }

  // Fungsi untuk mengupdate status pembayaran transaksi
  async updateTransactionPaidStatus(transactionId: number): Promise<Transaction | undefined> {
    try {
      // Dapatkan transaksi dan total pembayaran
      const transaction = await this.getTransaction(transactionId);
      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }
      
      // Ambil pembayaran awal
      const initialPayment = parseFloat(transaction.paidAmount.toString());
      
      // Ambil pembayaran tambahan dari tabel debt_payments
      const payments = await this.getDebtPaymentsByTransaction(transactionId);
      
      // Hitung total pembayaran dari tabel debt_payments saja
      const debtPaymentsTotal = payments.reduce(
        (sum, payment) => sum + parseFloat(payment.amount.toString()), 
        0  // Mulai dari 0, tidak menambahkan transaction.paidAmount
      );
      
      // Total pembayaran: pembayaran awal + pembayaran hutang
      const totalPaid = initialPayment + debtPaymentsTotal;
      
      // Periksa apakah total pembayaran sudah mencapai atau melebihi total transaksi
      const totalAmount = parseFloat(transaction.totalAmount.toString());
      const isPaid = totalPaid >= totalAmount;
      
      // Hitung jumlah hutang yang tersisa
      const debtAmount = Math.max(0, totalAmount - totalPaid);
      
      console.log(`[Debt Payment] TransactionID: ${transactionId}, Initial Payment: ${initialPayment}, Debt Payments: ${debtPaymentsTotal}, Total: ${totalPaid}, Required: ${totalAmount}, Remaining Debt: ${debtAmount}`);
      
      // Update status pembayaran dan jumlah hutang
      return this.updateTransaction(transactionId, {
        isPaid,
        paidAmount: totalPaid.toString(),
        debtAmount: debtAmount.toString()
      });
    } catch (error) {
      console.error(`Error updating paid status for transaction ${transactionId}:`, error);
      throw error;
    }
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
        // Cek apakah ada item dengan jenis "debt-payment"
        const isDebtPayment = items.some(
          item => item.type === "debt-payment" && item.description && 
          typeof item.description === 'string' && item.description.includes("Pembayaran utang untuk transaksi")
        );
        
        if (isDebtPayment) {
          // Jika transaksi ini adalah pembayaran utang, ekstrak ID transaksi asli dari deskripsi
          for (const item of items) {
            if (item.type === "debt-payment" && item.description) {
              const description = item.description as string;
              const originalTransactionIdMatch = description.match(/Pembayaran utang untuk transaksi (T-[0-9]+-[0-9]+)/);
              
              if (originalTransactionIdMatch && originalTransactionIdMatch[1]) {
                const originalTransactionId = originalTransactionIdMatch[1];
                
                // Cari transaksi asli berdasarkan transactionId (bukan ID)
                const originalTransaction = await db.query.transactions.findFirst({
                  where: eq(schema.transactions.transactionId, originalTransactionId)
                });
                
                if (originalTransaction) {
                  console.log(`Mengembalikan status transaksi asli ${originalTransactionId} ke belum lunas.`);
                  
                  // Hapus data pembayaran utang dari tabel debt_payments
                  await db.delete(schema.debtPayments)
                    .where(eq(schema.debtPayments.transactionId, originalTransaction.id));
                    
                  // Perbarui status pembayaran dan hutang pada transaksi asli
                  await this.updateTransactionPaidStatus(originalTransaction.id);
                }
              }
            }
          }
        }
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
        } else if (!isDebtPayment) {
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
    
    if (!result) return undefined;
    
    // Untuk memastikan kuota appointment yang akurat,
    // ambil jumlah appointment aktif yang terkait dengan slot
    const appointments = await this.getAppointmentsByTherapySlot(id);
    
    // Hitung appointment yang tidak dibatalkan saja
    const activeCount = appointments.filter(app => app.status !== 'Cancelled').length;
    
    // Return hasil dengan currentCount diperbarui berdasarkan jumlah appointment aktif
    return {
      ...result,
      currentCount: activeCount
    };
  }

  async getTherapySlotsByDate(date: Date | string): Promise<TherapySlot[]> {
    // Menggunakan fungsi getWIBDate untuk mendapatkan tanggal dalam zona waktu WIB secara konsisten
    let dateString: string;
    
    try {
      // Konversi input ke Date object terlebih dahulu
      let dateObj: Date;
      
      if (date instanceof Date) {
        dateObj = date;
        console.log("Input date untuk getTherapySlotsByDate: Date object -", dateObj.toISOString());
      } else {
        // Parse string menjadi Date
        dateObj = new Date(date);
        
        if (isNaN(dateObj.getTime())) {
          // Jika parsing gagal, gunakan tanggal hari ini
          console.error("Invalid date string, using today's date:", date);
          dateObj = new Date();
        }
        console.log("Input date untuk getTherapySlotsByDate: String -", date, "-> Date object:", dateObj.toISOString());
      }
      
      // Konversi ke WIB menggunakan fungsi helper yang konsisten
      const wibDate = getWIBDate(dateObj);
      
      // Format tanggal ke format YYYY-MM-DD untuk pencarian di database
      const year = wibDate.getFullYear();
      const month = String(wibDate.getMonth() + 1).padStart(2, '0');
      const day = String(wibDate.getDate()).padStart(2, '0');
      dateString = `${year}-${month}-${day}`;
      
      console.log(`Tanggal WIB yang digunakan: ${dateString}`);
    } catch (error) {
      // Jika terjadi error, gunakan tanggal hari ini
      console.error("Error processing date, using today's date:", error);
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      dateString = `${year}-${month}-${day}`;
    }
    
    console.log("Mencari slot terapi dengan date text:", dateString);
    
    // Gunakan fungsi query di Drizzle ORM untuk filter berdasarkan string date 
    // karena kita mengubah kolom date dari timestamp menjadi text
    const slots = await db.query.therapySlots.findMany({
      where: and(
        eq(schema.therapySlots.date, dateString),
        eq(schema.therapySlots.isActive, true)
      ),
      orderBy: [asc(schema.therapySlots.timeSlot)]
    });
    
    // Untuk setiap slot, perbarui currentCount berdasarkan jumlah appointment yang benar-benar aktif
    for (const slot of slots) {
      try {
        // Ambil semua appointment untuk slot ini
        const allAppointments = await db.query.appointments.findMany({
          where: eq(schema.appointments.therapySlotId, slot.id)
        });
        
        console.log(`Slot ${slot.id} (${slot.timeSlot}): ditemukan ${allAppointments.length} appointment total`);
        
        // Definisikan status yang dihitung sebagai "aktif" untuk keperluan perhitungan kuota
        const isActiveStatus = (s: string) => 
          s === 'Active' || s === 'Booked' || s === 'Confirmed' || s === 'Scheduled';
        
        // Filter hanya appointment dengan status aktif
        const activeAppointments = allAppointments.filter(app => isActiveStatus(app.status));
        
        // Buat log detail untuk mempermudah debugging
        if (activeAppointments.length > 0) {
          console.log(`Detail appointment aktif untuk slot ${slot.id}:`, 
            activeAppointments.map(app => ({id: app.id, status: app.status}))
          );
        }
        
        console.log(`Slot ${slot.id}: ${activeAppointments.length} appointment aktif dari ${allAppointments.length} total`);
        
        // Perbarui currentCount dengan jumlah appointment aktif
        slot.currentCount = activeAppointments.length;
      } catch (error) {
        console.error(`Error saat memproses slot ${slot.id}:`, error);
        // Tetap gunakan nilai currentCount yang ada di database jika terjadi error
      }
    }
    
    console.log(`Ditemukan ${slots.length} slot terapi untuk hari ini`);
    
    return slots;
  }

  async getAllTherapySlots(): Promise<TherapySlot[]> {
    const slots = await db.query.therapySlots.findMany({
      orderBy: [asc(schema.therapySlots.date), asc(schema.therapySlots.timeSlot)]
    });
    
    // Untuk setiap slot, ambil jumlah appointment aktif yang terkait
    // dan gunakan itu sebagai currentCount yang akurat
    for (const slot of slots) {
      // Ambil semua appointment untuk slot ini
      const allAppointments = await db.query.appointments.findMany({
        where: eq(schema.appointments.therapySlotId, slot.id)
      });
      
      // Filter hanya appointment dengan status aktif
      const activeStatuses = ['Active', 'Booked', 'Confirmed', 'Scheduled'];
      const activeAppointments = allAppointments.filter(app => activeStatuses.includes(app.status));
      
      // Update currentCount langsung di objek slot yang dikembalikan
      slot.currentCount = activeAppointments.length;
    }
    
    return slots;
  }

  async getActiveTherapySlots(): Promise<TherapySlot[]> {
    // Perbaikan: mendapatkan semua slot terapi aktif, termasuk hari ini dan yang akan datang
    const today = new Date();
    
    // Konversi date ke string format YYYY-MM-DD
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    console.log("Mencari slot terapi aktif mulai dari:", todayStr);
    
    // Ambil semua slot terapi yang aktif
    const slots = await db.query.therapySlots.findMany({
      where: eq(schema.therapySlots.isActive, true),
      orderBy: [asc(schema.therapySlots.date), asc(schema.therapySlots.timeSlot)]
    });
    
    // Untuk setiap slot, perbarui currentCount dengan jumlah appointment aktif
    for (const slot of slots) {
      try {
        // Dapatkan semua appointment untuk slot ini
        const allAppointments = await db.query.appointments.findMany({
          where: eq(schema.appointments.therapySlotId, slot.id)
        });
        
        // Definisikan status apa saja yang dianggap aktif (sama seperti di getTherapySlotsByDate)
        const activeStatuses = ['Active', 'Booked', 'Confirmed', 'Scheduled'];
        
        // Buat fungsi helper untuk check status aktif
        const isActiveStatus = (s: string) => activeStatuses.includes(s);
        
        // Filter hanya appointment dengan status aktif
        const activeAppointments = allAppointments.filter(app => isActiveStatus(app.status));
        
        // Log detail untuk membantu debugging
        if (activeAppointments.length > 0) {
          console.log(`Detail appointment aktif untuk slot ${slot.id}:`, 
            activeAppointments.map(app => ({id: app.id, status: app.status}))
          );
        }
        
        // Update currentCount langsung di objek slot yang dikembalikan
        slot.currentCount = activeAppointments.length;
        
        // Log jumlah appointment untuk slot ini
        console.log(`Slot ${slot.id} (${slot.timeSlot} ${slot.date}): ${activeAppointments.length} active appointments dari ${allAppointments.length} total`);
      } catch (error) {
        console.error(`Error saat memproses slot ${slot.id}:`, error);
        // Jika terjadi error, biarkan currentCount seperti apa adanya
      }
    }
    
    return slots; // Kembalikan semua slot yang aktif tanpa filter tanggal
  }
  
  /**
   * Fungsi untuk menyinkronkan kuota slot terapi di database dengan jumlah appointment aktual
   */
  async syncTherapySlotQuota(): Promise<{ updatedSlots: number, results: any[] }> {
    try {
      // Dapatkan semua slot terapi
      const allSlots = await db.query.therapySlots.findMany({
        orderBy: [asc(schema.therapySlots.date), asc(schema.therapySlots.timeSlot)]
      });
      
      const results = [];
      let updatedCount = 0;
      
      console.log(`Mulai sinkronisasi ${allSlots.length} slot terapi...`);
      
      // Untuk setiap slot, hitung ulang kuota berdasarkan jumlah appointment aktif
      for (const slot of allSlots) {
        try {
          // Dapatkan semua appointment untuk slot terapi ini
          const allAppointmentsForSlot = await db.query.appointments.findMany({
            where: eq(schema.appointments.therapySlotId, slot.id)
          });
          
          // Log semua appointment yang ditemukan untuk slot ini
          console.log(`Slot ${slot.id} (${slot.date} ${slot.timeSlot}): ${allAppointmentsForSlot.length} total appointments`);
          console.log(`Detail appointments:`, allAppointmentsForSlot.map(a => ({ id: a.id, status: a.status })));
          
          // Filter hanya appointment aktif (dengan status yang spesifik)
          const activeStatuses = ['Active', 'Booked', 'Confirmed', 'Scheduled'];
          const activeAppointments = allAppointmentsForSlot.filter(app => {
            // Status yang dibatalkan (Cancelled) secara eksplisit dikeluarkan
            if (app.status === 'Cancelled' || app.status === 'Completed') {
              return false;
            }
            
            // Hanya sertakan status yang ada di daftar status aktif
            return activeStatuses.includes(app.status);
          });
          
          const activeCount = activeAppointments.length;
          console.log(`Slot ${slot.id}: ${activeCount} active appointments, current count in DB: ${slot.currentCount}`);
          
          // Jika nilai di database berbeda, update
          if (slot.currentCount !== activeCount) {
            console.log(`Sinkronisasi slot ${slot.id}: mengubah currentCount dari ${slot.currentCount} menjadi ${activeCount}`);
            
            const updatedSlot = await db
              .update(schema.therapySlots)
              .set({ currentCount: activeCount })
              .where(eq(schema.therapySlots.id, slot.id))
              .returning();
            
            if (updatedSlot.length > 0) {
              let formattedDate;
              try {
                // Gunakan metode yang sama dengan getWIBDate untuk format tanggal yang konsisten
                const originalDate = new Date(slot.date);
                const correctedDate = new Date(originalDate.getTime() - (14 * 60 * 60 * 1000));
                const wibDate = new Date(correctedDate.getTime() + (7 * 60 * 60 * 1000));
                formattedDate = format(wibDate, 'dd MMMM yyyy');
              } catch (error) {
                console.error(`Error formatting date for slot ${slot.id}:`, error);
                formattedDate = String(slot.date);
              }
              
              results.push({
                slotId: slot.id,
                date: formattedDate,
                timeSlot: slot.timeSlot,
                oldCount: slot.currentCount,
                newCount: activeCount
              });
              updatedCount++;
            }
          }
        } catch (slotError) {
          console.error(`Error processing slot ${slot.id}:`, slotError);
          // Lanjutkan ke slot berikutnya meski ada error
        }
      }
      
      console.log(`Sinkronisasi selesai. ${updatedCount} slot diperbarui.`);
      return { updatedSlots: updatedCount, results };
    } catch (error) {
      console.error("Error in syncTherapySlotQuota:", error);
      throw error;
    }
  }

  async createTherapySlot(slot: InsertTherapySlot): Promise<TherapySlot> {
    try {
      // Pastikan jika date adalah string, gunakan string tersebut
      // Ini untuk mencegah error "value.toISOString is not a function"
      if (typeof slot.date === 'string') {
        console.log(`Creating therapy slot with string date: ${slot.date}`);
        
        // Pastikan format tanggal dalam bentuk yang benar (YYYY-MM-DD)
        let dateString = slot.date;
        // Jika slot.date dalam format lain (misalnya DD-MM-YYYY), konversi ke YYYY-MM-DD
        if (slot.date.includes('/') || slot.date.includes('-') && slot.date.split('-')[0].length !== 4) {
          const parts = slot.date.split(/[-\/]/);
          if (parts.length === 3) {
            // Asumsi format DD-MM-YYYY atau DD/MM/YYYY
            if (parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
              dateString = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              console.log(`Converted date format from ${slot.date} to ${dateString}`);
            }
          }
        }
        
        // Jalankan query dengan nilai yang sudah divalidasi
        const result = await db.insert(schema.therapySlots).values({
          ...slot,
          date: dateString
        }).returning();
        
        return result[0];
      } else {
        // Jika date adalah objek Date, konversi ke string ISO
        const dateObj = slot.date as unknown as Date;
        const isoString = dateObj.toISOString().split('T')[0];
        console.log(`Creating therapy slot with Date object, converted to ISO string: ${isoString}`);
        
        const result = await db.insert(schema.therapySlots).values({
          ...slot,
          date: isoString
        }).returning();
        
        return result[0];
      }
    } catch (error) {
      console.error(`Error in createTherapySlot: ${error}`);
      console.error(`Slot data: ${JSON.stringify(slot)}`);
      throw error;
    }
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
    
    // Dapatkan jumlah appointment dari hasil getTherapySlot yang sudah diperbarui
    // yang termasuk perhitungan aktual berdasarkan appointment aktif
    const actualCount = currentSlot.currentCount;
    
    const result = await db
      .update(schema.therapySlots)
      .set({ 
        currentCount: actualCount + 1
      })
      .where(eq(schema.therapySlots.id, id))
      .returning();
    return result[0];
  }

  async decrementTherapySlotUsage(id: number): Promise<TherapySlot | undefined> {
    // Get current slot to decrement count
    const currentSlot = await this.getTherapySlot(id);
    if (!currentSlot || currentSlot.currentCount <= 0) return undefined;
    
    // Dapatkan jumlah appointment dari hasil getTherapySlot yang sudah diperbarui
    // yang termasuk perhitungan aktual berdasarkan appointment aktif
    const actualCount = currentSlot.currentCount;
    
    // Hanya kurangi jika nilai lebih dari 0
    const newCount = Math.max(0, actualCount - 1);
    
    const result = await db
      .update(schema.therapySlots)
      .set({ 
        currentCount: newCount
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
    // Cari appointment berdasarkan ID
    const appointment = await db.query.appointments.findFirst({
      where: eq(schema.appointments.id, id)
    });
    
    if (!appointment) return undefined;
    
    // Dapatkan data pasien terkait
    if (appointment.patientId) {
      const patient = await this.getPatient(appointment.patientId);
      
      // Gabungkan data appointment dengan data pasien
      return {
        ...appointment,
        patient: patient
      };
    }
    
    return appointment;
  }

  async getAllAppointments(): Promise<Appointment[]> {
    const appointments = await db.query.appointments.findMany({
      orderBy: [desc(schema.appointments.date)]
    });
    
    // Tambahkan informasi pasien ke setiap appointment
    const appointmentsWithPatients = await Promise.all(
      appointments.map(async (appointment) => {
        if (appointment.patientId) {
          const patient = await this.getPatient(appointment.patientId);
          if (patient) {
            return {
              ...appointment,
              patient
            };
          }
        }
        return appointment;
      })
    );
    
    return appointmentsWithPatients;
  }

  async getAppointmentsByDate(date: Date | string): Promise<Appointment[]> {
    // Ekstrak tanggal dalam format YYYY-MM-DD
    let dateStr: string;
    
    if (typeof date === 'string') {
      dateStr = date;
    } else if (date instanceof Date) {
      dateStr = date.toISOString().split('T')[0];
    } else {
      // Fallback ke hari ini
      dateStr = new Date().toISOString().split('T')[0];
    }
    
    console.log(`Fetching appointments for date: ${dateStr}`);
    
    // Query berdasarkan string date, tanpa perlu konversi ke Date object
    const appointments = await db.query.appointments.findMany({
      where: and(
        eq(schema.appointments.date, dateStr),
        not(eq(schema.appointments.status, "Cancelled")) // Filter out cancelled appointments
      )
    });
    
    console.log(`Found ${appointments.length} appointments for date ${dateStr}`);
    
    // Tambahkan data pasien ke setiap janji temu
    const appointmentsWithPatients = await Promise.all(
      appointments.map(async (appointment) => {
        if (appointment.patientId) {
          const patient = await this.getPatient(appointment.patientId);
          return {
            ...appointment,
            patient: patient
          };
        }
        return appointment;
      })
    );
    
    return appointmentsWithPatients;
  }

  async getAppointmentsByPatient(patientId: number): Promise<Appointment[]> {
    const appointments = await db.query.appointments.findMany({
      where: eq(schema.appointments.patientId, patientId),
      orderBy: [desc(schema.appointments.date)]
    });
    
    // Dapatkan informasi pasien sekali saja
    const patient = await this.getPatient(patientId);
    
    // Tambahkan informasi pasien ke setiap appointment
    if (patient) {
      return appointments.map(appointment => ({
        ...appointment,
        patient
      }));
    }
    
    return appointments;
  }

  async getAppointmentsByTherapySlot(therapySlotId: number): Promise<Appointment[]> {
    try {
      // Ambil semua appointment untuk slot terapi ini
      const allAppointmentsForSlot = await db.query.appointments.findMany({
        where: eq(schema.appointments.therapySlotId, therapySlotId)
      });
      
      // Selalu log untuk debugging
      console.log(`All appointments for slot ${therapySlotId}:`, 
        allAppointmentsForSlot.map(a => ({id: a.id, status: a.status}))
      );
      
      // Filter semua status yang aktif (tidak dibatalkan dan dalam status valid)
      // Gunakan status fixed yang jelas, tanpa partial matching
      const activeStatuses = ['Active', 'Booked', 'Confirmed', 'Scheduled'];
      const nonCancelledAppointments = allAppointmentsForSlot.filter(app => {
        // Status yang dibatalkan (Cancelled) secara eksplisit dikeluarkan
        if (app.status === 'Cancelled' || app.status === 'Completed') {
          return false;
        }
        
        // Periksa apakah status termasuk dalam daftar status aktif (exact match)
        const isActiveStatus = activeStatuses.includes(app.status);
        
        // Debug - Tambahkan log untuk mempermudah pelacakan
        console.log(`Appointment ${app.id} (${app.status}): isActiveStatus=${isActiveStatus}`);
        
        return isActiveStatus;
      });
      
      // Selalu log untuk debugging
      console.log(`Non-cancelled appointments for slot ${therapySlotId}:`, 
        nonCancelledAppointments.map(a => ({id: a.id, status: a.status}))
      );
      
      // Tambahkan data pasien untuk setiap appointment
      const appointmentsWithPatients = await Promise.all(
        nonCancelledAppointments.map(async (appointment) => {
          if (appointment.patientId) {
            const patient = await this.getPatient(appointment.patientId);
            if (patient) {
              return {
                ...appointment,
                patient
              };
            }
          }
          return appointment;
        })
      );
      
      return appointmentsWithPatients;
    } catch (error) {
      console.error(`Error in getAppointmentsByTherapySlot for slot ${therapySlotId}:`, error);
      // Kembalikan array kosong jika terjadi error
      return [];
    }
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    // Generate registration number with WIB time if not provided
    const currentWibDate = getWIBDate(new Date());
    let regNum = appointment.registrationNumber;
    
    if (!regNum) {
      regNum = `R-${format(currentWibDate, 'yyyyMMdd')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    }
    
    // PENTING: Gunakan tanggal appointment yang disediakan, atau fallback ke waktu saat ini
    // Ini mencegah inconsistensi data antara slot terapi dan appointment
    let appointmentDate = appointment.date;
    let therapySlot: TherapySlot | undefined = undefined;
    
    // Jika therapySlotId disediakan, gunakan tanggal dari therapy slot untuk konsistensi
    if (appointment.therapySlotId) {
      therapySlot = await this.getTherapySlot(appointment.therapySlotId);
      if (therapySlot) {
        // Sudah dipastikan therapySlot.date adalah string
        appointmentDate = therapySlot.date;
        console.log(`[APPOINTMENT] Using therapy slot date: ${appointmentDate} for new appointment`);
        
        // Verifikasi apakah slot memiliki kapasitas
        const currentUsage = therapySlot.currentCount || 0;
        const maxCapacity = therapySlot.maxQuota || 6;
        if (currentUsage >= maxCapacity) {
          console.warn(`[WARNING] Therapy slot ${therapySlot.id} already at maximum capacity (${currentUsage}/${maxCapacity})`);
          // Tetap lanjutkan, tetapi berikan peringatan
        }
      }
    }
    
    // Konversi appointmentDate ke string jika masih berupa Date
    let dateStr = typeof appointmentDate === 'string' 
      ? appointmentDate 
      : appointmentDate instanceof Date 
        ? format(appointmentDate, 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd'); // Fallback ke hari ini jika tidak ada
    
    // Log untuk debugging
    console.log(`[APPOINTMENT] Creating appointment with date: ${dateStr} (${typeof dateStr})`);
    
    // Status default harus "Active" jika tidak disediakan
    const status = appointment.status || 'Active';
    
    // Pastikan date menggunakan zona waktu WIB untuk konsistensi
    const result = await db.insert(schema.appointments)
      .values({
        patientId: appointment.patientId,
        sessionId: appointment.sessionId,
        therapySlotId: appointment.therapySlotId,
        date: dateStr, // Gunakan string untuk format tanggal
        timeSlot: appointment.timeSlot,
        notes: appointment.notes,
        status: status, // Gunakan status yang sudah diatur
        registrationNumber: regNum
      })
      .returning();
    
    const newAppointment = result[0];
    
    // Increment therapy slot usage jika status adalah active dan therapySlotId disediakan
    if (newAppointment.therapySlotId && 
        (status === 'Active' || status === 'Booked' || status === 'Confirmed' || status === 'Scheduled')) {
      console.log(`[APPOINTMENT] Incrementing usage for therapy slot ${newAppointment.therapySlotId}`);
      await this.incrementTherapySlotUsage(newAppointment.therapySlotId);
    }
    
    // Tidak perlu lagi konversi date karena sudah disimpan sebagai string
    return newAppointment;
  }
  
  /**
   * Memperbaiki ketidakkonsistenan antara tanggal appointment dan tanggal therapy slot
   */
  async resyncAppointmentDates(): Promise<{ fixed: number, errors: any[] }> {
    try {
      // Mengambil semua appointment dengan status scheduled
      const activeAppointments = await db.query.appointments.findMany({
        where: eq(schema.appointments.status, "Scheduled")
      });
      
      console.log(`Found ${activeAppointments.length} scheduled appointments to check for date consistency`);
      
      let fixedCount = 0;
      const errors = [];
      
      // Memeriksa dan memperbaiki setiap appointment
      for (const appointment of activeAppointments) {
        try {
          // Hanya proses appointment yang memiliki therapySlotId
          if (appointment.therapySlotId) {
            const therapySlot = await this.getTherapySlot(appointment.therapySlotId);
            
            if (therapySlot) {
              // Sekarang, appointment.date dan therapySlot.date sudah dalam bentuk string
              // Kita bisa membandingkannya langsung
              const appointmentDate = typeof appointment.date === 'string' 
                ? appointment.date 
                : new Date(appointment.date).toISOString().split('T')[0];
                
              const therapySlotDate = therapySlot.date;
              
              if (appointmentDate !== therapySlotDate) {
                console.log(`Fixing appointment ${appointment.id}: changing date from ${appointmentDate} to ${therapySlotDate}`);
                
                // Perbarui tanggal appointment agar sesuai dengan tanggal therapy slot
                await db.update(schema.appointments)
                  .set({ date: therapySlotDate })
                  .where(eq(schema.appointments.id, appointment.id));
                
                fixedCount++;
              }
            }
          }
        } catch (error) {
          console.error(`Error fixing appointment ${appointment.id}:`, error);
          errors.push({ 
            appointmentId: appointment.id, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
      
      return { fixed: fixedCount, errors };
    } catch (error) {
      console.error("Error in resyncAppointmentDates:", error);
      return { 
        fixed: 0, 
        errors: [error instanceof Error ? error.message : String(error)] 
      };
    }
  }

  async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
    // Dapatkan data janji temu sebelumnya untuk membandingkan status
    const existingAppointment = await db.query.appointments.findFirst({
      where: eq(schema.appointments.id, id)
    });
    
    if (!existingAppointment) {
      return undefined;
    }
    
    // Definisikan status yang dihitung sebagai "aktif" untuk keperluan perhitungan kuota
    const isActiveStatus = (s: string) => 
      s === 'Active' || s === 'Booked' || s === 'Confirmed' || s === 'Scheduled';
    
    // Cek status sebelum dan sesudah perubahan
    const wasActive = isActiveStatus(existingAppointment.status);
    const willBeActive = isActiveStatus(status);
    
    console.log(`[STATUS UPDATE] Appointment ${id}: ${existingAppointment.status} -> ${status}, wasActive=${wasActive}, willBeActive=${willBeActive}`);
    
    // Proses perubahan kuota slot terapi
    if (existingAppointment.therapySlotId) {
      // Jika status berubah dari aktif ke tidak aktif, kurangi kuota
      if (wasActive && !willBeActive) {
        await this.decrementTherapySlotUsage(existingAppointment.therapySlotId);
        console.log(`[STATUS UPDATE] Mengurangi kuota untuk slot terapi ID ${existingAppointment.therapySlotId} karena janji temu dibatalkan/selesai`);
      } 
      // Jika status berubah dari tidak aktif ke aktif, tambahkan kuota
      else if (!wasActive && willBeActive) {
        await this.incrementTherapySlotUsage(existingAppointment.therapySlotId);
        console.log(`[STATUS UPDATE] Menambah kuota untuk slot terapi ID ${existingAppointment.therapySlotId} karena janji temu diaktifkan`);
      }
      // Jika tidak ada perubahan jenis status (aktif->aktif atau tidak aktif->tidak aktif), tidak ada perubahan kuota
      else {
        console.log(`[STATUS UPDATE] Tidak ada perubahan kuota untuk slot terapi ID ${existingAppointment.therapySlotId} (${wasActive ? 'tetap aktif' : 'tetap tidak aktif'})`);
      }
    }
    
    // Update status janji temu
    const result = await db
      .update(schema.appointments)
      .set({ status })
      .where(eq(schema.appointments.id, id))
      .returning();
    
    if (result[0] && result[0].patientId) {
      // Ambil data pasien
      const patient = await this.getPatient(result[0].patientId);
      if (patient) {
        return {
          ...result[0],
          patient
        };
      }
    }
      
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
    
    // Count patients with appointments today (using distinct patient IDs)
    const appointmentsToday = await db.query.appointments.findMany({
      where: and(
        eq(schema.appointments.date, startOfDay.toISOString().split('T')[0]),
        ne(schema.appointments.status, 'Cancelled')
      ),
      columns: {
        patientId: true
      }
    });
    
    // Gunakan Set untuk menghitung jumlah pasien unik yang memiliki appointment hari ini
    const uniquePatientIds = new Set(appointmentsToday.map(a => a.patientId));
    const patientsToday = uniquePatientIds.size;
    
    // Calculate income from today's transactions
    const todayTransactions = await db.query.transactions.findMany({
      where: and(
        gte(schema.transactions.createdAt, startOfDay),
        lte(schema.transactions.createdAt, endOfDay)
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
      patientsToday: patientsToday,
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
            // Konversi string date menjadi Date object jika dibutuhkan
            let appointmentDate: Date;
            let dateStr: string;
            
            if (typeof appointment.date === 'string') {
              // Jika date sudah string format YYYY-MM-DD, gunakan langsung
              dateStr = appointment.date;
              appointmentDate = new Date(appointment.date);
            } else {
              // Fallback jika appointment.date adalah Date object (seharusnya tidak terjadi lagi)
              appointmentDate = new Date(appointment.date);
              dateStr = formatDateString(appointmentDate);
            }
            
            activities.push({
              id: 1000 + appointment.id, // Menambahkan offset untuk menghindari konflik ID
              type: "appointment",
              description: `${patient.name} terjadwal untuk sesi terapi pada ${dateStr}`,
              timestamp: new Date().toISOString() // Fallback ke waktu sekarang
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
      
      // Pastikan setiap record memiliki treatmentDate yang valid sebagai string
      const validRecords = records.map(record => {
        // Periksa apakah treatmentDate masih valid
        if (!record.treatmentDate) {
          // Jika tidak ada treatmentDate, gunakan createdAt sebagai string format YYYY-MM-DD
          const createdAtStr = new Date(record.createdAt).toISOString().split('T')[0];
          return {
            ...record,
            treatmentDate: createdAtStr
          };
        } else if (typeof record.treatmentDate === 'string') {
          // Jika sudah string, pastikan ini valid
          const testDate = new Date(record.treatmentDate);
          if (isNaN(testDate.getTime()) || testDate.getFullYear() <= 1970) {
            // String tidak valid, gunakan createdAt
            const createdAtStr = new Date(record.createdAt).toISOString().split('T')[0];
            return {
              ...record,
              treatmentDate: createdAtStr
            };
          }
          // String sudah valid, gunakan apa adanya
          return record;
        } else if (record.treatmentDate instanceof Date) {
          // Jika Date object, konversi ke string
          return {
            ...record,
            treatmentDate: record.treatmentDate.toISOString().split('T')[0]
          };
        }
        
        // Fallback jika tidak ada kondisi yang terpenuhi
        return record;
      });
      
      return validRecords;
    } catch (error) {
      console.error('[DB] Error getting medical histories by patient:', error);
      return [];
    }
  }

  async createMedicalHistory(medicalHistory: InsertMedicalHistory): Promise<MedicalHistory> {
    try {
      // Validasi tanggal pengobatan sebelum menyimpan ke database
      let validTreatmentDate: string;
      
      if (typeof medicalHistory.treatmentDate === 'string') {
        // Jika sudah string, pastikan ini valid
        const testDate = new Date(medicalHistory.treatmentDate);
        if (!isNaN(testDate.getTime()) && testDate.getFullYear() > 1970) {
          validTreatmentDate = medicalHistory.treatmentDate;
        } else {
          // String yang tidak valid, gunakan hari ini
          validTreatmentDate = new Date().toISOString().split('T')[0];
        }
      } else if (medicalHistory.treatmentDate instanceof Date) {
        // Jika Date object, konversi ke string
        validTreatmentDate = medicalHistory.treatmentDate.toISOString().split('T')[0];
      } else {
        // Tidak ada treatmentDate atau tidak valid, gunakan hari ini
        console.log("Invalid treatment date provided in createMedicalHistory, using current date");
        validTreatmentDate = new Date().toISOString().split('T')[0];
      }
      
      console.log(`Creating medical history with treatment date: ${validTreatmentDate} (${typeof validTreatmentDate})`);
      
      const now = new Date();
      
      // Simpan ke database dengan tanggal yang valid sebagai string
      const [record] = await db.insert(medicalHistories)
        .values({
          ...medicalHistory,
          treatmentDate: validTreatmentDate,
          createdAt: now
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
      // Dapatkan data yang sudah ada untuk memastikan kita tidak kehilangan treatmentDate
      const [existingHistory] = await db.select()
        .from(medicalHistories)
        .where(eq(medicalHistories.id, id));
      
      if (!existingHistory) {
        return undefined;
      }
      
      // Tentukan tanggal pengobatan yang tepat dengan prioritas:
      // 1. Tanggal pengobatan yang diberikan dalam update jika ada dan valid
      // 2. Tanggal pengobatan yang sudah ada jika valid
      // 3. Tanggal pembuatan record sebagai fallback
      let validTreatmentDate: string;
      
      // Periksa apakah ada tanggal pengobatan dalam update dan valid
      if (medicalHistory.treatmentDate) {
        if (typeof medicalHistory.treatmentDate === 'string') {
          // Jika sudah string, pastikan valid
          const testDate = new Date(medicalHistory.treatmentDate);
          if (!isNaN(testDate.getTime()) && testDate.getFullYear() > 1970) {
            validTreatmentDate = medicalHistory.treatmentDate;
          } else {
            // String tidak valid, gunakan tanggal existing atau today
            validTreatmentDate = typeof existingHistory.treatmentDate === 'string' 
              ? existingHistory.treatmentDate 
              : new Date().toISOString().split('T')[0];
          }
        } else if (medicalHistory.treatmentDate instanceof Date) {
          // Jika Date object, konversi ke string format YYYY-MM-DD
          validTreatmentDate = medicalHistory.treatmentDate.toISOString().split('T')[0];
        } else {
          // Fallback ke tanggal existing atau tanggal hari ini
          validTreatmentDate = typeof existingHistory.treatmentDate === 'string' 
            ? existingHistory.treatmentDate 
            : new Date().toISOString().split('T')[0];
        }
      } else if (existingHistory.treatmentDate) {
        // Gunakan tanggal yang sudah ada jika ada
        validTreatmentDate = typeof existingHistory.treatmentDate === 'string'
          ? existingHistory.treatmentDate
          : new Date(existingHistory.treatmentDate).toISOString().split('T')[0];
      } else {
        // Jika masih belum ada yang valid, gunakan tanggal pembuatan
        validTreatmentDate = new Date(existingHistory.createdAt).toISOString().split('T')[0];
      }
      
      // Pastikan treatmentDate selalu valid dalam update sebagai string
      const dataToUpdate = {
        ...medicalHistory,
        treatmentDate: validTreatmentDate
      };
      
      console.log('Received medical history update data:', medicalHistory);
      console.log('Processed medical history update data:', dataToUpdate);
      console.log(`Using treatment date: ${validTreatmentDate} (${typeof validTreatmentDate})`);
      
      const [updated] = await db.update(medicalHistories)
        .set(dataToUpdate)
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
  
  // Medical histories by phone number
  async getMedicalHistoriesByPhoneNumber(phoneNumber: string): Promise<MedicalHistory[]> {
    try {
      // First get all patients with this phone number
      const patientsWithSamePhone = await db.select()
        .from(patients)
        .where(eq(patients.phoneNumber, phoneNumber));
      
      if (patientsWithSamePhone.length === 0) {
        return [];
      }
      
      // Extract patient IDs
      const patientIds = patientsWithSamePhone.map(p => p.id);
      
      // Get all medical histories for these patients
      const histories = await db.select()
        .from(medicalHistories)
        .where(inArray(medicalHistories.patientId, patientIds))
        .orderBy(desc(medicalHistories.treatmentDate));
      
      // Pastikan setiap record memiliki treatmentDate yang valid sebagai string
      const validRecords = histories.map(record => {
        // Periksa apakah treatmentDate masih valid
        if (!record.treatmentDate) {
          // Jika tidak ada treatmentDate, gunakan createdAt sebagai string format YYYY-MM-DD
          const createdAtStr = new Date(record.createdAt).toISOString().split('T')[0];
          return {
            ...record,
            treatmentDate: createdAtStr
          };
        } else if (typeof record.treatmentDate === 'string') {
          // Jika sudah string, pastikan ini valid
          const testDate = new Date(record.treatmentDate);
          if (isNaN(testDate.getTime()) || testDate.getFullYear() <= 1970) {
            // String tidak valid, gunakan createdAt
            const createdAtStr = new Date(record.createdAt).toISOString().split('T')[0];
            return {
              ...record,
              treatmentDate: createdAtStr
            };
          }
        }
        
        return record;
      });
      
      return validRecords;
    } catch (error) {
      console.error('[DB] Error getting medical histories by phone number:', error);
      return [];
    }
  }
  
  // Patient Relationships methods
  async getPatientsByPhoneNumber(phoneNumber: string): Promise<Patient[]> {
    try {
      const patientsFound = await db.select()
        .from(schema.patients)
        .where(eq(schema.patients.phoneNumber, phoneNumber));
      
      return patientsFound;
    } catch (error) {
      console.error('[DB] Error getting patients by phone number:', error);
      return [];
    }
  }
  
  async getRelatedPatients(patientId: number): Promise<Patient[]> {
    try {
      // Dapatkan pasien yang bersangkutan terlebih dahulu untuk mendapatkan nomor telepon
      const [patient] = await db.select()
        .from(schema.patients)
        .where(eq(schema.patients.id, patientId));
      
      if (!patient) {
        return [];
      }
      
      // Cari semua pasien dengan nomor telepon yang sama, kecuali dirinya sendiri
      const relatedPatients = await db.select()
        .from(schema.patients)
        .where(and(
          eq(schema.patients.phoneNumber, patient.phoneNumber),
          ne(schema.patients.id, patientId)
        ));
      
      return relatedPatients;
    } catch (error) {
      console.error('[DB] Error getting related patients:', error);
      return [];
    }
  }
  
  async createPatientRelationship(relationship: schema.InsertPatientRelationship): Promise<schema.PatientRelationship> {
    try {
      const [record] = await db.insert(schema.patientRelationships)
        .values({
          patientId: relationship.patientId,
          relatedPatientId: relationship.relatedPatientId,
          relationshipType: relationship.relationshipType || "phone_number_shared"
        })
        .returning();
      
      return record;
    } catch (error) {
      console.error('[DB] Error creating patient relationship:', error);
      throw error;
    }
  }
  
  async getPatientRelationships(patientId: number): Promise<schema.PatientRelationship[]> {
    try {
      const relationships = await db.select()
        .from(schema.patientRelationships)
        .where(or(
          eq(schema.patientRelationships.patientId, patientId),
          eq(schema.patientRelationships.relatedPatientId, patientId)
        ));
      
      return relationships;
    } catch (error) {
      console.error('[DB] Error getting patient relationships:', error);
      return [];
    }
  }
}