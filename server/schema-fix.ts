import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Migrasi untuk menambahkan kolom debt_amount ke tabel transactions
 * Juga akan mengkalkulasi nilai debt_amount berdasarkan total_amount - paid_amount
 */
export async function addDebtAmountColumn() {
  try {
    console.log("Running database schema fix for transactions table...");
    console.log("Starting schema fix for transactions table...");

    // Periksa apakah kolom debt_amount sudah ada
    try {
      await db.execute(sql`SELECT debt_amount FROM transactions LIMIT 1`);
      console.log("debt_amount column already exists");
    } catch (error) {
      // Kolom belum ada, tambahkan
      console.log("Adding debt_amount column to transactions table...");
      await db.execute(sql`ALTER TABLE transactions ADD COLUMN debt_amount DECIMAL(10, 2) NOT NULL DEFAULT 0`);
      console.log("debt_amount column added successfully");
      
      // Update nilai debt_amount untuk semua transaksi yang ada
      console.log("Updating debt_amount values for existing transactions...");
      await db.execute(sql`
        UPDATE transactions 
        SET debt_amount = GREATEST(0, total_amount - paid_amount)
        WHERE 1=1
      `);
      console.log("debt_amount values updated successfully");
    }

    console.log("Schema fix for transactions table completed successfully");
    return { success: true, message: "Database schema fix completed successfully" };
  } catch (error) {
    console.error("Error fixing database schema:", error);
    return { success: false, message: "Error fixing database schema", error };
  }
}