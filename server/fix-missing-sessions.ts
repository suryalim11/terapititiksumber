import { db } from './db';
import { sessions, transactions, packages } from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { storage } from './storage';

// Function to fix missing sessions for transactions that should have them
export async function fixMissingPackageSessions() {
  console.log("Starting fix for missing package sessions...");
  
  try {
    // Get all transactions with package items that don't have a session
    const transactionsWithoutSessions = await db.query.transactions.findMany({
      where: and(
        // Only include transactions where the items array contains a package
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements(${transactions.items}::jsonb) AS item 
          WHERE (item->>'type') = 'package'
        )`,
        // And there's no corresponding session
        sql`NOT EXISTS (
          SELECT 1 FROM sessions WHERE sessions.transaction_id = ${transactions.id}
        )`
      ),
      orderBy: [desc(transactions.createdAt)]
    });
    
    console.log(`Found ${transactionsWithoutSessions.length} transactions with packages but no sessions`);
    
    const results = {
      processed: 0,
      created: 0,
      skipped: 0,
      errors: [] as any[]
    };
    
    // Process each transaction
    for (const transaction of transactionsWithoutSessions) {
      results.processed++;
      
      try {
        // Parse the items array to find packages
        const items = transaction.items as any[];
        
        // Check if this transaction is for using an existing package
        const isUsingExistingPackage = items.some(
          item => item.type === "package" && 
          item.description && 
          item.description.includes("menggunakan sisa paket")
        );
        
        // Skip transactions that are meant to use existing packages, not create new ones
        if (isUsingExistingPackage) {
          console.log(`Skipping transaction ${transaction.id} (${transaction.transactionId}) as it uses an existing package`);
          results.skipped++;
          continue;
        }
        
        // For each package item, create a session
        for (const item of items) {
          if (item.type === 'package') {
            const package_ = await db.query.packages.findFirst({
              where: eq(packages.id, item.id)
            });
            
            if (package_) {
              // Create the missing session
              const sessionData = {
                patientId: transaction.patientId,
                transactionId: transaction.id,
                packageId: item.id,
                totalSessions: package_.sessions || 1
              };
              
              // Create the missing session
              await storage.createSession(sessionData);
              results.created++;
              console.log(`Created session for package ${item.id} in transaction ${transaction.id} (${transaction.transactionId})`);
            } else {
              console.log(`Package ${item.id} not found for transaction ${transaction.id}`);
              results.errors.push({
                transactionId: transaction.id,
                packageId: item.id,
                error: "Package not found"
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing transaction ${transaction.id}:`, error);
        results.errors.push({
          transactionId: transaction.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    console.log("Fix completed with results:", results);
    return {
      success: true,
      ...results
    };
  } catch (error) {
    console.error("Error fixing missing package sessions:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}