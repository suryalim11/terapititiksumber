import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CheckCircle, Clock, User, CalendarIcon, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Format tanggal lahir
function formatBirthDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return format(date, "dd MMMM yyyy", { locale: idLocale });
  } catch (e) {
    return dateStr;
  }
}

export default function RegistrationSuccessPage() {
  const { toast } = useToast();
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Coba ambil data dari localStorage
      const savedData = localStorage.getItem('registrationData');
      const savedStatus = localStorage.getItem('registrationStatus');
      
      console.log("Memeriksa data dari localStorage");
      console.log("Status:", savedStatus);
      console.log("Data tersedia:", !!savedData);
      
      if (savedData && savedStatus === 'success') {
        console.log("Data pendaftaran ditemukan di localStorage");
        
        // Pulihkan data pendaftaran
        const data = JSON.parse(savedData);
        setRegistrationData(data);
        
        console.log("Berhasil memulihkan data pendaftaran dari localStorage", data);
        
        // Notifikasi sukses
        toast({
          title: "Data Pendaftaran Ditemukan",
          description: "Menampilkan detail pendaftaran Anda.",
          className: "bg-green-50 border-green-200 text-green-800",
        });
        
        // Nonaktifkan loading state
        setLoading(false);
      } else {
        console.error("Tidak ada data pendaftaran yang valid di localStorage");
        toast({
          variant: "destructive",
          title: "Data Tidak Ditemukan",
          description: "Tidak dapat menemukan data pendaftaran Anda. Silakan mendaftar kembali.",
        });
        
        // Redirect ke halaman pendaftaran setelah delay
        setTimeout(() => {
          window.location.href = "/register";
        }, 3000);
      }
    } catch (e) {
      console.error("Error memulihkan data pendaftaran:", e);
      toast({
        variant: "destructive",
        title: "Error Memuat Data",
        description: "Terjadi kesalahan saat memuat data pendaftaran. Silakan coba lagi.",
      });
      
      // Redirect ke halaman pendaftaran setelah delay
      setTimeout(() => {
        window.location.href = "/register";
      }, 3000);
    }
  }, [toast]);

  // Tampilkan loading state jika data belum siap
  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 text-center">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
        <p className="mt-4 text-gray-600">Memuat data pendaftaran...</p>
      </div>
    );
  }

  // Jika tidak ada data, tampilkan pesan error
  if (!registrationData) {
    return (
      <div className="container max-w-md mx-auto p-4">
        <Card className="bg-white shadow-md">
          <CardHeader className="bg-red-50 border-b border-red-100">
            <CardTitle className="text-center text-xl text-red-800">Data Tidak Ditemukan</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-center mb-4">
              Tidak dapat menemukan data pendaftaran Anda. Silakan mendaftar kembali.
            </p>
            <div className="flex justify-center">
              <Button onClick={() => window.location.href = "/register"} className="mt-2">
                Kembali ke Pendaftaran
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tampilkan halaman sukses dengan data yang dimuat
  return (
    <div id="registration-success-page" className="container max-w-2xl mx-auto p-4">
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

            {registrationData.appointment && (
              <div className="border-b pb-4">
                <h3 className="font-medium text-gray-700 mb-2 flex items-center">
                  <Clock className="mr-2 h-4 w-4" />
                  Detail Jadwal Terapi
                </h3>
                <div className="bg-blue-50 p-3 rounded-md border border-blue-100 flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center mb-2 md:mb-0">
                    <CalendarIcon className="mr-2 h-4 w-4 text-blue-700" />
                    <span className="text-blue-900 font-medium">
                      {format(new Date(registrationData.appointment.date), "EEEE, dd MMMM yyyy", { locale: idLocale })}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-blue-700" />
                    <span className="text-blue-900 font-medium">
                      {registrationData.appointment.timeSlot}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-b pb-4">
              <h3 className="font-medium text-gray-700 mb-2">Informasi Penting</h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Silakan simpan bukti pendaftaran ini sebagai referensi</li>
                <li>Mohon datang 15 menit sebelum jadwal terapi</li>
                <li>Harap lakukan konfirmasi kehadiran melalui WhatsApp</li>
                <li>Bawa kartu identitas untuk verifikasi</li>
              </ul>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3">
          {registrationData.appointment && (
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Unduh Bukti Pendaftaran
            </Button>
          )}
          <Button onClick={() => window.location.href = "/register?code=TTS-A13EWC"} variant="outline" className="w-full sm:w-auto">
            Pendaftaran Baru
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}