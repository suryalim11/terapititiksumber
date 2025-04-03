import { pgTable, text, serial, integer, boolean, timestamp, json, decimal } from "drizzle-orm/pg-core";
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
  paymentMethod: text("payment_method").notNull(),
  items: json("items").notNull(), // array of purchased items (packages and products)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  patientId: true,
  totalAmount: true,
  paymentMethod: true,
  items: true,
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
  date: timestamp("date").notNull(), // Tanggal sesi
  timeSlot: text("time_slot").notNull(), // Contoh: "10:00-11:00"
  maxQuota: integer("max_quota").notNull().default(6), // Jumlah maksimal pasien per sesi
  currentCount: integer("current_count").notNull().default(0), // Jumlah pasien yang sudah mendaftar
  isActive: boolean("is_active").notNull().default(true), // Status slot (aktif/non-aktif)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTherapySlotSchema = createInsertSchema(therapySlots).pick({
  date: true,
  timeSlot: true,
  maxQuota: true,
  currentCount: true,
  isActive: true,
});

// Appointment Schema
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  sessionId: integer("session_id"),
  therapySlotId: integer("therapy_slot_id"), // Referensi ke slot terapi yang dipilih
  date: timestamp("date").notNull(),
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type TherapySlot = typeof therapySlots.$inferSelect;
export type InsertTherapySlot = z.infer<typeof insertTherapySlotSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type RegistrationLink = typeof registrationLinks.$inferSelect;
export type InsertRegistrationLink = z.infer<typeof insertRegistrationLinkSchema>;

// Medical History Schema
export const medicalHistories = pgTable("medical_histories", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  appointmentId: integer("appointment_id"),
  complaint: text("complaint").notNull(),
  beforeBloodPressure: text("before_blood_pressure"),
  afterBloodPressure: text("after_blood_pressure"),
  notes: text("notes"),
  treatmentDate: timestamp("treatment_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMedicalHistorySchema = createInsertSchema(medicalHistories).pick({
  patientId: true,
  appointmentId: true,
  complaint: true,
  beforeBloodPressure: true,
  afterBloodPressure: true,
  notes: true,
  treatmentDate: true,
});

export type ConfirmationToken = typeof confirmationTokens.$inferSelect;
export type InsertConfirmationToken = z.infer<typeof insertConfirmationTokenSchema>;

export type MedicalHistory = typeof medicalHistories.$inferSelect;
export type InsertMedicalHistory = z.infer<typeof insertMedicalHistorySchema>;
