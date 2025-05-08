import { db } from './db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Function to fix Darukni session from 1/12 to 2/12
 * This will update the sessionsUsed field in the specific session for Darukni
 */
export async function fixDarukniSession() {
  console.log("Starting Darukni session fix...");
  
  try {
    // Specific patient ID for Darukni
    const patientName = "Darukni";
    
    // Find Darukni's patient ID
    const [patient] = await db
      .select()
      .from(schema.patients)
      .where(eq(schema.patients.name, patientName));
    
    if (!patient) {
      console.log(`No patient found with name ${patientName}`);
      return {
        success: false,
        message: `No patient found with name ${patientName}`
      };
    }
    
    console.log(`Found patient with ID ${patient.id} and name ${patient.name}`);
    
    // Find active session for Darukni
    const sessions = await db
      .select()
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.patientId, patient.id),
          eq(schema.sessions.status, "active")
        )
      );
    
    if (!sessions || sessions.length === 0) {
      console.log(`No active sessions found for patient ${patientName}`);
      return {
        success: false,
        message: `No active sessions found for patient ${patientName}`
      };
    }
    
    console.log(`Found ${sessions.length} active sessions for ${patientName}`);
    
    // Find the specific 12-session package (Darukni's package)
    const targetSession = sessions.find(s => s.totalSessions === 12);
    
    if (!targetSession) {
      console.log(`No 12-session package found for ${patientName}`);
      return {
        success: false,
        message: `No 12-session package found for ${patientName}`
      };
    }
    
    console.log(`Found target session ID ${targetSession.id} with ${targetSession.sessionsUsed}/${targetSession.totalSessions}`);
    
    // Update session to set sessionsUsed = 2
    const [updatedSession] = await db
      .update(schema.sessions)
      .set({ sessionsUsed: 2 })
      .where(eq(schema.sessions.id, targetSession.id))
      .returning();
    
    console.log(`Successfully updated session. New value: ${updatedSession.sessionsUsed}/${updatedSession.totalSessions}`);
    
    return {
      success: true,
      message: `Successfully updated Darukni's sessions from ${targetSession.sessionsUsed}/12 to 2/12`,
      before: targetSession,
      after: updatedSession
    };
    
  } catch (error) {
    console.error("Error fixing Darukni session:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}