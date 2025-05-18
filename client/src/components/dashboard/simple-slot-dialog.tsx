import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Loader2, CalendarIcon, User, ShoppingCart, MessageSquare, Check, AlertCircle,
  ClipboardCheck, CheckCircle, CalendarRange, Activity, CheckSquare, XCircle, UserX,
  FileText, CreditCard
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { generateWhatsAppLink } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface SimpleSlotDialogProps {
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

// Tipe data untuk slot terapi
interface SlotData {
  id: number;
  date: string | Date;
  timeSlot: string;
  maxQuota: number;
  currentCount: number;
  isActive?: boolean;
}

// Tipe data untuk pasien
interface PatientData {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  gender?: string;
  appointmentStatus?: string;
  appointmentId?: number;
  walkin?: boolean;
  patientId?: string;  // ID pasien dalam format P-YYYY-XXX
}

/**
 * Dialog komponen yang lebih sederhana untuk menampilkan detail slot terapi
 * dan daftar pasien yang terdaftar
 * 
 * Versi yang telah dibersihkan - non-hardcoded, menggunakan API dari server
 */
export function SimpleSlotDialog({ slotId, isOpen, onClose }: SimpleSlotDialogProps) {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (isOpen && slotId !== null) {
      loadSlotData(slotId);
    } else {
      // Reset state ketika dialog ditutup
      setSlotData(null);
      setPatients([]);
      setError(null);
    }
  }, [isOpen, slotId]);
  
  async function loadSlotData(slotId: number) {
    console.log(`[DEBUG] loadSlotData() dipanggil untuk slot ${slotId}`);
    setIsLoading(true);
    setError(null);
    
    try {
      // Log untuk debugging
      console.log(`[DEBUG SLOT ${slotId}] Menerima request untuk slot ID ${slotId}`);
      
      // Timestamp untuk menghindari cache
      const timestamp = Date.now();
      
      // 1. Mengambil data dasar slot terapi
      const basicResponse = await fetch(`/api/simple-slot/${slotId}/basic?_t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!basicResponse.ok) {
        throw new Error(`Gagal mendapatkan data dasar slot: ${basicResponse.status}`);
      }
      
      const basicData = await basicResponse.json();
      console.log(`[DEBUG] Data dasar slot terapi diterima:`, basicData);
      setSlotData(basicData);
      
      // 2. Mengambil data pasien untuk slot terapi
      const randomParam = Math.random().toString(36).substring(2, 15);
      const patientUrl = `/api/simple-slot/${slotId}/patients?_t=${timestamp}&nocache=${randomParam}`;
      
      const patientsResponse = await fetch(patientUrl, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!patientsResponse.ok) {
        throw new Error(`Gagal mendapatkan data pasien: ${patientsResponse.status}`);
      }
      
      // Baca response sebagai text terlebih dahulu
      const responseText = await patientsResponse.text();
      
      // Parse JSON dari text response
      let patientsData: PatientData[] = [];
      try {
        patientsData = JSON.parse(responseText);
        console.log(`[DEBUG] Data pasien terparse: ${patientsData.length} pasien ditemukan`);
      } catch (err) {
        console.error(`[DEBUG] Error parsing JSON dari response:`, err);
        patientsData = []; // Set default ke array kosong jika parsing gagal
      }
      
      // Set data pasien ke state
      setPatients(patientsData);
      setIsLoading(false);
    } catch (err) {
      console.error(`[ERROR] Gagal memuat data slot:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }
  }
  
  // Versi Final - Pendaftaran Walk-in Ultra Sederhana
  // State untuk form pendaftaran
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [formPatientName, setFormPatientName] = useState("");
  const [formPatientPhone, setFormPatientPhone] = useState("");
  
  async function handleRegisterPatient() {
    if (!slotData) return;
    
    // Buka halaman slot tracker
    window.location.href = `/slot-tracker?date=${format(new Date(slotData.date), "yyyy-MM-dd")}&slotId=${slotData.id}`;
  }
  
  async function handleSubmitRegistration() {
    if (!slotData || !formPatientName || !formPatientPhone) {
      toast({
        variant: "destructive",
        title: "Data tidak lengkap",
        description: "Mohon lengkapi nama dan nomor telepon pasien"
      });
      return;
    }
    
    try {
      // Tampilkan loading toast
      toast({
        title: "Mendaftarkan Pasien...",
        description: "Mohon tunggu sebentar",
      });
      
      // Data pendaftaran 
      const data = {
        name: formPatientName,
        phoneNumber: formPatientPhone,
        slotId: slotData.id
      };
      
      console.log("📝 Data pendaftaran:", data);
      
      // Panggil endpoint walkin
      const response = await fetch('/api/walkin-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formPatientName,
          phoneNumber: formPatientPhone,
          gender: "Laki-laki",
          birthDate: "1980-01-01",
          complaints: "Walk-in pasien",
          address: "Alamat default",
          slotId: slotData.id
        })
      });
      
      const responseText = await response.text();
      console.log("Raw response:", responseText);
      
      if (!response.ok) {
        throw new Error(`Gagal mendaftarkan pasien: ${responseText}`);
      }
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.log("Tidak dapat parse response sebagai JSON, menggunakan text response");
        result = { message: responseText };
      }
      
      console.log("✅ Hasil pendaftaran:", result);
      
      // Tampilkan sukses
      toast({
        title: "Pendaftaran Berhasil!",
        description: `Pasien ${formPatientName} telah didaftarkan untuk terapi`,
        className: "bg-green-50 border-green-200 text-green-800",
      });
      
      // Reset form
      setShowRegisterForm(false);
      setFormPatientName("");
      setFormPatientPhone("");
      
      // Reload data
      await loadSlotData(slotData.id);
      
      // Muat ulang data dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments/date/2025-05-18'] });
      
    } catch (error) {
      console.error("❌ Error pendaftaran walk-in:", error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Terjadi kesalahan saat mendaftarkan pasien";
      
      toast({
        variant: "destructive",
        title: "Gagal Mendaftar",
        description: errorMessage,
      });
    }
  }
  
  function formatAppointmentDate(dateString: string | Date): string {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      
      return format(date, "EEEE, d MMMM yyyy", { locale: localeId });
    } catch (e) {
      console.error(`Error formatting date: ${dateString}`, e);
      return String(dateString);
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        // Reset form saat dialog ditutup
        setShowRegisterForm(false);
        setFormPatientName("");
        setFormPatientPhone("");
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Detail Slot Terapi
          </DialogTitle>
          <DialogDescription>
            Informasi lengkap slot terapi dan daftar pasien yang terdaftar
          </DialogDescription>
        </DialogHeader>
        
        {/* Form pendaftaran pasien walk-in */}
        {showRegisterForm && (
          <div className="border rounded-md p-4 mb-4 bg-slate-50">
            <h3 className="text-lg font-medium mb-3">Daftarkan Pasien Walk-in</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label htmlFor="patientName" className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Pasien
                  </label>
                  <input
                    type="text"
                    id="patientName"
                    value={formPatientName}
                    onChange={(e) => setFormPatientName(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    placeholder="Masukkan nama pasien"
                  />
                </div>
                <div>
                  <label htmlFor="patientPhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor Telepon
                  </label>
                  <input
                    type="text"
                    id="patientPhone"
                    value={formPatientPhone}
                    onChange={(e) => setFormPatientPhone(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    placeholder="Masukkan nomor telepon"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowRegisterForm(false);
                    setFormPatientName("");
                    setFormPatientPhone("");
                  }}
                >
                  Batal
                </Button>
                <Button onClick={handleSubmitRegistration}>
                  Daftarkan
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Memuat data slot terapi...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
            <h3 className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-5 w-5" />
              Error
            </h3>
            <p className="mt-1 text-sm">{error.message}</p>
          </div>
        ) : slotData ? (
          <>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Tanggal</h3>
                  <p className="text-base font-semibold">
                    {formatAppointmentDate(slotData.date)}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Waktu</h3>
                  <p className="text-base font-semibold">{slotData.timeSlot}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Kuota</h3>
                <p className="text-base font-semibold">
                  {slotData.currentCount} / {slotData.maxQuota} Pasien
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                <div className="mt-1">
                  {slotData.isActive ? (
                    <Badge variant="success">Aktif</Badge>
                  ) : (
                    <Badge variant="destructive">Nonaktif</Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-6 border-t pt-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Daftar Pasien</h2>
                <Button 
                  onClick={handleRegisterPatient}
                  disabled={!slotData.isActive}
                  className={slotData.currentCount >= slotData.maxQuota ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                >
                  <User className="mr-2 h-4 w-4" />
                  {slotData.currentCount >= slotData.maxQuota 
                    ? `Daftarkan Pasien (${slotData.currentCount}/${slotData.maxQuota})` 
                    : "Daftarkan Pasien"}
                </Button>
              </div>
              
              <div className="mt-4">
                {patients.length > 0 ? (
                  <div className="space-y-3">
                    {patients.map((patient) => (
                      <div 
                        key={patient.id} 
                        className="flex flex-col rounded-lg border p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{patient.name}</h3>
                              {patient.walkin && (
                                <Badge variant="secondary" className="text-xs">Walk In</Badge>
                              )}
                            </div>
                            {patient.phone && (
                              <p className="text-sm text-muted-foreground">
                                {patient.phone}
                              </p>
                            )}
                          </div>
                          
                          <div>
                            <Badge 
                              variant={
                                patient.appointmentStatus === "Cancelled" ? "destructive" :
                                patient.appointmentStatus === "Completed" ? "success" :
                                patient.appointmentStatus === "Active" ? "success" :
                                "default"
                              }
                              className="ml-auto"
                            >
                              {patient.appointmentStatus || "Terdaftar"}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Tindakan cepat untuk pasien */}
                        <div className="mt-2 flex items-center justify-end space-x-2">
                          {patient.phone && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a 
                                href={generateWhatsAppLink(patient.phone || "", "Pengingat: Jadwal terapi Anda tanggal " + formatAppointmentDate(slotData ? slotData.date : new Date()) + " pukul " + (slotData?.timeSlot || "-") + ". Harap datang tepat waktu. Terima kasih.")} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <MessageSquare className="mr-1 h-3 w-3" />
                                WhatsApp
                              </a>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Navigasi ke halaman detail pasien
                              window.location.href = `/patients/${patient.id}`;
                            }}
                          >
                            <User className="mr-1 h-3 w-3" />
                            Detail
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.preventDefault();
                              
                              // Langsung set data yang diperlukan di localStorage
                              localStorage.setItem('use_fixed_endpoints', 'true');
                              localStorage.setItem('pendingTransactionPatientId', String(patient.id));
                              localStorage.setItem('pendingTransactionPatientName', patient.name);
                              localStorage.setItem('openTransactionFormDirectly', 'true');
                              localStorage.setItem('cache_bust_timestamp', Date.now().toString());
                              
                              // Buka halaman transaksi di halaman yang sama
                              window.location.href = `/transactions?patientId=${patient.id}&patientName=${encodeURIComponent(patient.name)}&hideDropdown=true&delay=100&source=optimized-dialog&useFixed=true&timestamp=${Date.now()}`;
                            }}
                          >
                            <CreditCard className="mr-1 h-3 w-3" />
                            Transaksi
                          </Button>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline">
                                <Activity className="mr-1 h-3 w-3" />
                                Status
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem 
                                onClick={async () => {
                                  if (!patient.appointmentId) return;
                                  
                                  try {
                                    const response = await apiRequest(`/api/appointments/${patient.appointmentId}/status`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ status: 'Completed' })
                                    });
                                    
                                    if (response.ok) {
                                      // Refresh data
                                      toast({
                                        title: "Status diperbarui",
                                        description: `Appointment untuk ${patient.name} telah diselesaikan.`,
                                        variant: "default"
                                      });
                                      
                                      loadSlotData(slotId!);
                                      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
                                    } else {
                                      toast({
                                        title: "Gagal memperbarui status",
                                        description: "Terjadi kesalahan saat memperbarui status.",
                                        variant: "destructive"
                                      });
                                    }
                                  } catch (error) {
                                    toast({
                                      title: "Gagal memperbarui status",
                                      description: String(error),
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                Tandai Selesai
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem 
                                onClick={async () => {
                                  if (!patient.appointmentId) return;
                                  
                                  try {
                                    const response = await apiRequest(`/api/appointments/${patient.appointmentId}/status`, {
                                      method: 'PATCH',
                                      body: JSON.stringify({ status: 'Cancelled' })
                                    });
                                    
                                    if (response.ok) {
                                      // Refresh data
                                      toast({
                                        title: "Status diperbarui",
                                        description: `Appointment untuk ${patient.name} telah dibatalkan.`,
                                        variant: "default"
                                      });
                                      
                                      loadSlotData(slotId!);
                                      queryClient.invalidateQueries({ queryKey: ['/api/therapy-slots'] });
                                    } else {
                                      toast({
                                        title: "Gagal memperbarui status",
                                        description: "Terjadi kesalahan saat memperbarui status.",
                                        variant: "destructive"
                                      });
                                    }
                                  } catch (error) {
                                    toast({
                                      title: "Gagal memperbarui status",
                                      description: String(error),
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                <XCircle className="mr-2 h-4 w-4 text-red-600" />
                                Batalkan
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8">
                    <UserX className="h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Belum ada pasien terdaftar pada slot ini.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-amber-50 p-4 text-amber-600">
            <h3 className="flex items-center gap-2 font-semibold">
              <AlertCircle className="h-5 w-5" />
              Tidak Ada Data
            </h3>
            <p className="mt-1 text-sm">
              Tidak dapat menemukan data slot terapi. Silakan coba lagi nanti.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}