/**
 * BUG FIX #19: API endpoint untuk Reports
 * Client mencoba mengakses endpoints reports yang tidak ada
 */
import { Express, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { storage } from "../../storage";
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";

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

      // Filter appointment berdasarkan bulan dan tahun
      const appointmentsInMonth = allAppointments.filter(apt => {
        const aptDate = new Date(apt.date);
        return aptDate >= firstDay && aptDate <= lastDay;
      });

      // Kelompokkan per hari
      const appointmentsByDay = new Map<string, number>();

      appointmentsInMonth.forEach(apt => {
        const dateStr = typeof apt.date === 'string'
          ? apt.date.split(' ')[0]
          : new Date(apt.date).toISOString().split('T')[0];

        const count = appointmentsByDay.get(dateStr) || 0;
        appointmentsByDay.set(dateStr, count + 1);
      });

      // Format untuk response
      const reportData = Array.from(appointmentsByDay.entries()).map(([date, count]) => ({
        date,
        count,
        dayName: format(new Date(date), 'EEEE', { locale: { code: 'id' } })
      })).sort((a, b) => a.date.localeCompare(b.date));

      return res.status(200).json({
        success: true,
        month,
        year,
        totalDays: reportData.length,
        totalAppointments: appointmentsInMonth.length,
        data: reportData
      });
    } catch (error) {
      console.error("Error fetching patients per day report:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil laporan pasien per hari"
      });
    }
  });

  // Endpoint untuk laporan kunjungan bulanan
  app.get("/api/reports/monthly-visits", requireAuth, async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.query.year as string);

      if (isNaN(year)) {
        return res.status(400).json({
          success: false,
          message: "Tahun tidak valid"
        });
      }

      // Dapatkan semua appointment dalam tahun tersebut
      const allAppointments = await storage.getAllAppointments();

      // Filter dan kelompokkan per bulan
      const visitsByMonth = new Array(12).fill(0);

      allAppointments.forEach(apt => {
        const aptDate = new Date(apt.date);
        if (aptDate.getFullYear() === year) {
          const month = aptDate.getMonth();
          visitsByMonth[month]++;
        }
      });

      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];

      const reportData = visitsByMonth.map((count, index) => ({
        month: months[index],
        monthNumber: index + 1,
        visits: count
      }));

      return res.status(200).json({
        success: true,
        year,
        data: reportData,
        totalVisits: visitsByMonth.reduce((a, b) => a + b, 0)
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
        const aptDate = new Date(apt.date);
        return aptDate >= firstDay && aptDate <= lastDay;
      });

      // Format CSV
      const csv = [
        ["Tanggal", "Jumlah Pasien", "Hari"],
        ...appointmentsInMonth.map(apt => {
          const dateStr = typeof apt.date === 'string'
            ? apt.date.split(' ')[0]
            : new Date(apt.date).toISOString().split('T')[0];
          return [dateStr, "1", format(new Date(apt.date), 'EEEE')];
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

      // Filter transaksi berdasarkan bulan dan tahun
      const transactionsInMonth = allTransactions.filter(txn => {
        const txnDate = new Date(txn.createdAt);
        return txnDate >= firstDay && txnDate <= lastDay;
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
