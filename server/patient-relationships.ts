import { db } from "./db";
import * as schema from "../shared/schema";
import { eq, and, ne, or, inArray, desc } from "drizzle-orm";
import type { 
  Patient, PatientRelationship, InsertPatientRelationship,
  MedicalHistory 
} from "@shared/schema";

// Fungsi untuk mendapatkan pasien berdasarkan nomor telepon
export async function getPatientsByPhoneNumber(phoneNumber: string): Promise<Patient[]> {
  try {
    const patients = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.phoneNumber, phoneNumber));
    
    return patients;
  } catch (error) {
    console.error('[DB] Error getting patients by phone number:', error);
    return [];
  }
}

// Fungsi untuk mendapatkan pasien yang terkait (berdasarkan nomor telepon yang sama)
export async function getRelatedPatients(patientId: number): Promise<Patient[]> {
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

// Fungsi untuk membuat relasi pasien
export async function createPatientRelationship(relationship: InsertPatientRelationship): Promise<PatientRelationship> {
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

// Fungsi untuk mendapatkan relasi pasien
export async function getPatientRelationships(patientId: number): Promise<PatientRelationship[]> {
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

// Fungsi untuk mendapatkan riwayat medis berdasarkan nomor telepon
export async function getMedicalHistoriesByPhoneNumber(phoneNumber: string): Promise<MedicalHistory[]> {
  try {
    // First get all patients with this phone number
    const patients = await getPatientsByPhoneNumber(phoneNumber);
    
    if (patients.length === 0) {
      return [];
    }
    
    // Extract patient IDs
    const patientIds = patients.map(p => p.id);
    
    // Get all medical histories for these patients
    const histories = await db.select()
      .from(schema.medicalHistories)
      .where(inArray(schema.medicalHistories.patientId, patientIds))
      .orderBy(desc(schema.medicalHistories.treatmentDate));
    
    // Pastikan setiap record memiliki treatmentDate yang valid sebagai string
    return histories.map(record => {
      // Periksa apakah treatmentDate masih valid
      if (!record.treatmentDate) {
        // Jika tidak ada treatmentDate, gunakan createdAt sebagai string format YYYY-MM-DD
        const createdAtStr = new Date(record.createdAt).toISOString().split('T')[0];
        return {
          ...record,
          treatmentDate: createdAtStr
        };
      }
      return record;
    });
  } catch (error) {
    console.error('[DB] Error getting medical histories by phone number:', error);
    return [];
  }
}

// Fungsi untuk mendapatkan semua ID pasien yang memiliki nomor telepon yang sama
export async function findAllRelatedPatientIds(patientId: number): Promise<number[]> {
  try {
    // Dapatkan pasien yang bersangkutan terlebih dahulu untuk mendapatkan nomor telepon
    const [patient] = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.id, patientId));
    
    if (!patient) {
      return [patientId]; // Kembalikan hanya ID yang diberikan jika pasien tidak ditemukan
    }
    
    // Cari semua pasien dengan nomor telepon yang sama (termasuk dirinya sendiri)
    const allPatients = await db.select()
      .from(schema.patients)
      .where(eq(schema.patients.phoneNumber, patient.phoneNumber));
    
    // Ekstrak semua ID
    return allPatients.map(p => p.id);
  } catch (error) {
    console.error('[DB] Error finding all related patient IDs:', error);
    return [patientId]; // Kembalikan hanya ID yang diberikan jika terjadi kesalahan
  }
}