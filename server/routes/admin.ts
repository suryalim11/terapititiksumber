import express from "express";
import { db } from "../db";
import { patients, sessions, packages, transactions } from "@shared/schema";
import { eq, inArray, sql } from "drizzle-orm";

const router = express.Router();

// Middleware para verificar se o usuário é admin
const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso não autorizado' });
  }
};

// Aplicar o middleware de admin em todas as rotas
router.use(isAdmin);

// Rota para listar pacientes duplicados pelo número de telefone
router.get("/duplicate-patients", async (req, res) => {
  try {
    // Consulta para encontrar números de telefone com mais de um paciente
    const duplicatePhones = await db.execute(sql`
      SELECT phone_number, COUNT(*) as count
      FROM patients
      WHERE phone_number IS NOT NULL AND phone_number != ''
      GROUP BY phone_number
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (!duplicatePhones.length) {
      return res.json([]);
    }

    // Extrair os números de telefone duplicados
    const phoneNumbers = duplicatePhones.map(row => row.phone_number);

    // Buscar detalhes completos dos pacientes com os telefones duplicados
    const duplicatePatients = await db.select()
      .from(patients)
      .where(inArray(patients.phoneNumber, phoneNumbers as string[]));

    // Organizar pacientes por número de telefone
    const groupedPatients: Record<string, any[]> = {};
    
    for (const patient of duplicatePatients) {
      if (!groupedPatients[patient.phoneNumber]) {
        groupedPatients[patient.phoneNumber] = [];
      }
      groupedPatients[patient.phoneNumber].push(patient);
    }

    // Para cada paciente, buscar suas sessões e transações
    for (const phoneNumber of Object.keys(groupedPatients)) {
      const patientIds = groupedPatients[phoneNumber].map(p => p.id);
      
      // Buscar pacotes para referência posterior
      const packagesList = await db.select().from(packages);
      const packagesMap = packagesList.reduce((acc, pkg) => {
        acc[pkg.id] = pkg.name;
        return acc;
      }, {} as Record<number, string>);
      
      // Buscar sessões para cada paciente
      const allSessions = await db.select()
        .from(sessions)
        .where(inArray(sessions.patientId, patientIds));
      
      // Buscar transações para cada paciente
      const allTransactions = await db.select()
        .from(transactions)
        .where(inArray(transactions.patientId, patientIds));
      
      // Adicionar sessões e transações a cada paciente
      for (const patient of groupedPatients[phoneNumber]) {
        // Adicionar sessões
        patient.sessions = allSessions
          .filter(s => s.patientId === patient.id)
          .map(s => ({
            ...s,
            packageName: packagesMap[s.packageId] || `Pacote ${s.packageId}`
          }));
        
        // Adicionar transações
        patient.transactions = allTransactions
          .filter(t => t.patientId === patient.id);
      }
    }

    // Formatar a resposta
    const result = Object.keys(groupedPatients).map(phoneNumber => ({
      phoneNumber,
      patients: groupedPatients[phoneNumber],
      totalPatients: groupedPatients[phoneNumber].length
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching duplicate patients:", error);
    res.status(500).json({ error: "Erro ao buscar pacientes duplicados" });
  }
});

// Rota para verificar integridade das sessões
router.get("/session-integrity", async (req, res) => {
  try {
    // Consulta para identificar possíveis inconsistências em sessões
    const inconsistentSessions = await db.execute(sql`
      SELECT s.id, s.patient_id, s.total_sessions, s.sessions_used, s.status, 
             p.name as patient_name, pk.name as package_name
      FROM sessions s
      JOIN patients p ON s.patient_id = p.id
      JOIN packages pk ON s.package_id = pk.id
      WHERE 
        (s.sessions_used > s.total_sessions) OR 
        (s.status = 'active' AND s.sessions_used >= s.total_sessions) OR
        (s.status = 'merged' AND EXISTS (
          SELECT 1 FROM sessions s2 
          WHERE s2.patient_id = s.patient_id AND s2.id != s.id AND s2.status = 'active'
        ))
      ORDER BY s.patient_id, s.id
    `);
    
    res.json(inconsistentSessions);
  } catch (error) {
    console.error("Error checking session integrity:", error);
    res.status(500).json({ error: "Erro ao verificar integridade das sessões" });
  }
});

export default router;