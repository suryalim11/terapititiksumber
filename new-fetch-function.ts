  const fetchSlotAndAppointments = async () => {
    console.log("Memulai proses load data slot dan pasien");
    
    // Skip jika sudah ada fetch yang sedang berjalan
    if (fetchInProgressRef.current) {
      console.log("Ada fetch yang sedang berjalan, skip request");
      return;
    }
    
    // Set flag bahwa fetch sedang berjalan
    fetchInProgressRef.current = true;
    
    // Reset state
    setIsLoading(true);
    setError(null);
    
    if (!slotId) {
      // Missing slot ID handling
      setIsLoading(false);
      setError(new Error("Slot ID tidak tersedia"));
      fetchInProgressRef.current = false;
      return;
    }
    
    // Dapatkan tanggal saat ini untuk fallback
    const todayString = new Date().toISOString().split('T')[0];
    const fetchStartTime = Date.now();
    
    try {
      console.log(`Mengambil data slot dan pasien untuk ID: ${slotId}`);
      
      // TEKNIK BARU: Gunakan endpoint yang sudah dioptimasi
      // dengan single query dari server untuk slot + appointments sekaligus
      try {
        // Gunakan endpoint yang telah dioptimalkan
        const optimizedEndpoint = `/api/therapy-slots/${slotId}/patients`;
        
        console.log(`Memanggil endpoint optimized: ${optimizedEndpoint}`);
        
        // Setel cache control dan timeout yang tepat
        const response = await fetchWithTimeout(
          optimizedEndpoint, 
          {
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache, no-store',
              'Pragma': 'no-cache'
            }
          },
          6000,  // Timeout 6 detik
          2      // 2x retry
        );
        
        if (response.ok) {
          // Respons berupa { slot: {...}, appointments: [...] }
          const result = await response.json();
          console.log(`Data diterima dari endpoint optimized dengan ${result.appointments ? result.appointments.length : 0} appointments`);
          
          // Set data
          setSlotData(result.slot);
          setAppointmentData(result.appointments || []);
          
          // Cache data ke localStorage untuk backup
          try {
            // Cache slot data untuk penggunaan future
            const slotsData = localStorage.getItem('slotsData');
            const parsedSlots = slotsData ? JSON.parse(slotsData) : [];
            
            // Update atau tambahkan slot ini ke cache
            if (result.slot) {
              const existingIndex = parsedSlots.findIndex((s: any) => s.id === result.slot.id);
              if (existingIndex >= 0) {
                parsedSlots[existingIndex] = result.slot;
              } else {
                parsedSlots.push(result.slot);
              }
              
              // Simpan kembali ke localStorage
              localStorage.setItem('slotsData', JSON.stringify(parsedSlots));
            }
          } catch (cacheError) {
            // Silent error untuk caching
          }
          
          const fetchEndTime = Date.now();
          console.log(`Slot data fetch selesai dalam ${fetchEndTime - fetchStartTime}ms`);
          
          // Berhasil mendapatkan data, keluar dari fungsi
          setIsLoading(false);
          fetchInProgressRef.current = false;
          return;
        } else {
          console.error(`Error respons dari endpoint optimized: ${response.status}`);
          // Jika respons tidak ok, gunakan fallback
          throw new Error(`Endpoint tidak berhasil: ${response.status}`);
        }
      } catch (optimizedError) {
        console.error("Error saat menggunakan endpoint optimized:", optimizedError);
        // Lanjut ke fallback
      }
      
      // FALLBACK: Jika endpoint optimized gagal
      // Gunakan pendekatan mendapatkan data slot dan appointments terpisah
      console.log("Menggunakan fallback strategy...");
      
      // 1. Dapatkan data slot dasar
      let slotResult = null;
      try {
        const slotEndpoint = `/api/therapy-slots/${slotId}`;
        const slotResponse = await fetchWithTimeout(
          slotEndpoint, 
          {
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache, no-store'
            }
          },
          3000,
          1
        );
        
        if (slotResponse.ok) {
          slotResult = await slotResponse.json();
          console.log("Berhasil mendapatkan data slot dari fallback");
        }
      } catch (slotError) {
        console.error("Error saat mengambil data slot fallback:", slotError);
      }
      
      // 2. Jika masih tidak ada data slot, gunakan data minimal dari parameter atau localStorage
      if (!slotResult) {
        console.log("Menggunakan data slot minimal dari props atau cache");
        
        // Gunakan tanggal dan waktu slot yang diteruskan sebagai props jika tersedia
        const fallbackDate = slotDate || todayString;
        const fallbackTimeSlot = slotTimeSlot || "Data tidak tersedia";
        
        // Coba cari data slot yang sesuai dari localStorage
        let actualQuota = 0;
        let actualCurrentCount = 0;
        
        try {
          const slotsDataString = localStorage.getItem('slotsData');
          if (slotsDataString) {
            const slotsData = JSON.parse(slotsDataString);
            if (Array.isArray(slotsData) && slotsData.length > 0) {
              const matchingSlot = slotsData.find((slot: any) => 
                slot.date.includes(fallbackDate.split(' ')[0]) && 
                slot.timeSlot === fallbackTimeSlot
              );
              
              if (matchingSlot) {
                actualQuota = matchingSlot.maxQuota || 0;
                actualCurrentCount = matchingSlot.currentCount || 0;
              }
            }
          }
        } catch (error) {
          // Silent error handling for cache data lookup
        }
        
        // Default slot dengan data minimal
        slotResult = {
          id: Number(slotId),
          date: fallbackDate,
          timeSlot: fallbackTimeSlot,
          currentCount: actualCurrentCount,
          maxQuota: actualQuota || 6, // Default 6 jika tidak ada data
          isActive: true
        };
        
        // Set warning tapi tetap tampilkan UI
        setError(new Error("Data slot tidak dapat diambil dari server. Menggunakan informasi minimal."));
      }
      
      // 3. Set slot data ke state
      setSlotData(slotResult);
      
      // 4. Ambil appointment data (hanya jika slot data valid)
      let appointmentsData: any[] = [];
      if (slotResult) {
        // Format tanggal untuk appointment query
        let formattedDate: string;
        try {
          formattedDate = typeof slotResult.date === 'string' 
            ? slotResult.date.split(' ')[0] // Extract YYYY-MM-DD
            : new Date(slotResult.date).toISOString().split('T')[0];
        } catch (dateError) {
          formattedDate = todayString; // Fallback ke hari ini
        }
        
        try {
          console.log(`Mendapatkan appointments untuk tanggal ${formattedDate}`);
          const appointmentsResponse = await fetchWithTimeout(
            `/api/appointments/date/${formattedDate}`,
            {
              headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
              },
            },
            5000,
            1
          );
          
          if (appointmentsResponse.ok) {
            const allAppointments = await appointmentsResponse.json();
            
            if (Array.isArray(allAppointments)) {
              // Filter untuk slot ini saja
              appointmentsData = allAppointments.filter((app: any) => {
                if (!app) return false;
                return Number(app.therapySlotId) === Number(slotId);
              });
              
              console.log(`Ditemukan ${appointmentsData.length} appointments untuk slot ini`);
            }
          }
        } catch (appointmentsError) {
          console.error("Error saat mengambil data appointments:", appointmentsError);
          appointmentsData = []; // Empty appointments array as fallback
        }
      }
      
      // Set appointments data
      setAppointmentData(appointmentsData);
      
    } catch (mainError) {
      // General error handling
      console.error("Error umum di fetchSlotAndAppointments:", mainError);
      setError(new Error("Terjadi kesalahan saat mengambil data"));
      
      // Bersihkan stale data jika ada error
      setSlotData(null);
      setAppointmentData([]);
    } finally {
      const fetchEndTime = Date.now();
      const totalFetchTime = fetchEndTime - fetchStartTime;
      
      console.log(`Seluruh proses fetch selesai dalam ${totalFetchTime}ms`);
      
      // Set loading state ke false di akhir operasi
      setIsLoading(false);
      
      // Reset flag bisa fetch lagi
      fetchInProgressRef.current = false;
    }
  };