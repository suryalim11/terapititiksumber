/**
 * BUG FIX #19: API endpoint untuk Reports
 * Client mencoba mengakses endpoints reports yang tidak ada
 */
import { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export function setupReportsRoutes(app: Express) {
  // Endpoint untuk laporan pasien per hari
  app.get("/api/reports/patients-per-day", requireAuth, async (req: Request, res: Response) => {
    try {
      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          message: "Bulan dan tahun tidak valid"
        });
      }

      // Buat tanggal awal dan akhir bulan
      const firstDay = startOfMonth(new Date(year, month - 1, 1));
      const lastDay = endOfMonth(new Date(year, month - 1, 1));

      // Dapatkan semua appointment dalam bulan tersebut
      const allAppointments = await storage.getAllAppointments();

      // Filter appointment berdasarkan bulan dan tahun (langsung dari string untuk hindari timezone issue)
      const appointmentsInMonth = allAppointments.filter(apt => {
        try {
          const rawDate = typeof apt.date === 'string'
            ? apt.date.split(' ')[0].split('T')[0]
            : new Date(apt.date).toISOString().split('T')[0];
          const parts = rawDate.split('-');
          return parseInt(parts[0]) === year && parseInt(parts[1]) === month;
        } catch { return false; }
      });

      // Kelompokkan per hari
      const appointmentsByDay = new Map<string, number>();

      appointmentsInMonth.forEach(apt => {
        const rawDate = typeof apt.date === 'string'
          ? apt.date.split(' ')[0].split('T')[0]
          : new Date(apt.date).toISOString().split('T')[0];

        const patientCount = appointmentsByDay.get(rawDate) || 0;
        appointmentsByDay.set(rawDate, patientCount + 1);
      });

      // Buat array semua hari dalam bulan (termasuk yang 0 kunjungan)
      const allDays = eachDayOfInterval({ start: firstDay, end: lastDay });
      const dailyData = allDays.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const patientCount = appointmentsByDay.get(dateStr) || 0;
        return {
          date: dateStr,
          patientCount,
          dayName: format(day, 'EEEE', { locale: idLocale })
        };
      });

      const totalPatients = appointmentsInMonth.length;
      const daysInMonth = allDays.length;
      const averagePatientsPerDay = daysInMonth > 0
        ? (totalPatients / daysInMonth).toFixed(1)
        : '0.0';

      return res.status(200).json({
        success: true,
        month,
        year,
        totalDays: daysInMonth,
        totalPatients,
        averagePatientsPerDay,
        dailyData
      });
    } catch (error) {
      console.error("Error fetching patients per day report:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil laporan pasien per hari"
      });
    }
  });

  // Endpoint untuk laporan kunjungan bulanan (detail per pasien)
  app.get("/api/reports/monthly-visits", requireAuth, async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          message: "Tahun dan bulan tidak valid"
        });
      }

      // Buat tanggal awal dan akhir bulan
      const firstDay = startOfMonth(new Date(year, month - 1, 1));
      const lastDay = endOfMonth(new Date(year, month - 1, 1));

      // Dapatkan semua appointment dan pasien
      const allAppointments = await storage.getAllAppointments();
      const allPatients = await storage.getAllPatients();

      // Buat map patient by id untuk akses cepat
      const patientMap = new Map(allPatients.map(p => [p.id, p]));

      // Filter appointment dalam bulan yang dipilih (langsung dari string untuk hindari timezone issue)
      const appointmentsInMonth = allAppointments.filter(apt => {
        try {
          const rawDate = typeof apt.date === 'string'
            ? apt.date.split(' ')[0].split('T')[0]  // ambil "YYYY-MM-DD"
            : new Date(apt.date).toISOString().split('T')[0];
          const parts = rawDate.split('-');
          const aptYear = parseInt(parts[0]);
          const aptMonth = parseInt(parts[1]);
          return aptYear === year && aptMonth === month;
        } catch {
          return false;
        }
      });

      // Tentukan kunjungan pertama setiap pasien (untuk menentukan pasien baru vs lama)
      const patientFirstVisitMap = new Map<number, Date>();
      allAppointments.forEach(apt => {
        const aptDate = new Date(apt.date);
        const existing = patientFirstVisitMap.get(apt.patientId);
        if (!existing || aptDate < existing) {
          patientFirstVisitMap.set(apt.patientId, aptDate);
        }
      });

      // Bangun daftar kunjungan dengan detail pasien
      const visits = [];
      for (const apt of appointmentsInMonth) {
        const patient = patientMap.get(apt.patientId);
        if (!patient) continue;

        // Tentukan apakah pasien baru (kunjungan pertama ada di bulan ini)
        const firstVisit = patientFirstVisitMap.get(apt.patientId);
        const isNew = firstVisit && firstVisit >= firstDay && firstVisit <= lastDay;

        // Hitung usia
        let age = 0;
        if (patient.birthDate) {
          const birthDate = new Date(patient.birthDate);
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }

        // Format tanggal DD-MM-YYYY sesuai ekspektasi client
        const rawDateStr = typeof apt.date === 'string'
          ? apt.date.split(' ')[0].split('T')[0]
          : new Date(apt.date).toISOString().split('T')[0];
        const [yr, mo, dy] = rawDateStr.split('-');
        const dateStr = `${dy}-${mo}-${yr}`;  // DD-MM-YYYY

        visits.push({
          patientName: patient.name,
          date: dateStr,
          patientAddress: patient.address || '',
          patientAge: age,
          patientGender: patient.gender || '',
          visitType: isNew ? 'BARU' : 'LAMA',
          complaint: (patient as any).complaints || ''
        });
      }

      // Urutkan berdasarkan tanggal
      visits.sort((a, b) => a.date.localeCompare(b.date));

      const newPatients = visits.filter(v => v.visitType === 'BARU').length;
      const returningPatients = visits.filter(v => v.visitType === 'LAMA').length;

      return res.status(200).json({
        success: true,
        month,
        year,
        summary: {
          totalVisits: visits.length,
          newPatients,
          returningPatients
        },
        visits
      });
    } catch (error) {
      console.error("Error fetching monthly visits report:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil laporan kunjungan bulanan"
      });
    }
  });

  // Endpoint untuk export laporan kunjungan bulanan
  app.get("/api/reports/monthly-visits/export", requireAuth, async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);

      if (isNaN(year) || isNaN(month)) {
        return res.status(400).json({
          success: false,
          message: "Tahun dan bulan tidak valid"
        });
      }

      // Dapatkan data laporan
      const firstDay = startOfMonth(new Date(year, month - 1, 1));
      const lastDay = endOfMonth(new Date(year, month - 1, 1));

      const allAppointments = await storage.getAllAppointments();
      const appointmentsInMonth = allAppointments.filter(apt => {
        try {
          const rawDate = typeof apt.date === 'string'
            ? apt.date.split(' ')[0].split('T')[0]
            : new Date(apt.date).toISOString().split('T')[0];
          const parts = rawDate.split('-');
          return parseInt(parts[0]) === year && parseInt(parts[1]) === month;
        } catch { return false; }
      });

      // Format CSV
      const csv = [
        ["Tanggal", "Jumlah Pasien", "Hari"],
        ...appointmentsInMonth.map(apt => {
          const dateStr = typeof apt.date === 'string'
            ? apt.date.split(' ')[0]
            : new Date(apt.date).toISOString().split('T')[0];
          return [dateStr, "1", format(new Date(apt.date), 'EEEE', { locale: idLocale })];
        })
      ].map(row => row.join(",")).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="laporan-kunjungan-${year}-${month}.csv"`);
      return res.send(csv);
    } catch (error) {
      console.error("Error exporting monthly visits report:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat export laporan"
      });
    }
  });

  // Endpoint untuk laporan keuangan bulanan
  app.get("/api/reports/monthly-financial", requireAuth, async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.query.year as string);
      const month = parseInt(req.query.month as string);

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          message: "Tahun dan bulan tidak valid"
        });
      }

      // Buat tanggal awal dan akhir bulan
      const firstDay = startOfMonth(new Date(year, month - 1, 1));
      const lastDay = endOfMonth(new Date(year, month - 1, 1));

      // Dapatkan semua transaksi
      const allTransactions = await storage.getAllTransactions();

      // Filter transaksi berdasarkan bulan dan tahun (langsung dari string untuk hindari timezone issue)
      const transactionsInMonth = allTransactions.filter(txn => {
        try {
          const rawDate = typeof txn.createdAt === 'string'
            ? txn.createdAt.split(' ')[0].split('T')[0]
            : new Date(txn.createdAt).toISOString().split('T')[0];
          const parts = rawDate.split('-');
          return parseInt(parts[0]) === year && parseInt(parts[1]) === month;
        } catch { return false; }
      });

      // Hitung total pendapatan dan pengeluaran
      let totalIncome = 0;
      let totalExpense = 0;

      transactionsInMonth.forEach(txn => {
        const amount = parseFloat(txn.amount);
        if (txn.type === "income" || txn.type === "pembayaran") {
          totalIncome += amount;
        } else if (txn.type === "expense" || txn.type === "pengeluaran") {
          totalExpense += amount;
        }
      });

      const netIncome = totalIncome - totalExpense;

      return res.status(200).json({
        success: true,
        month,
        year,
        financial: {
          totalIncome,
          totalExpense,
          netIncome,
          transactionCount: transactionsInMonth.length
        }
      });
    } catch (error) {
      console.error("Error fetching monthly financial report:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil laporan keuangan"
      });
    }
  });
}
