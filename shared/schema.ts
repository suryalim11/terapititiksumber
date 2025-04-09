import { pgTable, text, serial, integer, boolean, timestamp, json, decimal, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Registration Link Schema
export const registrationLinks = pgTable("registration_links", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  expiryTime: timestamp("expiry_time").notNull(),
  dailyLimit: integer("daily_limit").notNull(),
  currentRegistrations: integer("current_registrations").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").notNull(),
  specificDate: text("specific_date"),
});

// User Schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").default("admin").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
});

// Patient Schema
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  patientId: text("patient_id").notNull().unique(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  email: text("email"),
  birthDate: text("birth_date").notNull(),
  gender: text("gender").notNull(),
  address: text("address").notNull(),
  complaints: text("complaints").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  therapySlotId: integer("therapy_slot_id"), // Foreign key to therapy_slots
});

export const insertPatientSchema = createInsertSchema(patients).pick({
  name: true,
  phoneNumber: true,
  email: true,
  birthDate: true,
  gender: true,
  address: true,
  complaints: true,
  therapySlotId: true,
});

// Product Schema
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  price: true,
  stock: true,
  description: true,
});

// Package Schema (Therapy Packages)
export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sessions: integer("sessions").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
});

// Definisikan schema dengan validasi khusus untuk package
export const insertPackageSchema = z.object({
  name: z.string().min(3, { message: "Nama paket harus minimal 3 karakter" }),
  sessions: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().int().min(1, { message: "Jumlah sesi harus minimal 1" })
  ),
  price: z.union([
    z.string(),
    z.number().transform(n => n.toString())
  ]),
  description: z.string().nullable().optional(),
});

// Transaction Schema
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  transactionId: text("transaction_id").notNull().unique(),
  patientId: integer("patient_id").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0"),
  paymentMethod: text("payment_method").notNull(),
  items: json("items").notNull(), // array of purchased items (packages and products)
  creditAmount: decimal("credit_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  isPaid: boolean("is_paid").default(true).notNull(), // true=lunas, false=utang
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  debtAmount: decimal("debt_amount", { precision: 10, scale: 2 }).default("0").notNull(), // Jumlah hutang
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: json("metadata"), // Untuk menyimpan informasi tambahan seperti displayName
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  patientId: true,
  totalAmount: true,
  discount: true,
  subtotal: true,
  paymentMethod: true,
  items: true,
  creditAmount: true,
  isPaid: true,
  paidAmount: true,
  debtAmount: true,
  metadata: true,
});

// Session Schema (For tracking therapy sessions)
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  transactionId: integer("transaction_id").notNull(),
  packageId: integer("package_id").notNull(),
  totalSessions: integer("total_sessions").notNull(),
  sessionsUsed: integer("sessions_used").notNull().default(0),
  status: text("status").notNull().default("active"), // active, completed, expired
  startDate: timestamp("start_date").defaultNow().notNull(),
  lastSessionDate: timestamp("last_session_date"),
});

export const insertSessionSchema = createInsertSchema(sessions).pick({
  patientId: true,
  transactionId: true,
  packageId: true,
  totalSessions: true,
});

