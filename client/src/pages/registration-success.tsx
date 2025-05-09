import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CheckCircle, Clock, User, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fungsi untuk memformat tanggal lahir
function formatBirthDate(dateStr: string) {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return format(date, "dd MMMM yyyy", { locale: idLocale });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Fungsi untuk memperbaiki format time slot yang salah (10:00-00:00)
 * @param timeSlot waktu dalam format "HH:MM-HH:MM"
 * @returns waktu yang sudah diperbaiki
 */
function fixTimeSlotFormat(timeSlot: string): string {
  if (!timeSlot) return "";
  
  // Jika formatnya sudah benar, langsung kembalikan
  if (!timeSlot.endsWith("-00:00")) return timeSlot;
  
  // Ekstrak waktu awal
  const startTime = timeSlot.split("-")[0];
  
  // Cek pola dan perbaiki berdasarkan waktu mulai
  switch (startTime) {
    case "10:00": return "10:00-12:00";
    case "13:00": return "13:00-15:00";
    case "15:00": return "15:00-17:00";
    case "17:00": return "17:00-19:00";
    default: return timeSlot; // Jika tidak ada pola yang cocok, kembalikan aslinya
  }
}

export default function RegistrationSuccessPage() {
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Debug: cek parameter URL saat halaman dimuat
    console.log("URL params halaman success:", window.location.search);
    const params = new URLSearchParams(window.location.search);
    const timeParam = params.get('t');
    const sourceParam = params.get('src');
    console.log(`Params: timestamp=${timeParam}, source=${sourceParam}`);
    
    let isMounted = true; // Flag untuk mencegah state update pada komponen yang unmounted
    
    // Fungsi untuk mengambil data dari localStorage dengan safe handling
    function loadData() {
      try {
        console.log("Mencoba memuat data dari localStorage...");
        const savedData = localStorage.getItem('registrationData');
        const statusData = localStorage.getItem('registrationStatus');
        
        console.log(`Status data di localStorage: ${statusData || 'tidak ada'}`);
        
        if (savedData && isMounted) {
          console.log("Data ditemukan di localStorage");
          
          try {
            const parsedData = JSON.parse(savedData);
            console.log("Data berhasil di-parse:", parsedData);
            
            // Pastikan data yang diload valid
            if (parsedData && parsedData.name && parsedData.phoneNumber) {
              // Cek jika komponen masih mounted sebelum update state
              if (isMounted) {
                setRegistrationData(parsedData);
                console.log("Data registrasi berhasil dimuat dari localStorage");
                
                // Jika dimuat dari timeout, tambahkan status
                if (parsedData.fromTimeout) {
                  console.log("PERHATIAN: Data dimuat dari timeout fallback!");
                }
                
                // Jika data complete dari server
                if (parsedData.isComplete) {
                  console.log("Data pendaftaran lengkap dari server");
                }
              }
            } else {
              console.warn("Data registrasi tidak valid:", parsedData);
            }
          } catch (parseError) {
            console.error("Error parsing data JSON:", parseError);
          }
        } else {
          console.warn("Tidak ada data registrasi di localStorage");
        }
      } catch (error) {
        console.error("Error loading registration data:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    // Load data single-instance function, tanpa multiple timers
    loadData();

    // Hanya satu backup timer dengan waktu yang cukup
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        // Cek status data langsung dari localStorage, bukan dari state
        const hasData = localStorage.getItem('registrationData') !== null;
        if (!hasData) {
          console.log("Mencoba memuat data registrasi lagi setelah 1 detik...");
          loadData();
        }
      }
    }, 1000);

    return () => {
      // Catat bahwa komponen sudah unmounted
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // Tampilkan loading state jika data belum siap
  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 text-center mt-8">
        <Card className="bg-white shadow-md border border-green-100 p-4">
          <div className="flex justify-center my-6">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
          </div>
          <p className="text-lg font-medium text-gray-700">Memuat bukti pendaftaran...</p>
          <p className="text-sm text-gray-500 mt-2">Mohon tunggu sebentar</p>
        </Card>
      </div>
    );
  }

  // Jika tidak ada data, tampilkan pesan error
  if (!registrationData) {
    // Ambil parameter URL untuk debugging
    const params = new URLSearchParams(window.location.search);
    const timeParam = params.get('t');
    const sourceParam = params.get('src');
    
    // Cek apakah ada upaya loading yang gagal tercatat
    const loadingFailed = localStorage.getItem('registrationLoadingFailed');
    const loadingFailedAt = localStorage.getItem('registrationLoadingFailedAt');
    
    // Coba ambil data raw dari localStorage untuk diagnostic
    const rawStoredData = localStorage.getItem('registrationData');
    const statusData = localStorage.getItem('registrationStatus');
    
    return (
      <div className="container max-w-md mx-auto p-4 mt-8">
        <Card className="bg-white shadow-md">
          <CardHeader className="bg-red-50 border-b border-red-100">
            <CardTitle className="text-center text-xl text-red-800">Data Tidak Ditemukan</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-center mb-4">
              Tidak dapat menemukan data pendaftaran Anda. Silakan mendaftar kembali.
            </p>
            <div className="flex justify-center">
              <Button onClick={() => window.location.href = "/register?code=TTS-A13EWC"} className="mt-2">
                Kembali ke Pendaftaran
              </Button>
            </div>
            
            {/* Informasi teknis untuk debugging - Hanya tersedia di development */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="mt-6 border-t pt-4">
                <details>
                  <summary className="text-xs text-gray-500 cursor-pointer">Informasi Debug</summary>
                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    <p>URL Source: {sourceParam || 'tidak ada'}</p>
                    <p>Timestamp: {timeParam || 'tidak ada'}</p>
                    <p>Loading Failed: {loadingFailed || 'false'}</p>
                    {loadingFailedAt && <p>Failed At: {loadingFailedAt}</p>}
                    <p>Storage Status: {statusData || 'tidak ada'}</p>
                    <p>Raw Data: {rawStoredData ? '(data tersedia)' : '(tidak ada data)'}</p>
                    {rawStoredData && <pre className="mt-2 overflow-auto max-h-32 text-xs p-1 bg-gray-100 rounded">{rawStoredData}</pre>}
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tampilkan halaman sukses dengan data yang dimuat
  return (
    <div id="registration-success-page" className="container max-w-2xl mx-auto p-4 mt-4">
      <Card className="bg-white shadow-md">
        <CardHeader className="bg-green-50 border-b border-green-100">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
          <CardTitle className="text-center text-2xl text-green-800">Pendaftaran Berhasil!</CardTitle>
          <CardDescription className="text-center text-green-700">
            Terima kasih telah mendaftar di klinik Terapi Titik Sumber
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                <User className="mr-2 h-4 w-4" />
                Data Pasien
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-gray-500">Nama</p>
                  <p className="font-medium">{registrationData.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nomor HP</p>
                  <p className="font-medium">{registrationData.phoneNumber}</p>
                </div>
                {registrationData.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{registrationData.email}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Tanggal Lahir</p>
                  <p className="font-medium">{formatBirthDate(registrationData.birthDate || "")}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Jenis Kelamin</p>
                  <p className="font-medium">{registrationData.gender}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Alamat</p>
                  <p className="font-medium">{registrationData.address}</p>
                </div>
              </div>
            </div>

            {registrationData.slotInfo && (
              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                  <Clock className="mr-2 h-4 w-4" />
                  Detail Jadwal Terapi
                </h3>
                <div className="bg-blue-50 p-3 rounded-md border border-blue-100 flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center mb-2 md:mb-0">
                    <CalendarIcon className="mr-2 h-4 w-4 text-blue-700" />
                    <span className="text-blue-900 font-medium">
                      {(() => {
                        try {
                          // Jika tanggal sudah dalam format DD MMM YYYY, tampilkan langsung
                          if (/^\d{1,2}\s[A-Za-z]{3}\s\d{4}$/.test(registrationData.slotInfo.date)) {
                            return registrationData.slotInfo.date;
                          }
                          // Jika tidak, coba format dengan date-fns
                          return format(new Date(registrationData.slotInfo.date), "EEEE, dd MMMM yyyy", { locale: idLocale });
                        } catch (e) {
                          // Fallback ke tampilan tanggal mentah
                          return registrationData.slotInfo.date;
                        }
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-blue-700" />
                    <span className="text-blue-900 font-medium">
                      {fixTimeSlotFormat(registrationData.slotInfo.timeSlot)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-b pb-4">
              <h3 className="font-medium text-gray-700 mb-2">Informasi Penting</h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Mohon datang 15 menit sebelum jadwal terapi</li>
                <li>Lakukan konfirmasi kehadiran melalui WhatsApp</li>
                <li>Bawa kartu identitas untuk verifikasi</li>
                {/* Peringatan tentang format waktu sudah tidak diperlukan karena format sudah otomatis diperbaiki */}
              </ul>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => window.location.href = "/register?code=TTS-A13EWC"} className="w-full sm:w-auto">
            Pendaftaran Baru
          </Button>
          
          {/* Debug info - hanya di development */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="w-full mt-6 border-t pt-4">
              <details>
                <summary className="text-xs text-gray-500 cursor-pointer">Informasi Debug</summary>
                <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                  <p>Source Data: {registrationData.fromTimeout ? 'Timeout Fallback' : 'Server Response'}</p>
                  <p>Data Lengkap: {registrationData.isComplete ? 'Ya' : 'Tidak'}</p>
                  <p>Timestamp: {registrationData.timestamp}</p>
                  <p>Total Properti: {Object.keys(registrationData).length}</p>
                  
                  {/* Tampilkan kunci data yang dikirim */}
                  <div className="mt-2">
                    <p className="font-medium">Data Properties:</p>
                    <ul className="list-disc list-inside">
                      {Object.keys(registrationData).map(key => (
                        <li key={key}>{key}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}