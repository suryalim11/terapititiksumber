import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';

interface DuplicateSlotGroup {
  date: string;
  time_slot: string;
  count: number;
  slot_ids: number[];
  current_counts: number[];
}

interface ConsolidationDetail {
  originalSlotId: number;
  targetSlotId: number;
  timeSlot: string;
  movedAppointments: number;
}

interface ConsolidationResult {
  migratedSlots: number;
  migratedAppointments: number;
  details: ConsolidationDetail[];
  errors: any[];
}

export default function SlotConsolidator() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateSlotGroup[]>([]);
  const [result, setResult] = useState<ConsolidationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fungsi untuk memindai slot duplikat tanpa mengkonsolidasikan
  const scanDuplicates = async () => {
    try {
      setScanning(true);
      setDuplicateGroups([]);
      setResult(null);

      const response = await apiRequest('/api/therapy-slots/consolidate-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoConsolidate: false }),
      });

      if (response.duplicateGroups) {
        setDuplicateGroups(response.duplicateGroups);
        toast({
          title: 'Slot Duplikat Ditemukan',
          description: `Ditemukan ${response.duplicateGroups.length} kelompok slot terapi duplikat.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Tidak Ada Duplikat',
          description: 'Tidak ditemukan slot terapi duplikat.',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error scanning duplicates:', error);
      toast({
        title: 'Error',
        description: 'Gagal memindai slot duplikat. Silakan coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  // Fungsi untuk mengkonsolidasikan slot duplikat
  const consolidateDuplicates = async () => {
    try {
      setLoading(true);
      setResult(null);

      const response = await apiRequest('/api/therapy-slots/consolidate-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoConsolidate: true }),
      });

      if (response.result) {
        setResult(response.result);
        toast({
          title: 'Konsolidasi Berhasil',
          description: `Berhasil mengkonsolidasi ${response.result.migratedSlots} slot dengan ${response.result.migratedAppointments} janji temu.`,
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error consolidating duplicates:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengkonsolidasikan slot duplikat. Silakan coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Konsolidasi Slot Terapi Duplikat</CardTitle>
        <CardDescription>
          Alat ini membantu mengkonsolidasikan slot terapi yang duplikat (slot dengan waktu sama tapi ID berbeda)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {duplicateGroups.length > 0 && (
            <div className="rounded-md border p-4">
              <h3 className="text-lg font-medium mb-2">Ditemukan {duplicateGroups.length} kelompok duplikat:</h3>
              <div className="space-y-3">
                {duplicateGroups.map((group, idx) => (
                  <div key={idx} className="p-3 bg-muted rounded-md">
                    <p className="font-medium">{formatDate(group.date)} - {group.time_slot}</p>
                    <p>ID Slot: {group.slot_ids.join(', ')}</p>
                    <p>Jumlah Appointment: {group.current_counts.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <Alert variant={result.errors.length > 0 ? "destructive" : "default"}>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Hasil Konsolidasi</AlertTitle>
              <AlertDescription>
                <p>Slot terkonsolidasi: {result.migratedSlots}</p>
                <p>Appointment termigrasi: {result.migratedAppointments}</p>
                <p>Error: {result.errors.length}</p>
                
                {result.details.length > 0 && (
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDetails(!showDetails)}
                    className="mt-2"
                  >
                    {showDetails ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
                  </Button>
                )}
                
                {showDetails && result.details.length > 0 && (
                  <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                    {result.details.map((detail, idx) => (
                      <div key={idx} className="p-2 text-sm bg-muted rounded-md">
                        <p>Slot {detail.originalSlotId} → {detail.targetSlotId}</p>
                        <p>Waktu: {detail.timeSlot}</p>
                        <p>Appointment: {detail.movedAppointments}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {showDetails && result.errors.length > 0 && (
                  <div className="mt-2">
                    <h4 className="font-medium">Error:</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {result.errors.map((error, idx) => (
                        <div key={idx} className="p-2 text-sm bg-destructive/20 rounded-md">
                          <p>{error.message || JSON.stringify(error)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col space-y-2 items-start sm:flex-row sm:space-y-0 sm:space-x-2 sm:items-center">
        <Button 
          variant="outline" 
          onClick={scanDuplicates}
          disabled={scanning || loading}
        >
          {scanning ? 'Memindai...' : 'Pindai Duplikat'}
        </Button>
        
        <Button 
          onClick={consolidateDuplicates} 
          disabled={scanning || loading}
          className={duplicateGroups.length > 0 ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          {loading ? 'Memproses...' : 'Konsolidasi Semua Slot Duplikat'}
        </Button>
      </CardFooter>
    </Card>
  );
}