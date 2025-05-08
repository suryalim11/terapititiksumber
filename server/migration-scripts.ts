import { db } from './db';
import { sql } from 'drizzle-orm';
import { therapySlots } from '@shared/schema';
import { pool } from './db';

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
          COALESCE(SUBSTRING(date::text, 1, 10), date::text), 
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
/**
 * Script migrasi untuk menambahkan kolom global_quota ke tabel therapy_slots
 * dan mengisinya dengan nilai awal berdasarkan maxQuota
 */
export async function addGlobalQuotaColumn() {
  console.log('Starting migration: adding global_quota column to therapy_slots table...');
  
  try {
    // 1. Cek apakah kolom global_quota sudah ada
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'therapy_slots' AND column_name = 'global_quota'
    `);
    
    if (columnCheck.rows.length === 0) {
      // 2. Tambahkan kolom global_quota jika belum ada
      console.log('Column global_quota does not exist. Adding it now...');
      await db.execute(sql`
        ALTER TABLE therapy_slots 
        ADD COLUMN global_quota INTEGER
      `);
      console.log('Column global_quota added successfully');
      
      // 3. Hitung dan update nilai global_quota untuk setiap time_slot_key
      console.log('Calculating and updating global_quota values...');
      
      // Pertama, ambil semua time_slot_key unik
      const timeSlotKeysResult = await db.execute(sql`
        SELECT DISTINCT time_slot_key FROM therapy_slots WHERE time_slot_key IS NOT NULL
      `);
      
      // Untuk setiap time_slot_key, hitung total kuota dari semua slot dengan key yang sama
      for (const row of timeSlotKeysResult.rows) {
        const timeSlotKey = row.time_slot_key;
        
        // Hitung total maxQuota untuk time_slot_key ini
        const quotaResult = await db.execute(sql`
          SELECT SUM(max_quota) as total_quota 
          FROM therapy_slots 
          WHERE time_slot_key = ${timeSlotKey}
        `);
        
        const totalQuota = quotaResult.rows[0]?.total_quota || 0;
        
        // Update global_quota untuk semua slot dengan time_slot_key ini
        await db.execute(sql`
          UPDATE therapy_slots 
          SET global_quota = ${totalQuota} 
          WHERE time_slot_key = ${timeSlotKey}
        `);
      }
      
      console.log('Updated global_quota values for all therapy slots');
      
      // 4. Set global_quota NOT NULL dengan default 0
      console.log('Setting global_quota to NOT NULL with default 0...');
      await db.execute(sql`
        ALTER TABLE therapy_slots 
        ALTER COLUMN global_quota SET DEFAULT 0
      `);
      
      await db.execute(sql`
        UPDATE therapy_slots
        SET global_quota = max_quota
        WHERE global_quota IS NULL
      `);
      
      await db.execute(sql`
        ALTER TABLE therapy_slots 
        ALTER COLUMN global_quota SET NOT NULL
      `);
      
      console.log('Column global_quota is now NOT NULL with default 0');
      
      return { success: true, message: 'Global quota migration completed successfully' };
    } else {
      console.log('Column global_quota already exists. No migration needed.');
      return { success: true, message: 'No global quota migration needed' };
    }
  } catch (error) {
    console.error('Error during global quota migration:', error);
    return { success: false, error: String(error) };
  }
}

export async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    // Jalankan migrasi untuk menambahkan kolom time_slot_key
    const timeSlotKeyResult = await addTimeSlotKeyColumn();
    console.log('Time slot key migration result:', timeSlotKeyResult);
    
    // Jalankan migrasi untuk menambahkan kolom global_quota
    const globalQuotaResult = await addGlobalQuotaColumn();
    console.log('Global quota migration result:', globalQuotaResult);
    
    // Tambahkan migrasi lain di sini jika diperlukan
    
    console.log('All migrations completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Error during migrations:', error);
    return { success: false, error: String(error) };
  }
}

// Export fungsi-fungsi migrator agar bisa dipanggil dari file lain
/**
 * Fungsi untuk memperbarui nilai timeSlotKey dan globalQuota untuk semua slot yang masih kosong
 */
export async function updateEmptyTimeSlotKeys() {
  console.log('Starting update for empty time_slot_keys...');
  
  try {
    // 1. Cek slot terapi yang masih memiliki time_slot_key kosong
    const emptyKeysResult = await db.execute(sql`
      SELECT id, date, time_slot 
      FROM therapy_slots 
      WHERE time_slot_key IS NULL OR time_slot_key = ''
    `);
    
    const emptyCount = emptyKeysResult.rows.length;
    console.log(`Found ${emptyCount} therapy slots with empty time_slot_key`);
    
    if (emptyCount === 0) {
      return { 
        success: true, 
        message: 'No empty time_slot_keys found' 
      };
    }
    
    // 2. Update nilai time_slot_key untuk setiap slot yang kosong
    for (const row of emptyKeysResult.rows) {
      const slotId = row.id;
      const date = row.date;
      const timeSlot = row.time_slot;
      
      // Ekstrak tanggal dalam format YYYY-MM-DD
      const dateStr = date instanceof Date 
        ? date.toISOString().split('T')[0] 
        : String(date).split(' ')[0].split('T')[0];
      
      // Buat time_slot_key
      const timeSlotKey = `${dateStr}_${timeSlot}`;
      
      // Update nilai time_slot_key untuk slot ini
      await db.execute(sql`
        UPDATE therapy_slots 
        SET time_slot_key = ${timeSlotKey}
        WHERE id = ${slotId}
      `);
      
      console.log(`Updated slot ID ${slotId} with time_slot_key: ${timeSlotKey}`);
    }
    
    // 3. Update nilai global_quota untuk semua time_slot_key yang baru diperbarui
    console.log('Updating global_quota values for all therapy slots...');
    
    // Ambil semua time_slot_key unik
    const timeSlotKeysResult = await db.execute(sql`
      SELECT DISTINCT time_slot_key FROM therapy_slots WHERE time_slot_key IS NOT NULL
    `);
    
    // Untuk setiap time_slot_key, hitung total current_count
    for (const row of timeSlotKeysResult.rows) {
      const timeSlotKey = row.time_slot_key;
      
      // Hitung total current_count untuk time_slot_key ini
      const countResult = await db.execute(sql`
        SELECT SUM(current_count) as total_count 
        FROM therapy_slots 
        WHERE time_slot_key = ${timeSlotKey}
      `);
      
      const totalCount = countResult.rows[0]?.total_count || 0;
      
      // Update global_quota untuk semua slot dengan time_slot_key ini
      await db.execute(sql`
        UPDATE therapy_slots 
        SET global_quota = ${totalCount} 
        WHERE time_slot_key = ${timeSlotKey}
      `);
      
      console.log(`Updated global_quota to ${totalCount} for slots with time_slot_key: ${timeSlotKey}`);
    }
    
    return { 
      success: true, 
      message: `Updated ${emptyCount} slots with time_slot_key and recalculated global_quota values` 
    };
  } catch (error) {
    console.error('Error during time_slot_key update:', error);
    return { success: false, error: String(error) };
  }
}

export const migrator = {
  addTimeSlotKeyColumn,
  addGlobalQuotaColumn,
  updateEmptyTimeSlotKeys,
  runMigrations
};