import { 
  users, patients, products, packages, transactions, sessions, appointments, therapySlots, settings,
  type User, type InsertUser, type Patient, type InsertPatient,
  type Product, type InsertProduct, type Package, type Transaction,
  type InsertTransaction, type Session, type InsertSession,
  type Appointment, type InsertAppointment, type TherapySlot, type InsertTherapySlot,
  type Setting, type InsertSetting
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
}

import session from "express-session";
import memorystore from "memorystore";

const MemoryStore = memorystore(session);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Patients
  getPatient(id: number): Promise<Patient | undefined>;
  getAllPatients(): Promise<Patient[]>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: number, patient: InsertPatient): Promise<Patient | undefined>;
  
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
  
  // Sessions
  getSession(id: number): Promise<Session | undefined>;
  getSessionsByPatient(patientId: number): Promise<Session[]>;
  getActiveSessionsByPatient(patientId: number): Promise<Session[]>;
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
  createRegistrationLink(userId: number, expiryHours: number, dailyLimit: number): Promise<RegistrationLink>;
  getRegistrationLinkByCode(code: string): Promise<RegistrationLink | undefined>;
  getAllRegistrationLinks(): Promise<RegistrationLink[]>;
  incrementRegistrationCount(code: string): Promise<RegistrationLink | undefined>;
  deactivateRegistrationLink(id: number): Promise<boolean>;
  
  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  createSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string, userId: number): Promise<Setting | undefined>;
  deleteSetting(key: string): Promise<boolean>;
  
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
  private settings: Map<string, Setting>;
  
  private userCurrentId: number;
  private patientCurrentId: number;
  private productCurrentId: number;
  private packageCurrentId: number;
  private transactionCurrentId: number;
  private sessionCurrentId: number;
  private therapySlotCurrentId: number;
  private appointmentCurrentId: number;
  private registrationLinkCurrentId: number;
  private settingCurrentId: number;

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
    this.settings = new Map();
    
    this.userCurrentId = 1;
    this.patientCurrentId = 1;
    this.productCurrentId = 1;
    this.packageCurrentId = 1;
    this.transactionCurrentId = 1;
    this.sessionCurrentId = 1;
    this.therapySlotCurrentId = 1;
    this.appointmentCurrentId = 1;
    this.registrationLinkCurrentId = 1;
    this.settingCurrentId = 1;
    
    // Initialize session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
    
    // Initialize with default data - synchronous initialization
    this.initDefaultData();
  }
  
  // Synchronous initialization for default data
  private initDefaultData() {
    // Initialize default settings
    this.initDefaultSettings();
    
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
      createdBy: 1 // Admin user ID
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

  // Metode inisialisasi pengaturan
  private initDefaultSettings() {
    // Pengaturan untuk harga sesi terapi
    const therapySinglePrice: Setting = {
      id: 1,
      key: "therapy.single.price",
      value: "150000",
      description: "Harga untuk sesi terapi tunggal",
      updatedAt: new Date(),
      updatedBy: 1 // Admin user ID
    };
    
    const therapyPackagePrice: Setting = {
      id: 2,
      key: "therapy.package.price",
      value: "1500000",
      description: "Harga untuk paket 12 sesi terapi",
      updatedAt: new Date(),
      updatedBy: 1
    };
    
    this.settings.set(therapySinglePrice.key, therapySinglePrice);
    this.settings.set(therapyPackagePrice.key, therapyPackagePrice);
    
    console.log("Default settings initialized:", {
      therapySinglePrice: therapySinglePrice.value,
      therapyPackagePrice: therapyPackagePrice.value
    });
    this.settingCurrentId = 3;
    
    console.log("Pengaturan default diinisialisasi");
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
    
    // Definisi slot waktu default
    const timeSlots = [
      { time: "10:00-11:00", quota: 5 },
      { time: "11:00-12:00", quota: 5 },
      { time: "13:00-14:00", quota: 5 },
      { time: "15:00-16:00", quota: 5 },
      { time: "16:00-17:00", quota: 5 }
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
    const user: User = { ...insertUser, id, createdAt };
    this.users.set(id, user);
    return user;
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

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = this.sessionCurrentId++;
    const startDate = new Date();
    const lastSessionDate = null;
    
    const session: Session = { 
      ...insertSession, 
      id, 
      startDate,
      lastSessionDate,
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
      createdAt,
      maxQuota: insertSlot.maxQuota || 5,
      currentCount: insertSlot.currentCount || 0,
      isActive: insertSlot.isActive !== undefined ? insertSlot.isActive : true
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
    
    // Memastikan bahwa therapySlotId adalah null jika tidak disediakan
    const therapySlotId = insertAppointment.therapySlotId ?? null;
    
    // Memastikan bahwa timeSlot adalah null jika tidak disediakan
    const timeSlot = insertAppointment.timeSlot ?? null;
    
    // Memastikan bahwa registrationNumber adalah null jika tidak disediakan
    const registrationNumber = insertAppointment.registrationNumber ?? null;
    
    const appointment: Appointment = {
      ...insertAppointment,
      id,
      status,
      sessionId,
      notes,
      therapySlotId,
      timeSlot,
      registrationNumber
    };
    
    this.appointments.set(id, appointment);
    
    // Jika appointment terkait dengan slot terapi dan statusnya bukan cancelled,
    // increment jumlah penggunaan slot
    if (therapySlotId && status !== 'cancelled') {
      await this.incrementTherapySlotUsage(therapySlotId);
    }
    
    return appointment;
  }

  async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    
    // Jika status diubah dari aktif ke cancelled dan appointment terkait dengan slot terapi,
    // decrement jumlah penggunaan slot
    const wasActive = appointment.status !== 'cancelled';
    const nowCancelled = status === 'cancelled';
    
    const updatedAppointment: Appointment = {
      ...appointment,
      status
    };
    
    this.appointments.set(id, updatedAppointment);
    
    // Handle therapy slot usage update
    if (wasActive && nowCancelled && appointment.therapySlotId) {
      await this.decrementTherapySlotUsage(appointment.therapySlotId);
    }
    
    return updatedAppointment;
  }

  // Setting methods
  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settings.get(key);
  }
  
  async getAllSettings(): Promise<Setting[]> {
    return Array.from(this.settings.values());
  }
  
  async createSetting(insertSetting: InsertSetting): Promise<Setting> {
    const id = this.settingCurrentId++;
    const updatedAt = new Date();
    const setting: Setting = { ...insertSetting, id, updatedAt };
    this.settings.set(setting.key, setting);
    return setting;
  }
  
  async updateSetting(key: string, value: string, userId: number): Promise<Setting | undefined> {
    const existingSetting = this.settings.get(key);
    if (!existingSetting) return undefined;
    
    const updatedSetting: Setting = {
      ...existingSetting,
      value,
      updatedAt: new Date(),
      updatedBy: userId
    };
    
    this.settings.set(key, updatedSetting);
    return updatedSetting;
  }
  
  async deleteSetting(key: string): Promise<boolean> {
    const exists = this.settings.has(key);
    if (!exists) return false;
    
    this.settings.delete(key);
    return true;
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
    
    // Hitung jumlah pasien hari ini (dari appointment)
    const todayAppointments = await this.getAppointmentsByDate(today);
    const patientsToday = todayAppointments.length;
    
    // Hitung pendapatan hari ini (dari transaksi)
    const todayTransactions = Array.from(this.transactions.values())
      .filter(transaction => {
        const transactionDate = new Date(transaction.createdAt);
        transactionDate.setHours(0, 0, 0, 0);
        return transactionDate.getTime() === today.getTime();
      });
    
    let incomeToday = 0;
    todayTransactions.forEach(transaction => {
      incomeToday += parseInt(transaction.totalAmount, 10);
    });
    
    // Hitung jumlah produk terjual hari ini
    const productsSold = todayTransactions
      .filter(transaction => transaction.type === 'product')
      .length;
    
    // Hitung jumlah paket aktif
    const activePackages = Array.from(this.therapySessions.values())
      .filter(session => session.status === 'active')
      .length;
    
    return {
      patientsToday,
      incomeToday,
      productsSold,
      activePackages
    };
  }
  
  async getRecentActivities(limit: number = 5): Promise<any[]> {
    // Ambil transaksi terbaru
    const recentTransactions = Array.from(this.transactions.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map(transaction => ({
        type: 'transaction',
        data: transaction,
        timestamp: transaction.createdAt
      }));
    
    // Ambil appointment terbaru
    const recentAppointments = Array.from(this.appointments.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)
      .map(appointment => ({
        type: 'appointment',
        data: appointment,
        timestamp: appointment.date
      }));
    
    // Gabungkan dan urutkan berdasarkan timestamp
    const activities = [...recentTransactions, ...recentAppointments]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
    
    return activities;
  }

  // Registration Links methods
  async createRegistrationLink(userId: number, expiryHours: number, dailyLimit: number): Promise<RegistrationLink> {
    const id = this.registrationLinkCurrentId++;
    const now = new Date();
    const expiryTime = new Date(now);
    expiryTime.setHours(expiryTime.getHours() + expiryHours);
    
    // Generate a random code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    const registrationLink: RegistrationLink = {
      id,
      code: `TTS-${code}`,
      expiryTime,
      dailyLimit,
      currentRegistrations: 0,
      createdAt: now,
      isActive: true,
      createdBy: userId
    };
    
    this.registrationLinks.set(id, registrationLink);
    return registrationLink;
  }
  
  async getRegistrationLinkByCode(code: string): Promise<RegistrationLink | undefined> {
    return Array.from(this.registrationLinks.values())
      .find(link => link.code === code);
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

  // Initialize sample patients and appointments for testing
  private initSamplePatientsAndAppointments() {
    // Create sample patients
    const patient1: Patient = {
      id: 1,
      name: "Ahmad Santoso",
      phoneNumber: "08123456789",
      email: "ahmad@example.com",
      birthDate: "1985-05-12",
      gender: "Laki-laki",
      address: "Jl. Kebon Jeruk No. 15, Jakarta Barat",
      complaints: "Nyeri punggung dan pinggang",
      patientId: `P-${new Date().getFullYear()}-001`,
      createdAt: new Date(),
      therapySlotId: null
    };
    this.patients.set(patient1.id, patient1);
    this.patientCurrentId++;

    const patient2: Patient = {
      id: 2,
      name: "Siti Rahayu",
      phoneNumber: "08234567890",
      email: "siti@example.com",
      birthDate: "1990-08-21",
      gender: "Perempuan",
      address: "Jl. Melati No. 7, Jakarta Selatan",
      complaints: "Sakit kepala dan pundak kaku",
      patientId: `P-${new Date().getFullYear()}-002`,
      createdAt: new Date(),
      therapySlotId: null
    };
    this.patients.set(patient2.id, patient2);
    this.patientCurrentId++;

    const patient3: Patient = {
      id: 3,
      name: "Budi Hartono",
      phoneNumber: "08345678901",
      email: "budi@example.com",
      birthDate: "1978-11-03",
      gender: "Laki-laki",
      address: "Jl. Kamboja No. 25, Jakarta Timur",
      complaints: "Kesemutan di tangan dan kaki",
      patientId: `P-${new Date().getFullYear()}-003`,
      createdAt: new Date(),
      therapySlotId: null
    };
    this.patients.set(patient3.id, patient3);
    this.patientCurrentId++;

    // Get the first therapy slots of today for sample appointments
    const today = new Date();
    const slots = Array.from(this.therapySlots.values())
      .filter(slot => {
        const slotDate = new Date(slot.date);
        slotDate.setHours(0, 0, 0, 0);
        const todayDate = new Date(today);
        todayDate.setHours(0, 0, 0, 0);
        return slotDate.getTime() === todayDate.getTime();
      })
      .slice(0, 3);

    if (slots.length > 0) {
      // Create sample appointments for today
      const appointment1: Appointment = {
        id: 1,
        date: today,
        status: "Active",
        patientId: 1,
        therapySlotId: slots[0].id,
        timeSlot: slots[0].timeSlot,
        sessionId: null,
        registrationNumber: `REG-${format(today, 'yyyyMMdd')}-001`,
        notes: "Pasien baru, perlu pemeriksaan menyeluruh"
      };
      this.appointments.set(appointment1.id, appointment1);
      this.appointmentCurrentId++;
      this.incrementTherapySlotUsage(slots[0].id);

      if (slots.length > 1) {
        const appointment2: Appointment = {
          id: 2,
          date: today,
          status: "Active",
          patientId: 2,
          therapySlotId: slots[1].id,
          timeSlot: slots[1].timeSlot,
          sessionId: null,
          registrationNumber: `REG-${format(today, 'yyyyMMdd')}-002`,
          notes: "Pasien rutin, telah melakukan 3 sesi sebelumnya"
        };
        this.appointments.set(appointment2.id, appointment2);
        this.appointmentCurrentId++;
        this.incrementTherapySlotUsage(slots[1].id);
      }

      if (slots.length > 2) {
        const appointment3: Appointment = {
          id: 3,
          date: today,
          status: "Active",
          patientId: 3,
          therapySlotId: slots[2].id,
          timeSlot: slots[2].timeSlot,
          sessionId: null,
          registrationNumber: `REG-${format(today, 'yyyyMMdd')}-003`,
          notes: "Terapi lanjutan untuk masalah kesemutan"
        };
        this.appointments.set(appointment3.id, appointment3);
        this.appointmentCurrentId++;
        this.incrementTherapySlotUsage(slots[2].id);
      }
    }

    console.log("Sample patients and appointments diinisialisasi");
  }
}

export const storage = new MemStorage();