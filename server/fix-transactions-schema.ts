import { db } from './db';
import { sql } from 'drizzle-orm';

// This script will add missing columns to the transactions table
async function fixTransactionsTable() {
  try {
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
    
    // Add setAsCredit column if it doesn't exist
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'transactions' AND column_name = 'set_as_credit'
        ) THEN 
          ALTER TABLE transactions 
          ADD COLUMN set_as_credit BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;
      END $$;
    `);
    console.log('set_as_credit column check complete');

    console.log('Schema fix for transactions table completed successfully');
  } catch (error) {
    console.error('Error fixing transactions table schema:', error);
    throw error;
  }
}

// Export the function to be used in routes.ts
export default fixTransactionsTable;