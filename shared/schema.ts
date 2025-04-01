import { pgTable, text, serial, integer, boolean, timestamp, json, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  birthDate: text("birth_date").notNull(),
  address: text("address").notNull(),
  complaints: text("complaints").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPatientSchema = createInsertSchema(patients).pick({
  name: true,
  birthDate: true,
  address: true,
  complaints: true,
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

// Appointment Schema
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  sessionId: integer("session_id"),
  date: timestamp("date").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled
  notes: text("notes"),
});

export const insertAppointmentSchema = createInsertSchema(appointments).pick({
  patientId: true,
  sessionId: true,
  date: true,
  notes: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Package = typeof packages.$inferSelect;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
