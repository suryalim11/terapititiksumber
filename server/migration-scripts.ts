import { db } from './db';
import { sql } from 'drizzle-orm';
import { therapySlots } from '@shared/schema';

/**
 * Script migrasi untuk menambahkan kolom time_slot_key ke tabel therapy_slots
 * dan mengisinya dengan nilai yang dihitung dari kolom date dan time_slot yang sudah ada
 */
export async function addTimeSlotKeyColumn() {
  console.log('Starting migration: adding time_slot_key column to therapy_slots table...');
  
  try {
    // 1. Cek apakah kolom time_slot_key sudah ada
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'therapy_slots' AND column_name = 'time_slot_key'
    `);
    
    if (columnCheck.rows.length === 0) {
      // 2. Tambahkan kolom time_slot_key jika belum ada
      console.log('Column time_slot_key does not exist. Adding it now...');
      await db.execute(sql`
        ALTER TABLE therapy_slots 
        ADD COLUMN time_slot_key TEXT
      `);
      console.log('Column time_slot_key added successfully');
      
      // 3. Update nilai time_slot_key berdasarkan kombinasi date dan time_slot
      console.log('Updating time_slot_key values for existing records...');
      await db.execute(sql`
        UPDATE therapy_slots 
        SET time_slot_key = CONCAT(
          SUBSTRING(date, 1, 10), 
          '_', 
          time_slot
        )
      `);
      console.log('Updated time_slot_key values for existing records');
      
      // 4. Buat kolom time_slot_key NOT NULL
      console.log('Setting time_slot_key to NOT NULL...');
      await db.execute(sql`
        ALTER TABLE therapy_slots 
        ALTER COLUMN time_slot_key SET NOT NULL
      `);
      console.log('Column time_slot_key is now NOT NULL');
      
      // 5. Tambahkan UNIQUE constraint pada kolom time_slot_key
      console.log('Adding UNIQUE constraint on time_slot_key...');
      await db.execute(sql`
        ALTER TABLE therapy_slots 
        ADD CONSTRAINT unique_time_slot_key UNIQUE (time_slot_key)
      `);
      console.log('UNIQUE constraint added for time_slot_key');
      
      // 6. Tambahkan UNIQUE constraint pada kombinasi date dan time_slot
      console.log('Adding UNIQUE constraint on date and time_slot combination...');
      await db.execute(sql`
        ALTER TABLE therapy_slots 
        ADD CONSTRAINT unique_date_time_slot UNIQUE (date, time_slot)
      `);
      console.log('UNIQUE constraint added for date and time_slot combination');
      
      return { success: true, message: 'Migration completed successfully' };
    } else {
      console.log('Column time_slot_key already exists. No migration needed.');
      return { success: true, message: 'No migration needed' };
    }
  } catch (error) {
    console.error('Error during migration:', error);
    return { success: false, error: error.message };
  }
}

// Fungsi untuk menjalankan semua migrasi
export async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    // Jalankan migrasi untuk menambahkan kolom time_slot_key
    const timeSlotKeyResult = await addTimeSlotKeyColumn();
    console.log('Time slot key migration result:', timeSlotKeyResult);
    
    // Tambahkan migrasi lain di sini jika diperlukan
    
    console.log('All migrations completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Error during migrations:', error);
    return { success: false, error: error.message };
  }
}

// Export fungsi-fungsi migrator agar bisa dipanggil dari file lain
export const migrator = {
  addTimeSlotKeyColumn,
  runMigrations
};