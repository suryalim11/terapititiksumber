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

export default function RegistrationSuccessPage() {
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fungsi untuk mengambil data dari localStorage dengan safe handling
    function loadData() {
      try {
        const savedData = localStorage.getItem('registrationData');
        const statusData = localStorage.getItem('registrationStatus');
        
        if (savedData && statusData === 'success') {
          const parsedData = JSON.parse(savedData);
          // Pastikan data yang diload valid
          if (parsedData && parsedData.name && parsedData.phoneNumber) {
            setRegistrationData(parsedData);
            console.log("Data registrasi berhasil dimuat dari localStorage");
          } else {
            console.warn("Data registrasi tidak valid:", parsedData);
          }
        } else {
          console.warn("Tidak ada data registrasi di localStorage");
        }
      } catch (error) {
        console.error("Error loading registration data:", error);
      } finally {
        setLoading(false);
      }
    }

    // Panggil fungsi untuk load data segera
    loadData();

    // Coba lagi dalam 800ms jika tidak ada data (untuk redundansi)
    const timeoutId = setTimeout(() => {
      if (!registrationData) {
        console.log("Mencoba memuat data registrasi lagi...");
        loadData();
      }
    }, 800);

    return () => {
      console.log("Membersihkan timer");
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
                      {format(new Date(registrationData.slotInfo.date), "EEEE, dd MMMM yyyy", { locale: idLocale })}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="mr-2 h-4 w-4 text-blue-700" />
                    <span className="text-blue-900 font-medium">
                      {registrationData.slotInfo.timeSlot}
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