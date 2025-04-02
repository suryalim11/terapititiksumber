import { 
  users, patients, products, packages, transactions, sessions, appointments, therapySlots,
  type User, type InsertUser, type Patient, type InsertPatient,
  type Product, type InsertProduct, type Package, type Transaction,
  type InsertTransaction, type Session, type InsertSession,
  type Appointment, type InsertAppointment, type TherapySlot, type InsertTherapySlot
} from "@shared/schema";
import { format } from "date-fns";

// Storage interface
// Interface for registration link
export interface RegistrationLink {
  id: number;
  code: string;
  expiryTime: Date;
  dailyLimit: number;
  currentRegistrations: number;
  createdAt: Date;
  isActive: boolean;
  createdBy: number; // User ID who created the link
  specificDate: string | null;
}

import session from "express-session";
import memorystore from "memorystore";

const MemoryStore = memorystore(session);

// Set USE_DATABASE untuk menentukan apakah menggunakan database atau memory storage
const USE_DATABASE = process.env.DATABASE_URL ? true : false;

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: number, newPassword: string): Promise<User | undefined>;
  
  // Patients
  getPatient(id: number): Promise<Patient | undefined>;
  getAllPatients(): Promise<Patient[]>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: number, patient: InsertPatient): Promise<Patient | undefined>;
  deletePatient(id: number): Promise<boolean>;
  
  // Products
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: InsertProduct): Promise<Product | undefined>;
  updateProductStock(id: number, stockChange: number): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Packages
  getPackage(id: number): Promise<Package | undefined>;
  getAllPackages(): Promise<Package[]>;
  
  // Transactions
  getTransaction(id: number): Promise<Transaction | undefined>;
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionsByPatient(patientId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: number): Promise<boolean>;
  
  // Sessions
  getSession(id: number): Promise<Session | undefined>;
  getSessionsByPatient(patientId: number): Promise<Session[]>;
  getActiveSessionsByPatient(patientId: number): Promise<Session[]>;
  getAllActiveSessions(): Promise<Session[]>;
  createSession(session: InsertSession): Promise<Session>;
  updateSessionUsage(id: number, sessionsUsed?: number): Promise<Session | undefined>;
  
  // Therapy Slots
  getTherapySlot(id: number): Promise<TherapySlot | undefined>;
  getTherapySlotsByDate(date: Date): Promise<TherapySlot[]>;
  getAllTherapySlots(): Promise<TherapySlot[]>;
  getActiveTherapySlots(): Promise<TherapySlot[]>;
  createTherapySlot(slot: InsertTherapySlot): Promise<TherapySlot>;
  updateTherapySlot(id: number, slot: Partial<InsertTherapySlot>): Promise<TherapySlot | undefined>;
  incrementTherapySlotUsage(id: number): Promise<TherapySlot | undefined>;
  decrementTherapySlotUsage(id: number): Promise<TherapySlot | undefined>;
  deactivateTherapySlot(id: number): Promise<boolean>;
  deleteTherapySlot(id: number): Promise<boolean>;
  
  // Appointments
  getAppointment(id: number): Promise<Appointment | undefined>;
  getAllAppointments(): Promise<Appointment[]>;
  getAppointmentsByDate(date: Date): Promise<Appointment[]>;
  getAppointmentsByPatient(patientId: number): Promise<Appointment[]>;
  getAppointmentsByTherapySlot(therapySlotId: number): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined>;
  
  // Registration Links
  createRegistrationLink(userId: number, expiryHours: number, dailyLimit: number, specificDate?: string): Promise<RegistrationLink>;
  getRegistrationLinkByCode(code: string): Promise<RegistrationLink | undefined>;
  getAllRegistrationLinks(): Promise<RegistrationLink[]>;
  incrementRegistrationCount(code: string): Promise<RegistrationLink | undefined>;
  deactivateRegistrationLink(id: number): Promise<boolean>;
  deleteRegistrationLink(id: number): Promise<boolean>;
  
  // Dashboard data
  getDailyStats(): Promise<{
    patientsToday: number;
    incomeToday: number;
    productsSold: number;
    activePackages: number;
  }>;
  getRecentActivities(limit?: number): Promise<any[]>;
  
  // Session store for authentication
  sessionStore: session.Store;
}

