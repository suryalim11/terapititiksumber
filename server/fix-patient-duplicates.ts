import express from 'express';
import { db } from './db';
import { sessions, patientRelationships } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { formatDateToWIB } from './utils';

// Esta função adiciona endpoints de API para corrigir pacientes duplicados
export function addFixPatientDuplicatesEndpoint(app: express.Express) {
  
  // Endpoint para listar pacientes duplicados com base no mesmo telefone
  app.get('/api/admin/detect-duplicate-patients', async (req, res) => {
    try {
      if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Query para encontrar números de telefone com múltiplos pacientes
      const duplicatePhones = await db.execute(
        `SELECT phone_number, COUNT(*) as count, array_agg(id) as patient_ids, array_agg(name) as names, array_agg(patient_id) as patient_display_ids
         FROM patients 
         GROUP BY phone_number 
         HAVING COUNT(*) > 1
         ORDER BY count DESC`
      );

      return res.json(duplicatePhones);
    } catch (error) {
      console.error('Error detecting duplicate patients:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Endpoint para relacionar pacientes duplicados
  app.post('/api/admin/link-duplicate-patients', async (req, res) => {
    try {
      if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { patientIds } = req.body;
      
      if (!patientIds || !Array.isArray(patientIds) || patientIds.length < 2) {
        return res.status(400).json({ error: 'At least two patient IDs are required' });
      }

      // Criar relações entre todos os pacientes
      const results: any[] = [];
      const mainPatientId = patientIds[0];
      
      for (let i = 1; i < patientIds.length; i++) {
        // Verificar se a relação já existe
        const existingRelation = await db.query.patientRelationships.findFirst({
          where: and(
            eq(patientRelationships.patientId, mainPatientId),
            eq(patientRelationships.relatedPatientId, patientIds[i])
          )
        });

        if (!existingRelation) {
          // Criar nova relação
          const relation = await db.insert(patientRelationships).values({
            patientId: mainPatientId,
            relatedPatientId: patientIds[i],
            relationshipType: 'duplicate_patient'
          }).returning();
          
          results.push(relation);
        }
      }

      return res.json({ 
        success: true, 
        mainPatientId,
        linkedPatients: patientIds.slice(1),
        relations: results
      });
    } catch (error) {
      console.error('Error linking duplicate patients:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Endpoint para o caso específico de Agus Isrofin
  app.post('/api/admin/merge-agus-isrofin', async (req, res) => {
    try {
      if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Pacientes Agus Isrofin
      const primaryPatientId = 86; // ID do paciente principal 
      const duplicatePatientId = 261; // ID do paciente duplicado com o novo pacote

      // Passo 1: Obter as sessões ativas dos dois pacientes
      const primarySession = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.patientId, primaryPatientId),
          eq(sessions.status, 'active'),
          eq(sessions.packageId, 8) // Ambos usam o pacote ID 8 "Paket 12 Sesi"
        )
      });

      const duplicateSession = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.patientId, duplicatePatientId),
          eq(sessions.status, 'active'),
          eq(sessions.packageId, 8)
        )
      });

      if (!primarySession || !duplicateSession) {
        return res.status(404).json({ error: 'Não foi possível encontrar as sessões ativas para ambos os pacientes' });
      }

      // Passo 2: Atualizar o registro de sessão primária para incluir as sessões adicionais
      // Manteremos as 6 sessões já usadas e adicionaremos mais 12 sessões
      const updatedSession = await db.update(sessions)
        .set({ 
          totalSessions: primarySession.totalSessions + duplicateSession.totalSessions 
        })
        .where(eq(sessions.id, primarySession.id))
        .returning();

      // Passo 3: Desativar a sessão duplicada
      await db.update(sessions)
        .set({ status: 'merged' })
        .where(eq(sessions.id, duplicateSession.id));

      // Passo 4: Criar uma relação entre os pacientes
      const relationExists = await db.query.patientRelationships.findFirst({
        where: and(
          eq(patientRelationships.patientId, primaryPatientId),
          eq(patientRelationships.relatedPatientId, duplicatePatientId)
        )
      });

      if (!relationExists) {
        await db.insert(patientRelationships).values({
          patientId: primaryPatientId,
          relatedPatientId: duplicatePatientId,
          relationshipType: 'duplicate_patient'
        });
      }

      // Passo 5: Atualizar os agendamentos do paciente duplicado para o paciente primário
      const updateAppointmentsResult = await db.execute(
        `UPDATE appointments 
         SET patient_id = $1
         WHERE patient_id = $2 AND status = 'Active'`,
        [primaryPatientId, duplicatePatientId]
      );

      // Log da operação
      console.log(`[${formatDateToWIB(new Date())}] Merged Agus Isrofin's records: Patient ${duplicatePatientId} merged into ${primaryPatientId}`);
      console.log(`Primary session ${primarySession.id} updated to total sessions: ${updatedSession[0].totalSessions}`);
      console.log(`Duplicate session ${duplicateSession.id} marked as merged`);

      return res.json({
        success: true,
        message: 'Registros de Agus Isrofin unificados com sucesso',
        primaryPatient: {
          id: primaryPatientId,
          displayId: 'P-2025-086',
          updatedSession: updatedSession[0]
        },
        mergedData: {
          duplicatePatientId,
          duplicateDisplayId: 'P-2025-261',
          mergedSessionId: duplicateSession.id
        }
      });
    } catch (error) {
      console.error('Error merging Agus Isrofin records:', error);
      return res.status(500).json({ error: 'Internal server error during merge' });
    }
  });
}