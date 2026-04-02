/**
 * API endpoint untuk manajemen slot terapi
 */
import { Express, Request, Response } from "express";
import { requireAuth, requireAdmin } from "../../middleware/auth";
import { storage } from "../../storage";
import { z } from "zod";
import { insertTherapySlotSchema } from "@shared/schema";
import { getWIBDate } from "../../utils/date-utils";

// BUG FIX #12: Hapus hardcode SLOT_CORRECTIONS data dari Mei 2025
// Data slot seharusnya diambil langsung dari database, bukan dari hardcode

// Format tanggal untuk ditampilkan kepada pengguna
function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  };
  return date.toLocaleDateString('id-ID', options);
}

// Fungsi untuk format data slot terapi (tanpa koreksi hardcode)
function formatTherapySlotData(slot: any): any {
  // Clone object untuk menghindari modifikasi objek asli
  const formattedSlot = { ...slot };

  // Tambahkan displayDate untuk konsistensi
  formattedSlot.displayDate = formatDateForDisplay(slot.date);

  return formattedSlot;
}

/**
 * Mendaftarkan rute-rute untuk slot terapi
 */
export function setupTherapySlotsRoutes(app: Express) {
  // Cache untuk semua slot terapi
  let allSlotsCache: {
    data: any[];
    timestamp: number;
  } | null = null;
  
  // Cache untuk registry mapping
  let slotRegistryCache: {
    data: Record<string, number>; // timeSlotKey -> slotId
    timestamp: number;
  } | null = null;
  
  /**
   * Mendaftarkan endpoint untuk registry slot
   * Endpoint ini menyediakan mapping lengkap dari timeSlotKey ke ID slot
   * Berguna untuk aplikasi frontend yang perlu mengakses slot berdasarkan tanggal+waktu
   */
  app.get("/api/therapy-slots/registry", requireAuth, async (req: Request, res: Response) => {
    try {
      const refreshCache = req.query.refresh === 'true';
      const now = Date.now();
      
      // Cache valid untuk 30 menit
      const REGISTRY_CACHE_AGE = 30 * 60 * 1000;
      
      // Gunakan cache jika tersedia dan masih valid
      if (slotRegistryCache && !refreshCache && (now - slotRegistryCache.timestamp) < REGISTRY_CACHE_AGE) {
        console.log("Mengembalikan registry slot dari cache");
        return res.json({
          success: true,
          registry: slotRegistryCache.data,
          fromCache: true,
          lastUpdate: new Date(slotRegistryCache.timestamp).toISOString()
        });
      }
      
      // Ambil semua slot terapi aktif
      console.log("Membangun registry slot baru...");
      const allSlots = await storage.getActiveTherapySlots();
      
      // Buat registry mapping dari timeSlotKey ke ID
      const registry: Record<string, number> = {};
      
      // BUG FIX #12: Gunakan data slot dari database (tanpa hardcode koreksi)
      for (const slot of allSlots) {
        // Gunakan data slot asli dari database
        const dateStr = typeof slot.date === 'string' ? slot.date.split(' ')[0] : new Date(slot.date).toISOString().split('T')[0];
        const key = slot.timeSlotKey || `${dateStr}_${slot.timeSlot}`;
        registry[key] = slot.id;
      }

      // BUG FIX #12: Hapus penambahan koreksi manual hardcode

      // Update cache
      slotRegistryCache = {
        data: registry,
        timestamp: now
      };
      
      console.log(`Registry slot terapi dibuat dengan ${Object.keys(registry).length} entri`);
      
      return res.json({
        success: true,
        registry,
        totalMappings: Object.keys(registry).length,
        lastUpdate: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating therapy slot registry:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat membuat registry slot terapi"
      });
    }
  });
  
  // Mendapatkan semua slot terapi (dengan caching)
  app.get("/api/therapy-slots", requireAuth, async (req: Request, res: Response) => {
    try {
      // Cek parameter query untuk filtering
      const date = req.query.date as string | undefined;
      // Terima semua varian parameter aktif: activeOnly=true, active=true, available=true
      const activeOnly = req.query.activeOnly === 'true'
        || req.query.active === 'true'
        || req.query.available === 'true';
      const applyCorrections = req.query.correct !== 'false'; // Default: lakukan koreksi

      // Log untuk monitoring
      console.log("Executing optimized getAllTherapySlots query");
      const startTime = Date.now();

      // Cache valid untuk 5 menit, kecuali diminta refresh
      // Cache hanya digunakan untuk request tanpa filter aktif (admin view)
      const shouldRefresh = req.query.refresh === 'true';
      const now = Date.now();
      const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 menit

      // Gunakan cache hanya jika tidak ada filter aktif
      if (allSlotsCache && !shouldRefresh && (now - allSlotsCache.timestamp) < MAX_CACHE_AGE && !date && !activeOnly) {
        let therapySlots = allSlotsCache.data;

        if (applyCorrections) {
          therapySlots = therapySlots.map(slot => formatTherapySlotData(slot));
        }

        console.log(`Query completed in ${Date.now() - startTime}ms, returning from cache ${therapySlots.length} slots`);
        return res.json(therapySlots);
      }

      // Jika tidak, ambil data baru
      let therapySlots;

      if (date) {
        // Jika ada parameter tanggal, gunakan query berdasarkan tanggal
        const dateObj = new Date(date);
        therapySlots = await storage.getTherapySlotsByDate(dateObj);
      } else if (activeOnly) {
        // Jika diminta hanya slot aktif — ambil slot aktif dan filter tanggal mendatang
        therapySlots = await storage.getActiveTherapySlots();

        // Filter: hanya tampilkan slot yang tanggalnya hari ini atau ke depan
        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        therapySlots = therapySlots.filter((slot: any) => {
          const slotDate = typeof slot.date === 'string' ? slot.date : new Date(slot.date).toISOString().split('T')[0];
          return slotDate >= todayStr;
        });

        console.log(`[REGISTER] Slot aktif & mendatang: ${therapySlots.length} slot (filter tanggal >= ${todayStr})`);
      } else {
        // Jika tidak ada filter, ambil semua slot (admin view)
        therapySlots = await storage.getAllTherapySlots();

        // Update cache
        allSlotsCache = {
          data: therapySlots,
          timestamp: now
        };
      }

      // Terapkan koreksi jika diminta
      if (applyCorrections) {
        therapySlots = therapySlots.map(slot => formatTherapySlotData(slot));
      }

      console.log(`Query completed in ${Date.now() - startTime}ms, found ${therapySlots.length} slots`);
      res.json(therapySlots);
    } catch (error) {
      console.error("Error getting therapy slots:", error);
      res.status(500).json({ error: "Gagal mendapatkan daftar slot terapi" });
    }
  });

  // Mendapatkan slot terapi aktif
  app.get("/api/therapy-slots/active", requireAuth, async (req: Request, res: Response) => {
    try {
      const activeSlots = await storage.getActiveTherapySlots();
      res.json(activeSlots);
    } catch (error) {
      console.error("Error getting active therapy slots:", error);
      res.status(500).json({ error: "Gagal mendapatkan daftar slot terapi aktif" });
    }
  });

  // Mendapatkan slot terapi berdasarkan ID
  app.get("/api/therapy-slots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const applyCorrections = req.query.correct !== 'false'; // Default: lakukan koreksi
      
      const therapySlot = await storage.getTherapySlot(id);
      
      if (!therapySlot) {
        return res.status(404).json({ error: "Slot terapi tidak ditemukan" });
      }
      
      // Terapkan koreksi jika diperlukan
      const result = applyCorrections ? formatTherapySlotData(therapySlot) : therapySlot;
      
      // Log untuk debugging
      console.log(`Mengirim detail slot terapi ID ${id}, koreksi=${applyCorrections}`);
      
      res.json(result);
    } catch (error) {
      console.error("Error getting therapy slot:", error);
      res.status(500).json({ error: "Gagal mendapatkan data slot terapi" });
    }
  });
  
  // Mendapatkan slot terapi berdasarkan timeSlotKey (tanggal_waktu)
  app.get("/api/therapy-slots/by-key/:timeSlotKey", requireAuth, async (req: Request, res: Response) => {
    try {
      const timeSlotKey = req.params.timeSlotKey;
      
      if (!timeSlotKey || !timeSlotKey.includes('_')) {
        return res.status(400).json({ 
          success: false, 
          message: "Format timeSlotKey tidak valid. Gunakan format: YYYY-MM-DD_HH:MM-HH:MM" 
        });
      }
      
      // Parse timeSlotKey menjadi tanggal dan waktu
      const [dateStr, timeSlot] = timeSlotKey.split('_');
      
      // Dapatkan semua slot untuk tanggal tersebut (konversi ke Date jika perlu)
      const slots = await storage.getTherapySlotsByDate(new Date(dateStr));
      
      // Cari slot dengan waktu yang cocok
      let matchingSlot = slots.find(slot => slot.timeSlot === timeSlot);
      
      // BUG FIX #12: Hapus pencarian di koreksi manual hardcode
      if (!matchingSlot) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi dengan kombinasi tanggal dan waktu tersebut tidak ditemukan" 
        });
      }
      
      // Terapkan koreksi jika diperlukan
      const result = formatTherapySlotData(matchingSlot);
      
      return res.status(200).json({
        success: true,
        therapySlot: result
      });
    } catch (error) {
      console.error("Error getting therapy slot by key:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil data slot terapi" 
      });
    }
  });

  // Mendapatkan slot terapi berdasarkan tanggal
  app.get("/api/therapy-slots/date/:date", requireAuth, async (req: Request, res: Response) => {
    try {
      const date = req.params.date;
      const applyCorrections = req.query.correct !== 'false'; // Default: lakukan koreksi
      
      if (!date) {
        return res.status(400).json({ 
          success: false, 
          message: "Parameter tanggal diperlukan" 
        });
      }
      
      // Konversi string ke tanggal
      const dateObj = new Date(date);
      
      // Ambil slot terapi berdasarkan tanggal
      let therapySlots = await storage.getTherapySlotsByDate(dateObj);
      
      // Proses koreksi jika diperlukan
      if (applyCorrections) {
        therapySlots = therapySlots.map(slot => formatTherapySlotData(slot));
      }
      
      return res.status(200).json({
        success: true,
        therapySlots
      });
    } catch (error) {
      console.error("Error getting therapy slots by date:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil data slot terapi" 
      });
    }
  });

  // Membuat slot terapi baru
  app.post("/api/therapy-slots", requireAdmin, async (req: Request, res: Response) => {
    try {
      const therapySlotData = insertTherapySlotSchema.parse(req.body);
      
      // Pastikan format date adalah string (YYYY-MM-DD)
      let dateString: string;
      if (typeof therapySlotData.date === 'object' && therapySlotData.date !== null) {
        dateString = (therapySlotData.date as Date).toISOString().split('T')[0];
      } else {
        dateString = String(therapySlotData.date).split('T')[0].split(' ')[0];
      }
      therapySlotData.date = dateString;
      
      // Buat timeSlotKey (kombinasi date dan timeSlot)
      therapySlotData.timeSlotKey = `${dateString}_${therapySlotData.timeSlot}`;
      
      // Periksa apakah slot terapi dengan date dan timeSlot yang sama sudah ada
      const existingSlots = await storage.getTherapySlotsByDate(new Date(dateString));
      const existingSlot = existingSlots.find(slot => slot.timeSlot === therapySlotData.timeSlot);
      
      if (existingSlot) {
        return res.status(409).json({ 
          success: false, 
          message: "Slot terapi dengan tanggal dan waktu yang sama sudah ada" 
        });
      }
      
      // Buat slot terapi baru
      const newTherapySlot = await storage.createTherapySlot(therapySlotData);
      
      return res.status(201).json({
        success: true,
        therapySlot: newTherapySlot,
        message: "Slot terapi berhasil dibuat"
      });
    } catch (error) {
      console.error("Error creating therapy slot:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Data slot terapi tidak valid", 
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat membuat slot terapi baru" 
      });
    }
  });

  // Membuat batch slot terapi baru (multiple slots at once)
  app.post("/api/therapy-slots/batch", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { slots } = req.body;
      
      if (!Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Data slots harus berupa array dan tidak boleh kosong"
        });
      }
      
      console.log(`Batch creating ${slots.length} therapy slots...`);
      
      const createdSlots = [];
      const skippedSlots = [];
      const errors = [];
      
      for (const slotData of slots) {
        try {
          // Pastikan format date adalah string (YYYY-MM-DD)
          let dateString: string;
          if (typeof slotData.date === 'object' && slotData.date !== null) {
            dateString = (slotData.date as Date).toISOString().split('T')[0];
          } else {
            dateString = String(slotData.date).split('T')[0].split(' ')[0];
          }
          
          // Buat timeSlotKey
          const timeSlotKey = `${dateString}_${slotData.timeSlot}`;
          
          // Periksa apakah slot sudah ada
          const existingSlots = await storage.getTherapySlotsByDate(new Date(dateString));
          const existingSlot = existingSlots.find(slot => slot.timeSlot === slotData.timeSlot);
          
          if (existingSlot) {
            skippedSlots.push({
              date: dateString,
              timeSlot: slotData.timeSlot,
              reason: "Slot sudah ada"
            });
            continue;
          }
          
          // Buat slot baru
          const newSlot = await storage.createTherapySlot({
            date: dateString,
            timeSlot: slotData.timeSlot,
            timeSlotKey: timeSlotKey,
            maxQuota: slotData.maxQuota || 5,
            currentCount: 0,
            isActive: slotData.isActive !== undefined ? slotData.isActive : true
          });
          
          createdSlots.push(newSlot);
        } catch (slotError) {
          console.error("Error creating single slot in batch:", slotError);
          errors.push({
            date: slotData.date,
            timeSlot: slotData.timeSlot,
            error: slotError instanceof Error ? slotError.message : "Unknown error"
          });
        }
      }
      
      console.log(`Batch complete: ${createdSlots.length} created, ${skippedSlots.length} skipped, ${errors.length} errors`);
      
      // Invalidate cache
      allSlotsCache = null;
      slotRegistryCache = null;
      
      return res.status(201).json({
        success: true,
        createdCount: createdSlots.length,
        skippedCount: skippedSlots.length,
        errorCount: errors.length,
        created: createdSlots,
        skipped: skippedSlots,
        errors: errors,
        message: `${createdSlots.length} slot terapi berhasil dibuat`
      });
    } catch (error) {
      console.error("Error in batch create therapy slots:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat membuat slot terapi batch"
      });
    }
  });

  // Memperbarui slot terapi
  app.put("/api/therapy-slots/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const therapySlotData = req.body;
      
      // Dapatkan slot terapi yang ada
      const existingTherapySlot = await storage.getTherapySlot(id);
      
      if (!existingTherapySlot) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi tidak ditemukan" 
        });
      }
      
      // Periksa apakah tanggal atau waktu diubah
      if ((therapySlotData.date && therapySlotData.date !== existingTherapySlot.date) || 
          (therapySlotData.timeSlot && therapySlotData.timeSlot !== existingTherapySlot.timeSlot)) {
        
        // Perbarui timeSlotKey
        const date = therapySlotData.date || existingTherapySlot.date;
        const timeSlot = therapySlotData.timeSlot || existingTherapySlot.timeSlot;
        therapySlotData.timeSlotKey = `${date}_${timeSlot}`;
        
        // Periksa apakah slot terapi dengan date dan timeSlot yang sama sudah ada
        const existingSlots = await storage.getTherapySlotsByDate(date);
        const existingSlot = existingSlots.find(slot => 
          slot.timeSlot === timeSlot && slot.id !== id
        );
        
        if (existingSlot) {
          return res.status(409).json({ 
            success: false, 
            message: "Slot terapi dengan tanggal dan waktu yang sama sudah ada" 
          });
        }
      }
      
      // Perbarui slot terapi
      const updatedTherapySlot = await storage.updateTherapySlot(id, therapySlotData);
      
      if (!updatedTherapySlot) {
        return res.status(500).json({ 
          success: false, 
          message: "Gagal memperbarui data slot terapi" 
        });
      }
      
      return res.status(200).json({
        success: true,
        therapySlot: updatedTherapySlot,
        message: "Data slot terapi berhasil diperbarui"
      });
    } catch (error) {
      console.error("Error updating therapy slot:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Data slot terapi tidak valid", 
          details: error.errors 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat memperbarui data slot terapi" 
      });
    }
  });

  // Menonaktifkan slot terapi
  app.patch("/api/therapy-slots/:id/deactivate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Dapatkan slot terapi yang ada
      const existingTherapySlot = await storage.getTherapySlot(id);
      
      if (!existingTherapySlot) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi tidak ditemukan" 
        });
      }
      
      // Nonaktifkan slot terapi
      const success = await storage.deactivateTherapySlot(id);

      if (!success) {
        return res.status(500).json({
          success: false,
          message: "Gagal menonaktifkan slot terapi"
        });
      }

      // Invalidate cache agar halaman registrasi langsung ter-update
      allSlotsCache = null;

      return res.status(200).json({
        success: true,
        message: "Slot terapi berhasil dinonaktifkan"
      });
    } catch (error) {
      console.error("Error deactivating therapy slot:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat menonaktifkan slot terapi" 
      });
    }
  });

  // Menghapus slot terapi
  app.delete("/api/therapy-slots/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Dapatkan slot terapi yang akan dihapus
      const therapySlot = await storage.getTherapySlot(id);
      
      if (!therapySlot) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi tidak ditemukan" 
        });
      }
      
      // Periksa apakah slot terapi memiliki appointment
      const appointments = await storage.getAppointmentsByTherapySlot(id);
      
      if (appointments.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Slot terapi tidak dapat dihapus karena memiliki appointment" 
        });
      }
      
      // Hapus slot terapi
      const success = await storage.deleteTherapySlot(id);

      if (!success) {
        return res.status(500).json({
          success: false,
          message: "Gagal menghapus slot terapi"
        });
      }

      // Invalidate cache agar halaman registrasi langsung ter-update
      allSlotsCache = null;

      return res.status(200).json({
        success: true,
        message: "Slot terapi berhasil dihapus"
      });
    } catch (error) {
      console.error("Error deleting therapy slot:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat menghapus slot terapi" 
      });
    }
  });

  // Mendapatkan jumlah pasien aktual dalam slot terapi
  app.get("/api/therapy-slots/:id/count", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Dapatkan slot terapi
      const therapySlot = await storage.getTherapySlot(id);
      
      if (!therapySlot) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi tidak ditemukan" 
        });
      }
      
      // Dapatkan appointment untuk slot terapi
      const appointments = await storage.getAppointmentsByTherapySlot(id);
      
      // Filter berdasarkan status tertentu
      const activeAppointments = appointments.filter(app => 
        app.status === 'Active' || app.status === 'Confirmed'
      );
      
      return res.status(200).json({
        success: true,
        therapySlotId: id,
        date: therapySlot.date,
        timeSlot: therapySlot.timeSlot,
        maxQuota: therapySlot.maxQuota,
        currentCount: therapySlot.currentCount,
        actualCount: activeAppointments.length,
        appointments: activeAppointments
      });
    } catch (error) {
      console.error("Error getting therapy slot count:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mengambil jumlah pasien dalam slot terapi" 
      });
    }
  });

  // Cache untuk menyimpan hasil query slot terapi
  const therapySlotCache: Record<string, {
    data: any;
    timestamp: number;
    expiresInMs: number;
  }> = {};
  
  // Fungsi untuk mendapatkan dari cache atau mengeksekusi query asli
  const getFromCacheOrFetch = async (
    cacheKey: string,
    fetchFn: () => Promise<any>,
    expiresInMs = 60000 // Cache valid selama 1 menit default
  ) => {
    const now = Date.now();
    const cachedItem = therapySlotCache[cacheKey];
    
    // Cek apakah data ada di cache dan masih valid
    if (cachedItem && (now - cachedItem.timestamp) < cachedItem.expiresInMs) {
      console.log(`✅ Cache hit untuk ${cacheKey}`);
      return cachedItem.data;
    }
    
    // Jika tidak ada di cache atau sudah kadaluarsa, fetch data baru
    console.log(`❌ Cache miss untuk ${cacheKey}, mengambil data baru...`);
    const data = await fetchFn();
    
    // Simpan ke cache
    therapySlotCache[cacheKey] = {
      data,
      timestamp: now,
      expiresInMs
    };
    
    return data;
  };
  
  // Endpoint untuk akses cepat ke data dasar slot terapi tanpa pasien
  app.get("/api/therapy-slots/:id/fast", requireAuth, async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const slotId = parseInt(req.params.id);
      const cacheBuster = req.query._cb || req.query._t;
      const applyCorrections = req.query.correct !== 'false'; // Default: lakukan koreksi
      
      // Cache key
      const cacheKey = `therapy_slot_basic_${slotId}_${cacheBuster || Date.now()}`;
      
      console.log(`🚀 Request untuk basic slot ${slotId} info, dengan koreksi=${applyCorrections}`);
      
      // Eksekusi query dengan cache yang super agresif (5 menit)
      const result = await getFromCacheOrFetch(
        cacheKey,
        async () => {
          console.log(`🔍 Mengambil data dasar therapy slot ID: ${slotId}`);
          
          // Hanya fetch data slot dasar
          const therapySlot = await storage.getTherapySlot(slotId);
          
          if (!therapySlot) {
            throw new Error("Slot terapi tidak ditemukan");
          }
          
          // Terapkan koreksi jika diminta
          let slotData = applyCorrections ? formatTherapySlotData(therapySlot) : therapySlot;
          
          // Mapping ke data yang lebih ringan
          return {
            id: slotData.id,
            date: slotData.date,
            timeSlot: slotData.timeSlot,
            maxQuota: slotData.maxQuota,
            currentCount: slotData.currentCount,
            isActive: slotData.isActive,
            displayDate: slotData.displayDate || formatDateForDisplay(slotData.date),
            timeSlotKey: slotData.timeSlotKey || `${slotData.date}_${slotData.timeSlot}`,
            corrected: slotData.corrected || false,
            cached: true,
            timestamp: new Date().toISOString()
          };
        },
        300000 // Cache selama 5 menit
      );
      
      // Log waktu respons
      const totalTime = Date.now() - startTime;
      console.log(`✅ Basic slot data response time: ${totalTime}ms`);
      
      // HTTP caching headers yang agresif
      res.set('Cache-Control', 'private, max-age=300');
      
      return res.status(200).json({
        success: true,
        responseTime: totalTime,
        ...result
      });
    } catch (error) {
      console.error(`❌ Error getting basic data for therapy slot ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan saat mengambil data dasar slot terapi",
        errorType: error instanceof Error ? error.name : "Unknown",
        timestamp: new Date().toISOString()
      });
    }
  });

  // SPLIT ENDPOINT: Mendapatkan statistik pasien (counts only, Ultra-Fast)
  app.get("/api/therapy-slots/:id/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const slotId = parseInt(req.params.id);
      const cacheBuster = req.query._cb || req.query._t;
      
      // Cache key
      const cacheKey = `therapy_slot_stats_${slotId}_${cacheBuster || Date.now()}`;
      
      console.log(`📊 Request untuk slot ${slotId} patient stats`);
      
      // Eksekusi query dengan cache yang super agresif
      const result = await getFromCacheOrFetch(
        cacheKey,
        async () => {
          console.log(`🔢 Menghitung pasien untuk slot ID: ${slotId}`);
          
          // 1. Hanya dapatkan ID dan status untuk kalkulasi cepat
          const appointments = await storage.getAppointmentsByTherapySlot(slotId);
          
          // 2. Hitung status count tanpa data lain
          const statusCounts = appointments.reduce((acc, a) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          console.log(`⏱️ Penghitungan selesai dalam ${Date.now() - startTime}ms, ${appointments.length} appointments`);
          
          return {
            appointmentCount: appointments.length,
            statusCounts,
            cached: true,
            timestamp: new Date().toISOString()
          };
        },
        300000 // Cache selama 5 menit
      );
      
      // Log waktu respons total
      const totalTime = Date.now() - startTime;
      console.log(`✅ Slot stats response time: ${totalTime}ms`);
      
      // HTTP caching headers yang agresif
      res.set('Cache-Control', 'private, max-age=300');
      
      return res.status(200).json({
        success: true,
        responseTime: totalTime,
        ...result
      });
    } catch (error) {
      console.error(`❌ Error getting stats for therapy slot ${req.params.id}:`, error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Terjadi kesalahan saat mengambil statistik pasien",
        errorType: error instanceof Error ? error.name : "Unknown"
      });
    }
  });

  // ORIGINAL ENDPOINT: Mendapatkan semua pasien dalam slot terapi (dengan fallback prioritas)
  app.get("/api/therapy-slots/:id/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      const startTime = Date.now();
      const slotId = parseInt(req.params.id);
      const showAll = req.query.showAll === 'true';
      const minimal = req.query.minimal === 'true';
      const cacheBuster = req.query._cb || req.query._t;
      
      // Cache key lebih dinamis untuk mengurangi kemungkinan collision
      const cacheKey = `therapy_slot_${slotId}_${showAll ? 'all' : 'active'}_${minimal ? 'min' : 'full'}_${cacheBuster || Date.now()}`;
      
      console.log(`⚡ Request untuk slot ${slotId} patients dengan mode: ${minimal ? 'minimal' : 'full'}`);
      
      // Set timeout untuk monitor request
      const timeout = setTimeout(() => {
        console.log(`⚠️ TIMEOUT WARNING: Request /api/therapy-slots/${slotId}/patients berjalan > 5 detik`);
      }, 5000);
      
      // FALLBACK PRIORITAS: Jika mode minimal, pertama coba dapatkan data dasar dan stats secara paralel
      if (minimal) {
        try {
          const [basicData, statsData] = await Promise.all([
            getFromCacheOrFetch(`therapy_slot_basic_${slotId}`, 
              async () => {
                const therapySlot = await storage.getTherapySlot(slotId);
                if (!therapySlot) throw new Error("Slot terapi tidak ditemukan");
                return {
                  id: therapySlot.id,
                  date: therapySlot.date,
                  timeSlot: therapySlot.timeSlot,
                  maxQuota: therapySlot.maxQuota,
                  currentCount: therapySlot.currentCount,
                  isActive: therapySlot.isActive
                };
              }, 
              300000
            ),
            getFromCacheOrFetch(`therapy_slot_stats_${slotId}`,
              async () => {
                const appointments = await storage.getAppointmentsByTherapySlot(slotId);
                const statusCounts = appointments.reduce((acc, a) => {
                  acc[a.status] = (acc[a.status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>);
                return {
                  appointmentCount: appointments.length,
                  statusCounts
                };
              },
              300000
            )
          ]);
          
          // Jika kedua data berhasil didapatkan, langsung kembalikan hasil gabungan
          clearTimeout(timeout);
          const totalTime = Date.now() - startTime;
          console.log(`🔥 FAST PATH: Slot data dari cache terpisah dalam ${totalTime}ms`);
          
          // Return gabungan data dengan HTTP caching headers yang agresif
          res.set('Cache-Control', 'private, max-age=60');
          
          return res.status(200).json({
            success: true,
            responseTime: totalTime,
            mode: 'minimal',
            slot: basicData,
            ...statsData,
            cached: true,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          // Jika gagal mendapatkan data dari cache terpisah, lanjut ke cara normal
          console.log(`⚠️ Fallback gagal, melanjutkan ke query normal: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Jika fallback gagal atau mode full, gunakan query normal
      // Eksekusi query dengan cache yang lebih agresif
      const result = await getFromCacheOrFetch(
        cacheKey,
        async () => {
          console.log(`🔄 Mengambil data therapy slot ID: ${slotId} dan pasiennya...`);
          
          // 1. Fetch slot terapi dan appointments secara paralel untuk meningkatkan kinerja
          const [therapySlot, appointments] = await Promise.all([
            storage.getTherapySlot(slotId),
            storage.getAppointmentsByTherapySlot(slotId)
          ]);
          
          if (!therapySlot) {
            throw new Error("Slot terapi tidak ditemukan");
          }
          
          // 2. Ambil hanya data-data yang diperlukan untuk meringankan respons
          const lighterAppointments = appointments.map(a => {
            // Jika mode minimal, kembalikan data sangat minimal
            if (minimal) {
              return {
                id: a.id,
                patientId: a.patientId,
                status: a.status
              };
            }
            
            // Mode normal, data lebih lengkap tapi tetap efisien
            return {
              id: a.id,
              patientId: a.patientId,
              status: a.status,
              notes: a.notes,
              date: a.date,
              timeSlot: a.timeSlot,
              sessionId: a.sessionId
            };
          });
          
          // 3. Hitung status count untuk info tambahan
          const statusCounts = appointments.reduce((acc, a) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          console.log(`⏱️ Query selesai dalam ${Date.now() - startTime}ms, ${appointments.length} appointments`);
          
          // Hasil disesuaikan dengan mode minimal atau full
          return minimal ? {
            // Mode minimal: Hanya kembalikan data esensial
            slot: {
              id: therapySlot.id,
              date: therapySlot.date,
              timeSlot: therapySlot.timeSlot,
              maxQuota: therapySlot.maxQuota,
              currentCount: therapySlot.currentCount,
              isActive: therapySlot.isActive
            },
            appointmentCount: appointments.length,
            statusCounts,
            cached: true,
            timestamp: new Date().toISOString()
          } : {
            // Mode full: Data lebih lengkap
            slot: therapySlot,
            appointments: lighterAppointments,
            statusCounts,
            cached: true,
            timestamp: new Date().toISOString()
          };
        },
        minimal ? 120000 : 60000 // Cache lebih lama untuk mode minimal (2 menit vs 1 menit)
      );
      
      // Bersihkan timeout karena request sudah selesai
      clearTimeout(timeout);
      
      // Log waktu respons total
      const totalTime = Date.now() - startTime;
      console.log(`✅ Total response time untuk slot ${slotId}: ${totalTime}ms, mode: ${minimal ? 'minimal' : 'full'}`);
      
      // 4. Return data dengan HTTP caching headers yang agresif
      const maxAge = minimal ? 60 : 30; // Cache lebih lama untuk respons minimal
      res.set('Cache-Control', `private, max-age=${maxAge}`);
      
      // Jika waktu respons terlalu lama, tambahkan header khusus
      if (totalTime > 3000) {
        res.set('X-Response-Time-Warning', `${totalTime}ms`);
      }
      
      return res.status(200).json({
        success: true,
        responseTime: totalTime,
        mode: minimal ? 'minimal' : 'full',
        ...result
      });
    } catch (error) {
      console.error(`❌ Error getting patients for therapy slot ${req.params.id}:`, error);
      // Pesan error yang lebih informatif
      return res.status(500).json({
        success: false,
        message: error instanceof Error 
          ? error.message 
          : "Terjadi kesalahan saat mengambil data pasien dalam slot terapi",
        errorType: error instanceof Error ? error.name : "Unknown",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Mendaftarkan pasien ke slot terapi (walk-in registration)
  app.post("/api/therapy-slots/:id/patients", requireAuth, async (req: Request, res: Response) => {
    try {
      const slotId = parseInt(req.params.id);
      const { patientId, notes } = req.body;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: "ID pasien diperlukan"
        });
      }
      
      // Dapatkan slot terapi
      const therapySlot = await storage.getTherapySlot(slotId);
      
      if (!therapySlot) {
        return res.status(404).json({ 
          success: false, 
          message: "Slot terapi tidak ditemukan" 
        });
      }
      
      // Dapatkan pasien
      const patient = await storage.getPatient(patientId);
      
      if (!patient) {
        return res.status(404).json({ 
          success: false, 
          message: "Pasien tidak ditemukan" 
        });
      }
      
      // Periksa apakah pasien sudah terdaftar di slot ini
      const appointments = await storage.getAppointmentsByTherapySlot(slotId);
      const existingAppointment = appointments.find(app => app.patientId === patientId);
      
      if (existingAppointment) {
        return res.status(409).json({ 
          success: false, 
          message: "Pasien sudah terdaftar di slot terapi ini",
          appointmentId: existingAppointment.id
        });
      }
      
      // Untuk registrasi walk-in, kita tidak perlu memeriksa kuota
      // Langsung buat appointment dengan status 'Active'
      // Gunakan format registrasi sesuai database
      const registrationNumber = `WLK-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getTime().toString().slice(-4)}`;
      const appointmentData = {
        patientId,
        therapySlotId: slotId,
        date: typeof therapySlot.date === 'string' ? therapySlot.date : new Date(therapySlot.date).toISOString(),
        timeSlot: therapySlot.timeSlot,
        status: 'Active', // Walk-in langsung active
        registrationNumber,
        notes: notes || `Walk-in registration pada ${new Date().toISOString()}`
      };
      
      // Tambahkan informasi walk-in dalam notes untuk tracking
      appointmentData.notes += " [WALKIN]";
      
      const appointment = await storage.createAppointment(appointmentData);
      
      // Tambahkan sessions jika pasien memiliki sesi aktif
      const sessions = await storage.getActiveSessionsByPatient(patientId);
      
      if (sessions.length > 0) {
        // Gunakan sesi pertama yang aktif
        const session = sessions[0];
        
        // Update appointment dengan sessionId menggunakan manual query karena storage
        // tidak memiliki metode updateAppointment
        const { pool } = require('../../db');
        await pool.query(
          `UPDATE appointments SET session_id = $1 WHERE id = $2`, 
          [session.id, appointment.id]
        );
        
        // Update penggunaan sesi - atomic increment (tanpa parameter kedua)
        await storage.updateSessionUsage(session.id);
      }
      
      return res.status(201).json({
        success: true,
        message: "Pasien berhasil didaftarkan ke slot terapi (walk-in)",
        patientId,
        appointmentId: appointment.id,
        therapySlot: {
          id: therapySlot.id,
          date: therapySlot.date,
          timeSlot: therapySlot.timeSlot
        }
      });
    } catch (error) {
      console.error("Error registering patient to therapy slot:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat mendaftarkan pasien ke slot terapi" 
      });
    }
  });

  // Menyinkronkan jumlah pasien dalam slot terapi
  app.post("/api/therapy-slots/sync", requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await storage.syncTherapySlotQuota();
      
      return res.status(200).json({
        success: true,
        message: `Berhasil menyinkronkan ${result.updatedSlots} slot terapi`,
        updatedSlots: result.updatedSlots,
        details: result.results
      });
    } catch (error) {
      console.error("Error syncing therapy slot quotas:", error);
      
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan saat menyinkronkan jumlah pasien dalam slot terapi" 
      });
    }
  });
}

/**
 * Menghasilkan nomor registrasi unik
 * @returns Nomor registrasi dengan format TTS-XXXXXX
 */
function generateRegistrationNumber(): string {
  const prefix = "TTS";
  const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
  return `${prefix}-${randomDigits}`;
}