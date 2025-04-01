import { 
  users, patients, products, packages, transactions, sessions, appointments,
  type User, type InsertUser, type Patient, type InsertPatient,
  type Product, type InsertProduct, type Package, type Transaction,
  type InsertTransaction, type Session, type InsertSession,
  type Appointment, type InsertAppointment
} from "@shared/schema";
import { format } from "date-fns";

// Storage interface
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Patients
  getPatient(id: number): Promise<Patient | undefined>;
  getAllPatients(): Promise<Patient[]>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  
  // Products
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProductStock(id: number, stockChange: number): Promise<Product | undefined>;
  
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
  
  // Appointments
  getAppointment(id: number): Promise<Appointment | undefined>;
  getAppointmentsByDate(date: Date): Promise<Appointment[]>;
  getAppointmentsByPatient(patientId: number): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined>;
  
  // Dashboard data
  getDailyStats(): Promise<{
    patientsToday: number;
    incomeToday: number;
    productsSold: number;
    activePackages: number;
  }>;
  getRecentActivities(limit?: number): Promise<any[]>;
}

// Memory Storage Implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private patients: Map<number, Patient>;
  private products: Map<number, Product>;
  private packageList: Map<number, Package>;
  private transactions: Map<number, Transaction>;
  private therapySessions: Map<number, Session>;
  private appointments: Map<number, Appointment>;
  
  private userCurrentId: number;
  private patientCurrentId: number;
  private productCurrentId: number;
  private packageCurrentId: number;
  private transactionCurrentId: number;
  private sessionCurrentId: number;
  private appointmentCurrentId: number;

  constructor() {
    this.users = new Map();
    this.patients = new Map();
    this.products = new Map();
    this.packageList = new Map();
    this.transactions = new Map();
    this.therapySessions = new Map();
    this.appointments = new Map();
    
    this.userCurrentId = 1;
    this.patientCurrentId = 1;
    this.productCurrentId = 1;
    this.packageCurrentId = 1;
    this.transactionCurrentId = 1;
    this.sessionCurrentId = 1;
    this.appointmentCurrentId = 1;
    
    // Initialize with default data
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create a default admin user
    this.createUser({
      username: "admin",
      password: "admin123", // In a real app, would be hashed
      name: "Administrator",
      role: "admin"
    });
    
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
    this.createProduct({
      name: "Minyak Pijat Herbal",
      price: "85000",
      stock: 25,
      description: "Minyak pijat dengan bahan herbal alami"
    });
    
    this.createProduct({
      name: "Bantal Terapi",
      price: "120000",
      stock: 15,
      description: "Bantal khusus untuk terapi"
    });
    
    this.createProduct({
      name: "Krim Pijat",
      price: "65000",
      stock: 30,
      description: "Krim pijat untuk relaksasi"
    });
    
    this.createProduct({
      name: "Minyak Esensial Lavender",
      price: "95000",
      stock: 20,
      description: "Minyak esensial lavender untuk aromaterapi"
    });
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
    const patient: Patient = { ...insertPatient, id, patientId, createdAt };
    this.patients.set(id, patient);
    return patient;
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

  // Appointment methods
  async getAppointment(id: number): Promise<Appointment | undefined> {
    return this.appointments.get(id);
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

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const id = this.appointmentCurrentId++;
    const appointment: Appointment = { 
      ...insertAppointment, 
      id, 
      status: 'scheduled' 
    };
    this.appointments.set(id, appointment);
    return appointment;
  }

  async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
    const appointment = this.appointments.get(id);
    if (!appointment) return undefined;
    
    const updatedAppointment: Appointment = {
      ...appointment,
      status
    };
    
    this.appointments.set(id, updatedAppointment);
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
}

// Export a singleton instance
export const storage = new MemStorage();