// Therapy Schedule Schema (Slot Terapi)
export const therapySlots = pgTable("therapy_slots", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // Tanggal sesi - menggunakan TEXT untuk menghindari masalah konversi
  timeSlot: text("time_slot").notNull(), // Contoh: "10:00-11:00"
  maxQuota: integer("max_quota").notNull().default(6), // Jumlah maksimal pasien per sesi
  currentCount: integer("current_count").notNull().default(0), // Jumlah pasien yang sudah mendaftar
  isActive: boolean("is_active").notNull().default(true), // Status slot (aktif/non-aktif)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTherapySlotSchema = createInsertSchema(therapySlots)
  .pick({
    date: true,
    timeSlot: true,
    maxQuota: true,
    currentCount: true,
    isActive: true,
  })
  .extend({
    // Preprocessor untuk mengkonversi string tanggal menjadi string format YYYY-MM-DD
    date: z.preprocess(
      (val) => {
        // Jika sudah berupa string dengan format YYYY-MM-DD, kembalikan langsung
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
          return val;
        }
        
        // Jika berupa Date object, konversi ke string YYYY-MM-DD
        if (val instanceof Date) {
          const year = val.getFullYear();
          const month = String(val.getMonth() + 1).padStart(2, '0');
          const day = String(val.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        // Jika berupa string dengan format lain, coba parse dan konversi
        if (typeof val === 'string') {
          try {
            const date = new Date(val);
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
          } catch (e) {
            // Jika gagal parsing, lanjut ke return default
          }
        }
        
        // Default fallback: format tanggal hari ini
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
      z.string()
    ),
  });

// Appointment Schema
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  sessionId: integer("session_id"),
  therapySlotId: integer("therapy_slot_id"), // Referensi ke slot terapi yang dipilih
  date: text("date").notNull(), // Ubah dari timestamp ke text untuk konsistensi
  timeSlot: text("time_slot"), // Menyimpan time_slot yang dipilih
  registrationNumber: text("registration_number"), // Nomor registrasi unik
  status: text("status").notNull().default("Active"), // Active, Cancelled, Completed
  notes: text("notes"),
});

export const insertAppointmentSchema = createInsertSchema(appointments).pick({
  patientId: true,
  sessionId: true,
  therapySlotId: true,
  date: true,
  timeSlot: true,
  registrationNumber: true,
  notes: true,
  status: true,
}).extend({
  // Memastikan date selalu dalam bentuk string
  date: z.preprocess(
    (val) => {
      // Jika sudah string, langsung gunakan
      if (typeof val === 'string') {
        return val;
      }
      
      // Jika Date object, konversi ke format YYYY-MM-DD
      if (val instanceof Date) {
        const year = val.getFullYear();
        const month = String(val.getMonth() + 1).padStart(2, '0');
        const day = String(val.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      // Default fallback: hari ini
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    z.string()
  )
});

// Registration Link insertSchema
export const insertRegistrationLinkSchema = createInsertSchema(registrationLinks).pick({
  code: true,
  expiryTime: true,
  dailyLimit: true,
  createdBy: true,
  specificDate: true,
});

// Confirmation Token Schema
export const confirmationTokens = pgTable("confirmation_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  patientId: integer("patient_id").notNull(),
  appointmentId: integer("appointment_id").notNull(),
  expiryTime: timestamp("expiry_time").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isUsed: boolean("is_used").notNull().default(false),
});

export const insertConfirmationTokenSchema = createInsertSchema(confirmationTokens).pick({
  token: true,
  patientId: true,
  appointmentId: true,
  expiryTime: true,
});

// Tabel pelunasan utang
export const debtPayments = pgTable("debt_payments", {
  id: serial("id").primaryKey(),
  transactionId: integer("transaction_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentDate: timestamp("payment_date").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDebtPaymentSchema = createInsertSchema(debtPayments).pick({
  transactionId: true,
  amount: true,
  paymentMethod: true,
  notes: true
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;

export type Transaction = typeof transactions.$inferSelect & {
  patient?: {
    id: number;
    name: string;
    patientId: string;
  };
};
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type TherapySlot = typeof therapySlots.$inferSelect;
export type InsertTherapySlot = z.infer<typeof insertTherapySlotSchema>;

export type Appointment = typeof appointments.$inferSelect & {
  patient?: Patient | {
    id: number;
    name: string;
    patientId: string;
  };
  therapySlot?: TherapySlot;
};
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type RegistrationLink = typeof registrationLinks.$inferSelect;
export type InsertRegistrationLink = z.infer<typeof insertRegistrationLinkSchema>;

export type DebtPayment = typeof debtPayments.$inferSelect;
export type InsertDebtPayment = z.infer<typeof insertDebtPaymentSchema>;

// Medical History Schema
export const medicalHistories = pgTable("medical_histories", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  appointmentId: integer("appointment_id"),
  complaint: text("complaint").notNull(),
  beforeBloodPressure: text("before_blood_pressure"),
  afterBloodPressure: text("after_blood_pressure"),
  heartRate: text("heart_rate"), // Detak jantung
  pulseRate: text("pulse_rate"), // Tekanan nadi
  weight: text("weight"), // Berat badan
  notes: text("notes"),
  // Kolom ini memiliki tipe DATE di database, jadi kita harus mendefinisikannya dengan benar
  treatmentDate: date("treatment_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMedicalHistorySchema = createInsertSchema(medicalHistories)
  .pick({
    patientId: true,
    appointmentId: true,
    complaint: true,
    beforeBloodPressure: true,
    afterBloodPressure: true,
    heartRate: true,
    pulseRate: true,
    weight: true,
    notes: true,
    treatmentDate: true,
  })
  .extend({
    // Preprocessor untuk mengkonversi string tanggal menjadi objek Date yang valid
    treatmentDate: z.preprocess(
      (val) => {
        // Jika sudah berupa date object, kembalikan langsung
        if (val instanceof Date) return val;
        
        // Jika string, coba parse menjadi Date
        if (typeof val === 'string') {
          const date = new Date(val);
          // Validasi tanggal valid
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
        // Jika tidak valid, gunakan tanggal sekarang
        return new Date();
      },
      z.date()
    ),
  });

export type ConfirmationToken = typeof confirmationTokens.$inferSelect;
export type InsertConfirmationToken = z.infer<typeof insertConfirmationTokenSchema>;

export type MedicalHistory = typeof medicalHistories.$inferSelect;
export type InsertMedicalHistory = z.infer<typeof insertMedicalHistorySchema>;

// Patient Relationships Schema - untuk mengaitkan pasien yang memiliki nomor telepon yang sama
export const patientRelationships = pgTable("patient_relationships", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  relatedPatientId: integer("related_patient_id").notNull(),
  relationshipType: text("relationship_type").default("phone_number_shared").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPatientRelationshipSchema = createInsertSchema(patientRelationships).pick({
  patientId: true,
  relatedPatientId: true,
  relationshipType: true,
});

export type PatientRelationship = typeof patientRelationships.$inferSelect;
export type InsertPatientRelationship = z.infer<typeof insertPatientRelationshipSchema>;
