import { useEffect, useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, User, Clock, Calendar as CalendarIcon } from "lucide-react";

// Helper untuk format tanggal lahir
function formatBirthDate(dateStr: string) {
  if (!dateStr) return "-";
  
  try {
    return format(new Date(dateStr), "dd MMMM yyyy", { locale: idLocale });
  } catch (e) {
    return dateStr; // Fallback ke string asli jika format gagal
  }
}

// Helper untuk format tanggal dengan safe handling
function formatDateSafe(dateStr: string) {
  try {
    // Jika sudah dalam format tertentu (mis. "09 Mei 2025"), tampilkan langsung
    if (/^\d{1,2}\s[A-Za-z]+\s\d{4}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Jika masih ISO atau format lain, ubah ke format yang lebih bagus
    return format(new Date(dateStr), "EEEE, dd MMMM yyyy", { locale: idLocale });
  } catch (e) {
    return dateStr; // Kembalikan string asli jika parsing gagal
  }
}

export default function RegistrationSuccessPage() {
  const [regData, setRegData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    // Fungsi untuk memuat data dari localStorage
    const loadRegistrationData = () => {
      try {
        const savedData = localStorage.getItem('registrationData');
        
        if (!savedData) {
          if (mounted) {
            setError("Data pendaftaran tidak ditemukan");
            setLoading(false);
          }
          return;
        }
        
        try {
          const data = JSON.parse(savedData);
          
          // Validasi data minimal yang dibutuhkan
          if (!data.name || !data.phoneNumber) {
            if (mounted) {
              setError("Data pendaftaran tidak lengkap");
              setLoading(false);
            }
            return;
          }
          
          // Set data ke state jika valid
          if (mounted) {
            setRegData(data);
            setLoading(false);
          }
        } catch (parseError) {
          console.error("Error parsing registration data:", parseError);
          if (mounted) {
            setError("Gagal membaca data pendaftaran");
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Error loading data:", err);
        if (mounted) {
          setError("Terjadi kesalahan saat memuat data");
          setLoading(false);
        }
      }
    };
    
    // Load data
    loadRegistrationData();
    
    // Cleanup function - mencegah update state setelah unmount
    return () => {
      mounted = false;
    };
  }, []);
  
  // Tampilkan loading indicator
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
  
  // Tampilkan error jika terjadi kesalahan
  if (error || !regData) {
    return (
      <div className="container max-w-md mx-auto p-4 mt-8">
        <Card className="bg-white shadow-md">
          <CardHeader className="bg-red-50 border-b border-red-100">
            <CardTitle className="text-center text-xl text-red-800">Data Tidak Ditemukan</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-center mb-4">
              {error || "Tidak dapat menemukan data pendaftaran Anda. Silakan mendaftar kembali."}
            </p>
            <div className="flex justify-center">
              <Button onClick={() => window.location.href = "/register?code=TTS-A13EWC"} className="mt-2">
                Kembali ke Pendaftaran
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Tampilkan halaman sukses dengan data
  return (
    <div className="container max-w-2xl mx-auto p-4 mt-4">
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
            {/* Data Pasien */}
            <div className="border-b pb-4">
              <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                <User className="mr-2 h-4 w-4" />
                Data Pasien
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-gray-500">Nama</p>
                  <p className="font-medium">{regData.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nomor HP</p>
                  <p className="font-medium">{regData.phoneNumber}</p>
                </div>
                {regData.email && (
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{regData.email}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Tanggal Lahir</p>
                  <p className="font-medium">{formatBirthDate(regData.birthDate || "")}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Jenis Kelamin</p>
                  <p className="font-medium">{regData.gender}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-sm text-gray-500">Alamat</p>
                  <p className="font-medium">{regData.address}</p>
                </div>
              </div>
            </div>

            {/* Detail Jadwal */}
            {regData.slotInfo && (
              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                  <Clock className="mr-2 h-4 w-4" />
                  Detail Jadwal Terapi
                </h3>
                <div className="bg-blue-50 p-3 rounded-md border border-blue-100 flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center mb-2 md:mb-0">
                    <CalendarIcon className="mr-2 h-4 w-4 text-blue-700" />
                    <span className="text-blue-900 font-medium">
                      {formatDateSafe(regData.slotInfo.date)}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-blue-700" />
                    <span className="text-blue-900 font-medium">
                      {regData.slotInfo.timeSlot}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Informasi Penting */}
            <div className="border-b pb-4">
              <h3 className="font-medium text-gray-700 mb-2">Informasi Penting</h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Mohon datang 15 menit sebelum jadwal terapi</li>
                <li>Lakukan konfirmasi kehadiran melalui WhatsApp</li>
                <li>Bawa kartu identitas untuk verifikasi</li>
              </ul>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => window.location.href = "/register?code=TTS-A13EWC"} className="w-full sm:w-auto">
            Pendaftaran Baru
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}