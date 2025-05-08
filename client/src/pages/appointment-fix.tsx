import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { ExternalLink, MessageCircle, Check, AlertTriangle } from "lucide-react";

export default function AppointmentFixPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    patientName: "Agus lim",
    birthDate: "1969-01-20",
    therapySlotId: "442"
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/fix/create-missing-appointment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Menambahkan ini untuk mengirim cookie/session
        body: JSON.stringify({
          patientName: formData.patientName,
          birthDate: formData.birthDate,
          therapySlotId: parseInt(formData.therapySlotId)
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        toast({
          title: "Berhasil",
          description: "Appointment berhasil dibuat ulang",
          variant: "default",
        });
      } else {
        setError(data.message || "Gagal memperbaiki appointment");
        toast({
          title: "Gagal",
          description: data.message || "Terjadi kesalahan saat memperbaiki appointment",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Terjadi kesalahan saat menghubungi server");
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat menghubungi server",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Perbaikan Appointment yang Hilang</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Informasi Perbaikan</CardTitle>
          <CardDescription>
            Halaman ini digunakan untuk memperbaiki appointment yang gagal terbuat karena timeout saat pendaftaran.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Perhatian</AlertTitle>
            <AlertDescription>
              Gunakan halaman ini hanya jika pasien berhasil terdaftar tetapi tidak muncul di daftar pasien pada jadwal terapi.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="patientName">Nama Pasien</Label>
                <Input
                  id="patientName"
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="birthDate">Tanggal Lahir (YYYY-MM-DD)</Label>
                <Input
                  id="birthDate"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleInputChange}
                  placeholder="1990-01-01"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="therapySlotId">ID Slot Terapi</Label>
                <Input
                  id="therapySlotId"
                  name="therapySlotId"
                  value={formData.therapySlotId}
                  onChange={handleInputChange}
                  type="number"
                  required
                />
              </div>
              
              <Button type="submit" disabled={loading}>
                {loading ? <Spinner className="mr-2" /> : null}
                {loading ? "Memproses..." : "Perbaiki Appointment"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center">
                <Check className="h-5 w-5 mr-2 text-green-500" />
                Appointment Berhasil Dibuat
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="font-semibold">Pasien:</span> {result.patient.name} (ID: {result.patient.id})
              </div>
              <div>
                <span className="font-semibold">Slot Terapi:</span> Tanggal {new Date(result.therapySlot.date).toLocaleDateString('id-ID')} 
                Pukul {result.therapySlot.timeSlot} (ID: {result.therapySlot.id})
              </div>
              <div>
                <span className="font-semibold">Appointment ID:</span> {result.appointment.id}
              </div>
              <div>
                <span className="font-semibold">Status:</span> {result.appointment.status}
              </div>
              
              <div className="pt-4">
                <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Kembali ke Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}