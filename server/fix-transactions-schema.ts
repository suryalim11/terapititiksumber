import { db } from './db';
import { sql } from 'drizzle-orm';

// This script will add missing columns to the transactions table
async function fixTransactionsTable() {
  try {
    console.log('Running database schema fix for transactions table...');
    console.log('Starting schema fix for transactions table...');

    // Add credit_amount column if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'transactions' AND column_name = 'credit_amount'
        ) THEN 
          ALTER TABLE transactions 
          ADD COLUMN credit_amount DECIMAL(10, 2) NOT NULL DEFAULT '0';
        END IF;
      END $$;
    `);
    console.log('credit_amount column check complete');

    // Add isPaid column if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'transactions' AND column_name = 'is_paid'
        ) THEN 
          ALTER TABLE transactions 
          ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT TRUE;
        END IF;
      END $$;
    `);
    console.log('is_paid column check complete');

    // Add paidAmount column if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'transactions' AND column_name = 'paid_amount'
        ) THEN 
          ALTER TABLE transactions 
          ADD COLUMN paid_amount DECIMAL(10, 2) NOT NULL DEFAULT '0';
        END IF;
      END $$;
    `);
    console.log('paid_amount column check complete');

    // Add debtAmount column if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'transactions' AND column_name = 'debt_amount'
        ) THEN 
          ALTER TABLE transactions 
          ADD COLUMN debt_amount DECIMAL(10, 2) NOT NULL DEFAULT '0';
          
          -- Update nilai debt_amount untuk semua transaksi yang ada
          UPDATE transactions 
          SET debt_amount = GREATEST(0, total_amount - paid_amount)
          WHERE 1=1;
        END IF;
      END $$;
    `);
    console.log('debt_amount column check complete');

    console.log('Schema fix for transactions table completed successfully');
  } catch (error) {
    console.error('Error fixing transactions table schema:', error);
    throw error;
  }
}

// Export the function to be used in routes.ts
export default fixTransactionsTable;