import { Request, Response, Router } from 'express';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

// Create router
const router = Router();

/**
 * Lightweight endpoint for updating appointment status
 * This implementation bypasses complex operations to avoid timeouts
 */
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // Log raw request body for debugging
    console.log("Request body raw:", req.body);
    
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ message: "Invalid request body" });
    }
    
    const { status } = req.body;
    
    // Log status value
    console.log(`[STATUS API] Received status update for appointment ${id}, status value: "${status}", type: ${typeof status}`);
    
    // Validate status
    const validStatuses = ['Active', 'Completed', 'Cancelled', 'Scheduled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status. Status must be one of: Active, Scheduled, Completed, Cancelled",
        receivedStatus: status
      });
    }
    
    // Log status update
    console.log(`[STATUS API] Updating appointment ${id} status to: ${status}`);
    
    // Get appointment to check if it exists and for background processing
    const appointment = await db.query.appointments.findFirst({
      where: eq(schema.appointments.id, id)
    });
    
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    
    // Update appointment status directly in database
    const result = await db
      .update(schema.appointments)
      .set({ status })
      .where(eq(schema.appointments.id, id))
      .returning();
      
    if (!result || result.length === 0) {
      return res.status(404).json({ message: "Failed to update appointment" });
    }
    
    const updatedAppointment = result[0];
    
    // Schedule background processing for therapy slot usage and session connection
    setTimeout(async () => {
      try {
        console.log(`[BACKGROUND] Processing status change side effects for appointment ${id}`);
        
        // Special handling for Cancellation status
        if (status === 'Cancelled' && appointment.status !== 'Cancelled' && appointment.therapySlotId) {
          // Directly update therapy slot usage
          await db
            .update(schema.therapySlots)
            .set({ 
              currentCount: db.raw(`GREATEST(current_count - 1, 0)`) 
            })
            .where(eq(schema.therapySlots.id, appointment.therapySlotId));
            
          console.log(`[BACKGROUND] Decremented therapy slot ${appointment.therapySlotId} usage for cancelled appointment`);
        }
        
        // Handle Completed status for sessions
        if (status === 'Completed' && appointment.status !== 'Completed') {
          // Process session if exists
          if (appointment.sessionId) {
            // Get session
            const session = await db.query.sessions.findFirst({
              where: eq(schema.sessions.id, appointment.sessionId)
            });
            
            if (session) {
              // Update session usage count
              await db
                .update(schema.sessions)
                .set({ 
                  sessionsUsed: session.sessionsUsed + 1 
                })
                .where(eq(schema.sessions.id, session.id));
                
              console.log(`[BACKGROUND] Incremented session ${session.id} usage count`);
            }
          } 
          else {
            console.log(`[BACKGROUND] No session to update for appointment ${id}`);
          }
        }
      } catch (error) {
        console.error(`[BACKGROUND] Error processing status update side effects:`, error);
      }
    }, 100);
    
    // Get patient data if available
    let responseAppointment = updatedAppointment;
    if (updatedAppointment.patientId) {
      try {
        const patient = await db.query.patients.findFirst({
          where: eq(schema.patients.id, updatedAppointment.patientId)
        });
        
        if (patient) {
          responseAppointment = {
            ...updatedAppointment,
            patient
          };
        }
      } catch (error) {
        console.error(`[STATUS API] Error fetching patient data:`, error);
      }
    }
    
    console.log(`[STATUS API] Appointment updated successfully`);
    return res.json(responseAppointment);
  } catch (error) {
    console.error(`[STATUS API] Error updating appointment status:`, error);
    return res.status(500).json({ message: "Server error updating appointment status" });
  }
});

export default router;