// Import Database Storage
import { DatabaseStorage } from "./database-storage";

// Memory Storage Implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private patients: Map<number, Patient>;
  private products: Map<number, Product>;
  private packageList: Map<number, Package>;
  private transactions: Map<number, Transaction>;
  private therapySessions: Map<number, Session>;
  private therapySlots: Map<number, TherapySlot>;
  private appointments: Map<number, Appointment>;
  private registrationLinks: Map<number, RegistrationLink>;
  
  private userCurrentId: number;
  private patientCurrentId: number;
  private productCurrentId: number;
  private packageCurrentId: number;
  private transactionCurrentId: number;
  private sessionCurrentId: number;
  private therapySlotCurrentId: number;
  private appointmentCurrentId: number;
  private registrationLinkCurrentId: number;

  // Session store for authentication
  sessionStore: session.Store;
  
  constructor() {
    this.users = new Map();
    this.patients = new Map();
    this.products = new Map();
    this.packageList = new Map();
    this.transactions = new Map();
    this.therapySessions = new Map();
    this.therapySlots = new Map();
    this.appointments = new Map();
    this.registrationLinks = new Map();
    
    this.userCurrentId = 1;
    this.patientCurrentId = 1;
    this.productCurrentId = 1;
    this.packageCurrentId = 1;
    this.transactionCurrentId = 1;
    this.sessionCurrentId = 1;
    this.therapySlotCurrentId = 1;
    this.appointmentCurrentId = 1;
    this.registrationLinkCurrentId = 1;
    
    // Initialize session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    // Initialize with default data - synchronous initialization
    this.initDefaultData();
  }
  
  // Synchronous initialization for default data
  private initDefaultData() {
    // Create default admin user
    const admin: User = {
      id: 1,
      username: "admin",
      password: "admin123456", // Diubah sesuai permintaan pengguna
      name: "Administrator",
      role: "admin",
      createdAt: new Date()
    };
    this.users.set(admin.id, admin);
    this.userCurrentId++;
    
    // Create second admin user
    const admin2: User = {
      id: 2,
      username: "suryalim11",
      password: "admin123456", // In a real app, would be hashed
      name: "Surya Lim",
      role: "admin",
      createdAt: new Date()
    };
    this.users.set(admin2.id, admin2);
    this.userCurrentId++;
    
    // Create default registration link
    const now = new Date();
    const expiryTime = new Date(now);
    expiryTime.setHours(expiryTime.getHours() + 168); // 7 days
    
    const registrationLink: RegistrationLink = {
      id: 1,
      code: "TTS-REG",
      expiryTime,
      dailyLimit: 5,
      currentRegistrations: 0,
      createdAt: now,
      isActive: true,
      createdBy: 1, // Admin user ID
      specificDate: null
    };
    this.registrationLinks.set(registrationLink.id, registrationLink);
    this.registrationLinkCurrentId++;
    
    // Initialize packages and products
    this.initPackagesAndProducts();
    
    // Initialize default therapy slots
    this.initDefaultTherapySlots();
    
    // Initialize sample patients and appointments for testing
    this.initSamplePatientsAndAppointments();
    
    console.log("Default data initialized:", {
      admins: Array.from(this.users.values()),
      registrationLinks: Array.from(this.registrationLinks.values()),
      packages: Array.from(this.packageList.values()),
      products: Array.from(this.products.values()),
      therapySlots: Array.from(this.therapySlots.values())
    });
  }

  // Menginisialisasi paket dan produk
  private initPackagesAndProducts() {
    // Create default packages
    this.packageList.set(1, {
      id: 1,
      name: "Sesi Tunggal",
      sessions: 1,
      price: "150000",
      description: "Paket terapi untuk satu sesi"
    });
    
    this.packageList.set(2, {
      id: 2,
      name: "Paket 12 Sesi",
      sessions: 12,
      price: "1500000",
      description: "Paket terapi untuk 12 sesi dengan harga spesial"
    });
    
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
    
    products.forEach((product, index) => {
      this.products.set(index + 1, {
        ...product,
        id: index + 1,
        createdAt: new Date()
      });
      this.productCurrentId = index + 2;
    });
    
    console.log("Paket dan produk default diinisialisasi");
  }
  
  // Inisialisasi slot terapi
  private initDefaultTherapySlots() {
    // Membuat slot terapi untuk hari ini dan 7 hari ke depan
    const today = new Date();
    
    // Definisi slot waktu default yang telah diperbarui sesuai permintaan
    const timeSlots = [
      { time: "10:00-11:30", quota: 4 },
      // 11:30-12:30 adalah jam istirahat
      { time: "12:30-14:00", quota: 4 },
      { time: "14:00-15:30", quota: 4 },
      { time: "15:30-17:00", quota: 5 }
    ];
    
    // Membuat 7 hari slot terapi
    for (let i = 0; i < 7; i++) {
      const slotDate = new Date(today);
      slotDate.setDate(slotDate.getDate() + i);
      
      // Skip minggu (0 = Minggu, 1 = Senin, dsb)
      if (slotDate.getDay() === 0) continue;
      
      // Buat semua slot waktu untuk hari ini
      for (const slot of timeSlots) {
        const therapySlot: TherapySlot = {
          id: this.therapySlotCurrentId++,
          date: slotDate,
          timeSlot: slot.time,
          maxQuota: slot.quota,
          currentCount: 0,
          isActive: true,
          createdAt: new Date()
        };
        
        this.therapySlots.set(therapySlot.id, therapySlot);
      }
    }
    
    console.log(`Slot terapi default diinisialisasi untuk 7 hari ke depan`);
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const createdAt = new Date();
    const role = insertUser.role || 'admin'; // Default role if not provided
    const user: User = { ...insertUser, id, createdAt, role };
    this.users.set(id, user);
    return user;
  }
  
  async updateUserPassword(id: number, newPassword: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      password: newPassword
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Patient methods
  async getPatient(id: number): Promise<Patient | undefined> {
    return this.patients.get(id);
  }

  async getAllPatients(): Promise<Patient[]> {
    return Array.from(this.patients.values());
  }

  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    const id = this.patientCurrentId++;
    const patientId = `P-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`;
    const createdAt = new Date();
    
    // Create patient with appropriate null values for optional fields
    const patient: Patient = { 
      ...insertPatient, 
      id, 
      patientId, 
      createdAt,
      email: insertPatient.email || null,
      therapySlotId: insertPatient.therapySlotId || null 
    };
    
    this.patients.set(id, patient);
    
    // Jika pasien terkait dengan slot terapi, increment jumlah penggunaan slot
    if (patient.therapySlotId) {
      await this.incrementTherapySlotUsage(patient.therapySlotId);
    }
    
    return patient;
  }
  
  async updatePatient(id: number, updateData: InsertPatient): Promise<Patient | undefined> {
    const existingPatient = this.patients.get(id);
    if (!existingPatient) return undefined;
    
    const updatedPatient: Patient = { 
      ...existingPatient, 
      ...updateData 
    };
    
    this.patients.set(id, updatedPatient);
    return updatedPatient;
  }
  
  async deletePatient(id: number): Promise<boolean> {
    const exists = this.patients.has(id);
    if (!exists) return false;
    
    // Cari dan hapus semua appointment terkait
    const patientAppointments = Array.from(this.appointments.values())
      .filter(appointment => appointment.patientId === id);
    
    for (const appointment of patientAppointments) {
      this.appointments.delete(appointment.id);
    }
    
    // Cari dan hapus semua sesi (paket terapi) terkait
    const patientSessions = Array.from(this.therapySessions.values())
      .filter(session => session.patientId === id);
    
    for (const session of patientSessions) {
      this.therapySessions.delete(session.id);
    }
    
    // Hapus pasien
    this.patients.delete(id);
    return true;
  }

  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.productCurrentId++;
    const createdAt = new Date();
    const product: Product = { ...insertProduct, id, createdAt };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: number, updateData: InsertProduct): Promise<Product | undefined> {
    const existingProduct = this.products.get(id);
    if (!existingProduct) return undefined;
    
    const updatedProduct: Product = {
      ...existingProduct,
      ...updateData
    };
    
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }
  
  async updateProductStock(id: number, stockChange: number): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    const updatedProduct = {
      ...product,
      stock: product.stock + stockChange
    };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    const exists = this.products.has(id);
    if (!exists) return false;
    
    this.products.delete(id);
    return true;
  }

  // Package methods
  async getPackage(id: number): Promise<Package | undefined> {
    return this.packageList.get(id);
  }

  async getAllPackages(): Promise<Package[]> {
    return Array.from(this.packageList.values());
  }

  // Transaction methods
  async getTransaction(id: number): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }

  async getTransactionsByPatient(patientId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(transaction => transaction.patientId === patientId);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = this.transactionCurrentId++;
    const transactionId = `T-${format(new Date(), 'yyyyMMdd')}-${String(id).padStart(3, '0')}`;
    const createdAt = new Date();
    const transaction: Transaction = { ...insertTransaction, id, transactionId, createdAt };
    this.transactions.set(id, transaction);
    return transaction;
  }
  
  async deleteTransaction(id: number): Promise<boolean> {
    // Check if transaction exists
    if (!this.transactions.has(id)) {
      return false;
    }
    
    const transaction = this.transactions.get(id);
    
    // Delete the transaction
    this.transactions.delete(id);
    
    // Find any sessions that were created from this transaction
    const sessionsToDelete = Array.from(this.therapySessions.values())
      .filter(session => session.transactionId === id);
    
    // Delete associated sessions
    for (const session of sessionsToDelete) {
      this.therapySessions.delete(session.id);
    }
    
    // For products, restore the stock
    if (transaction && transaction.items) {
      for (const item of transaction.items) {
        if (item.type === 'product' && typeof item.id === 'number' && typeof item.quantity === 'number') {
          const product = this.products.get(item.id);
          if (product) {
            // Restore the stock by adding back the quantity
            await this.updateProductStock(item.id, item.quantity);
          }
        }
      }
    }
    
    return true;
  }

  // Session methods
  async getSession(id: number): Promise<Session | undefined> {
    return this.therapySessions.get(id);
  }

  async getSessionsByPatient(patientId: number): Promise<Session[]> {
    return Array.from(this.therapySessions.values())
      .filter(session => session.patientId === patientId);
  }

  async getActiveSessionsByPatient(patientId: number): Promise<Session[]> {
    return Array.from(this.therapySessions.values())
      .filter(session => session.patientId === patientId && session.status === 'active');
  }
  
  async getAllActiveSessions(): Promise<Session[]> {
    return Array.from(this.therapySessions.values())
      .filter(session => session.status === 'active');
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = this.sessionCurrentId++;
    const startDate = new Date();
    const session: Session = { 
      ...insertSession, 
      id, 
      startDate, 
      sessionsUsed: 0, 
      status: 'active' 
    };
    this.therapySessions.set(id, session);
    return session;
  }

  async updateSessionUsage(id: number, sessionsUsed?: number): Promise<Session | undefined> {
    const session = this.therapySessions.get(id);
    if (!session) return undefined;
    
    let updatedSessionsUsed = session.sessionsUsed;
    if (sessionsUsed !== undefined) {
      updatedSessionsUsed = sessionsUsed;
    } else {
      updatedSessionsUsed += 1;
    }
    
    const lastSessionDate = new Date();
    const status = updatedSessionsUsed >= session.totalSessions ? 'completed' : 'active';
    
    const updatedSession: Session = {
      ...session,
      sessionsUsed: updatedSessionsUsed,
      lastSessionDate,
      status
    };
    
    this.therapySessions.set(id, updatedSession);
    return updatedSession;
  }
  
  // Therapy Slot methods
  async getTherapySlot(id: number): Promise<TherapySlot | undefined> {
    return this.therapySlots.get(id);
  }
  
  async getTherapySlotsByDate(date: Date): Promise<TherapySlot[]> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    return Array.from(this.therapySlots.values())
      .filter(slot => {
        const slotDate = new Date(slot.date);
        slotDate.setHours(0, 0, 0, 0);
        return slotDate.getTime() === targetDate.getTime();
      });
  }
  
  async getAllTherapySlots(): Promise<TherapySlot[]> {
    return Array.from(this.therapySlots.values());
  }
  
  async getActiveTherapySlots(): Promise<TherapySlot[]> {
    return Array.from(this.therapySlots.values())
      .filter(slot => slot.isActive && slot.currentCount < slot.maxQuota);
  }
  
  async createTherapySlot(insertSlot: InsertTherapySlot): Promise<TherapySlot> {
    const id = this.therapySlotCurrentId++;
    const createdAt = new Date();
    
    const slot: TherapySlot = {
      ...insertSlot,
      id,
      createdAt
    };
    
    this.therapySlots.set(id, slot);
    return slot;
  }
  
  async updateTherapySlot(id: number, updateData: Partial<InsertTherapySlot>): Promise<TherapySlot | undefined> {
    const existingSlot = this.therapySlots.get(id);
    if (!existingSlot) return undefined;
    
    const updatedSlot: TherapySlot = {
      ...existingSlot,
      ...updateData
    };
    
    this.therapySlots.set(id, updatedSlot);
    return updatedSlot;
  }
  
  async incrementTherapySlotUsage(id: number): Promise<TherapySlot | undefined> {
    const slot = this.therapySlots.get(id);
    if (!slot) return undefined;
    
    // Jika kuota sudah penuh, tidak bisa increment lagi
    if (slot.currentCount >= slot.maxQuota) {
      console.error(`[storage] Tidak bisa increment slot terapi ${id}, kuota sudah penuh (${slot.currentCount}/${slot.maxQuota})`);
      return slot;
    }
    
    const updatedSlot: TherapySlot = {
      ...slot,
      currentCount: slot.currentCount + 1
    };
    
    this.therapySlots.set(id, updatedSlot);
    return updatedSlot;
  }
  
  async decrementTherapySlotUsage(id: number): Promise<TherapySlot | undefined> {
    const slot = this.therapySlots.get(id);
    if (!slot) return undefined;
    
    // Pastikan currentCount tidak menjadi negatif
    if (slot.currentCount <= 0) {
      console.error(`[storage] Tidak bisa decrement slot terapi ${id}, kuota sudah 0`);
      return slot;
    }
    
    const updatedSlot: TherapySlot = {
      ...slot,
      currentCount: slot.currentCount - 1
    };
    
    this.therapySlots.set(id, updatedSlot);
    console.log(`[storage] Decremented slot terapi ${id} from ${slot.currentCount} to ${updatedSlot.currentCount}`);
    return updatedSlot;
  }
  
  async deactivateTherapySlot(id: number): Promise<boolean> {
    const slot = this.therapySlots.get(id);
    if (!slot) return false;
    
    const updatedSlot: TherapySlot = {
      ...slot,
      isActive: false
    };
    
    this.therapySlots.set(id, updatedSlot);
    return true;
  }
  
  async deleteTherapySlot(id: number): Promise<boolean> {
    // Check if therapy slot exists
    const exists = this.therapySlots.has(id);
    if (!exists) return false;
    
    // Check if the slot has any registered patients (currentCount > 0)
    const slot = this.therapySlots.get(id);
    if (slot && slot.currentCount > 0) {
      // Can't delete slot with registered patients
      return false;
    }
    
    // Delete the slot
    this.therapySlots.delete(id);
    return true;
  }

  // Appointment methods
  async getAppointment(id: number): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async getAllAppointments(): Promise<Appointment[]> {
    return Array.from(this.appointments.values());
  }

  async getAppointmentsByDate(date: Date): Promise<Appointment[]> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    return Array.from(this.appointments.values())
      .filter(appointment => {
        const appointmentDate = new Date(appointment.date);
        appointmentDate.setHours(0, 0, 0, 0);
        return appointmentDate.getTime() === targetDate.getTime();
      });
  }

  async getAppointmentsByPatient(patientId: number): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(appointment => appointment.patientId === patientId);
  }
  
  async getAppointmentsByTherapySlot(therapySlotId: number): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(appointment => appointment.therapySlotId === therapySlotId);
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const id = this.appointmentCurrentId++;
    
    // Memastikan bahwa sessionId adalah null jika tidak disediakan
    const sessionId = insertAppointment.sessionId ?? null;
    
    // Memastikan bahwa notes adalah null jika tidak disediakan
    const notes = insertAppointment.notes ?? null;
    
    // Validasi status
    const validStatus = ['scheduled', 'completed', 'cancelled'];
    const status = validStatus.includes(insertAppointment.status || '') 
      ? insertAppointment.status 
      : 'scheduled';
    
    const appointment: Appointment = { 
      ...insertAppointment,
      sessionId,
      notes, 
      id, 
      status
    };
    
    console.log("Menyimpan appointment ke penyimpanan:", appointment);
    this.appointments.set(id, appointment);
    return appointment;
  }

  async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    
    // Validasi status lagi untuk keamanan extra
    const validStatuses = ['scheduled', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      console.error(`Status tidak valid: ${status}. Status harus salah satu dari: ${validStatuses.join(', ')}`);
      return undefined;
    }
    
    console.log(`[storage] Updating appointment ${id} status from '${appointment.status}' to '${status}'`);
    
    const updatedAppointment: Appointment = {
      ...appointment,
      status
    };
    
    this.appointments.set(id, updatedAppointment);
    console.log(`[storage] Appointment updated successfully: `, updatedAppointment);
    return updatedAppointment;
  }

  // Dashboard data methods
  async getDailyStats(): Promise<{
    patientsToday: number;
    incomeToday: number;
    productsSold: number;
    activePackages: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Count patients with appointments today
    const appointmentsToday = await this.getAppointmentsByDate(today);
    const patientsToday = new Set(appointmentsToday.map(a => a.patientId)).size;
    
    // Sum up income from transactions made today
    const todaysTransactions = Array.from(this.transactions.values())
      .filter(transaction => {
        const transactionDate = new Date(transaction.createdAt);
        transactionDate.setHours(0, 0, 0, 0);
        return transactionDate.getTime() === today.getTime();
      });
    
    const incomeToday = todaysTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.totalAmount), 
      0
    );
    
    // Count products sold today (from transaction items)
    let productsSold = 0;
    todaysTransactions.forEach(transaction => {
      const items = transaction.items as any[];
      items.forEach(item => {
        if (item.type === 'product') {
          productsSold += item.quantity || 1;
        }
      });
    });
    
    // Count active therapy packages
    const activePackages = Array.from(this.therapySessions.values())
      .filter(session => session.status === 'active').length;
    
    return {
      patientsToday,
      incomeToday,
      productsSold,
      activePackages
    };
  }

  async getRecentActivities(limit: number = 5): Promise<any[]> {
    // Combine transactions, appointments and session updates to create activity feed
    const activities: any[] = [];
    
    // Add recent transactions
    const recentTransactions = Array.from(this.transactions.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
      
    for (const transaction of recentTransactions) {
      const patient = await this.getPatient(transaction.patientId);
      if (patient) {
        activities.push({
          type: 'transaction',
          date: transaction.createdAt,
          patient: patient.name,
          patientId: patient.id,
          amount: transaction.totalAmount,
          description: `melakukan pembayaran sebesar ${transaction.totalAmount}`
        });
      }
    }
    
    // Add recent appointments
    const recentAppointments = Array.from(this.appointments.values())
      .filter(a => a.status === 'scheduled')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, limit);
      
    for (const appointment of recentAppointments) {
      const patient = await this.getPatient(appointment.patientId);
      if (patient) {
        activities.push({
          type: 'appointment',
          date: appointment.date,
          patient: patient.name,
          patientId: patient.id,
          description: `dijadwalkan untuk sesi terapi`
        });
      }
    }
    
    // Add session updates
    const recentSessionUpdates = Array.from(this.therapySessions.values())
      .filter(s => s.lastSessionDate)
      .sort((a, b) => {
        if (!a.lastSessionDate || !b.lastSessionDate) return 0;
        return new Date(b.lastSessionDate).getTime() - new Date(a.lastSessionDate).getTime();
      })
      .slice(0, limit);
      
    for (const session of recentSessionUpdates) {
      const patient = await this.getPatient(session.patientId);
      if (patient && session.lastSessionDate) {
        activities.push({
          type: 'session',
          date: session.lastSessionDate,
          patient: patient.name,
          patientId: patient.id,
          sessionsUsed: session.sessionsUsed,
          totalSessions: session.totalSessions,
          description: `menyelesaikan sesi terapi ke-${session.sessionsUsed}`
        });
      }
    }
    
    // Sort by date and limit
    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }
  
  // Registration Link methods
  async createRegistrationLink(userId: number, expiryHours: number, dailyLimit: number, specificDate?: string): Promise<RegistrationLink> {
    const id = this.registrationLinkCurrentId++;
    const createdAt = new Date();
    
    // Membuat tanggal kedaluwarsa
    const expiryTime = new Date(createdAt);
    expiryTime.setHours(expiryTime.getHours() + expiryHours);
    
    // Membuat kode unik acak alphanumeric
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    const registrationLink: RegistrationLink = {
      id,
      code,
      expiryTime,
      dailyLimit,
      currentRegistrations: 0,
      createdAt,
      isActive: true,
      createdBy: userId,
      specificDate
    };
    
    this.registrationLinks.set(id, registrationLink);
    return registrationLink;
  }

  async getRegistrationLinkByCode(code: string): Promise<RegistrationLink | undefined> {
    return Array.from(this.registrationLinks.values()).find(link => link.code === code);
  }

  async getAllRegistrationLinks(): Promise<RegistrationLink[]> {
    return Array.from(this.registrationLinks.values());
  }

  async incrementRegistrationCount(code: string): Promise<RegistrationLink | undefined> {
    const link = await this.getRegistrationLinkByCode(code);
    if (!link) return undefined;
    
    const updatedLink: RegistrationLink = {
      ...link,
      currentRegistrations: link.currentRegistrations + 1
    };
    
    this.registrationLinks.set(link.id, updatedLink);
    return updatedLink;
  }

  async deactivateRegistrationLink(id: number): Promise<boolean> {
    const link = this.registrationLinks.get(id);
    if (!link) return false;
    
    const updatedLink: RegistrationLink = {
      ...link,
      isActive: false
    };
    
    this.registrationLinks.set(id, updatedLink);
    return true;
  }
  
  async deleteRegistrationLink(id: number): Promise<boolean> {
    const exists = this.registrationLinks.has(id);
    if (!exists) return false;
    
    this.registrationLinks.delete(id);
    return true;
  }
  
  // Inisialisasi data pasien dan janji temu untuk pengujian
  private initSamplePatientsAndAppointments() {
    // Buat 3 pasien contoh
    const patient1: Patient = {
      id: 1,
      name: "Budi Santoso",
      phoneNumber: "081234567890",
      email: "budi@example.com",
      address: "Jl. Pahlawan No. 123, Jakarta",
      patientId: "P-2025-001",
      createdAt: new Date(),
      therapySlotId: null
    };
    
    const patient2: Patient = {
      id: 2,
      name: "Siti Rahayu",
      phoneNumber: "082345678901",
      email: "siti@example.com",
      address: "Jl. Merdeka No. 45, Bandung",
      patientId: "P-2025-002",
      createdAt: new Date(),
      therapySlotId: null
    };
    
    const patient3: Patient = {
      id: 3,
      name: "Ahmad Rizki",
      phoneNumber: "083456789012",
      email: "ahmad@example.com",
      address: "Jl. Sudirman No. 67, Surabaya",
      patientId: "P-2025-003",
      createdAt: new Date(),
      therapySlotId: null
    };
    
    this.patients.set(patient1.id, patient1);
    this.patients.set(patient2.id, patient2);
    this.patients.set(patient3.id, patient3);
    this.patientCurrentId = 4;
    
    // Buat appointment untuk slot terapi hari ini
    const todaySlots = Array.from(this.therapySlots.values()).filter(slot => {
      const slotDate = new Date(slot.date);
      const today = new Date();
      return slotDate.getDate() === today.getDate() &&
             slotDate.getMonth() === today.getMonth() &&
             slotDate.getFullYear() === today.getFullYear();
    });
    
    if (todaySlots.length > 0) {
      // Buat appointment untuk slot pertama hari ini
      const appointment1: Appointment = {
        id: 1,
        patientId: 1,
        therapySlotId: todaySlots[0].id,
        date: new Date(todaySlots[0].date),
        status: "Active",
        notes: "Pasien pertama kali terapi",
        createdAt: new Date(),
        sessionId: null
      };
      
      const appointment2: Appointment = {
        id: 2,
        patientId: 2,
        therapySlotId: todaySlots[0].id,
        date: new Date(todaySlots[0].date),
        status: "Active",
        notes: "Sesi ke-2",
        createdAt: new Date(),
        sessionId: null
      };
      
      // Jika ada lebih dari satu slot untuk hari ini
      if (todaySlots.length > 1) {
        const appointment3: Appointment = {
          id: 3,
          patientId: 3,
          therapySlotId: todaySlots[1].id,
          date: new Date(todaySlots[1].date),
          status: "Active",
          notes: "Pasien baru dirujuk",
          createdAt: new Date(),
          sessionId: null
        };
        
        this.appointments.set(appointment3.id, appointment3);
        
        // Update jumlah penggunaan slot
        const slot2 = this.therapySlots.get(todaySlots[1].id);
        if (slot2) {
          slot2.currentCount += 1;
          this.therapySlots.set(slot2.id, slot2);
        }
      }
      
      this.appointments.set(appointment1.id, appointment1);
      this.appointments.set(appointment2.id, appointment2);
      this.appointmentCurrentId = 4;
      
      // Update jumlah penggunaan slot
      const slot1 = this.therapySlots.get(todaySlots[0].id);
      if (slot1) {
        slot1.currentCount += 2;
        this.therapySlots.set(slot1.id, slot1);
      }
    }
    
    console.log("Data pasien dan janji temu contoh diinisialisasi");
  }
  
  // Method ini sudah tidak diperlukan lagi karena kita membuat link pendaftaran default
  // pada method initDefaultData secara sinkron
  // Metode ini disimpan hanya untuk referensi
  private _unusedCreateDefaultRegistrationLink(userId: number, expiryHours: number, dailyLimit: number): RegistrationLink {
    const id = this.registrationLinkCurrentId++;
    const createdAt = new Date();
    
    // Membuat tanggal kedaluwarsa
    const expiryTime = new Date(createdAt);
    expiryTime.setHours(expiryTime.getHours() + expiryHours);
    
    // Membuat kode default yang mudah diingat untuk link default
    const code = 'TTS-REG';
    
    const registrationLink: RegistrationLink = {
      id,
      code,
      expiryTime,
      dailyLimit,
      currentRegistrations: 0,
      createdAt,
      isActive: true,
      createdBy: userId,
      specificDate: null
    };
    
    // Simpan ke Map
    this.registrationLinks.set(id, registrationLink);
    console.log("Link pendaftaran default dibuat:", registrationLink);
    return registrationLink;
  }
}

// Export a singleton instance


// Export storage implementation - use DatabaseStorage if DATABASE_URL is set, otherwise MemStorage
export const storage: IStorage = USE_DATABASE 
  ? new DatabaseStorage()
  : new MemStorage();
