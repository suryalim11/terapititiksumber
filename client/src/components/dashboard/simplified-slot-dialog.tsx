import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { CalendarIcon, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { id } from 'date-fns/locale';

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Util function for date formatting
function formatDate(dateString: string) {
  try {
    const datePart = dateString.split(' ')[0];
    const date = new Date(datePart);
    return format(date, 'EEEE, d MMMM yyyy', { locale: id });
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString;
  }
}

/**
 * Dialog untuk menampilkan detail slot terapi dan daftar pasien yang terdaftar
 * Versi paling sederhana untuk mendiagnosis masalah
 */
export function SimplifiedSlotDialog({ 
  slotId, 
  isOpen, 
  onClose 
}: { 
  slotId: number | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Local state for slot data
  const [slotData, setSlotData] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Load data
  useEffect(() => {
    async function loadData() {
      if (!slotId || !isOpen) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch slot data
        const slotResponse = await fetch(`/api/therapy-slots/${slotId}`);
        if (!slotResponse.ok) throw new Error('Failed to load slot data');
        const slot = await slotResponse.json();
        setSlotData(slot);
        
        // Extract date
        const slotDate = slot.date.split(' ')[0];
        
        // Fetch appointments for this date
        const appResponse = await fetch(`/api/appointments/date/${slotDate}`);
        if (!appResponse.ok) throw new Error('Failed to load appointments');
        
        const allAppointments = await appResponse.json();
        
        // Filter appointments for this slot
        const filteredAppointments = allAppointments.filter(
          (app: any) => app.therapySlotId === slotId
        );
        
        setAppointments(filteredAppointments);
      } catch (err) {
        console.error("Failed to load data:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [slotId, isOpen]);
  
  // Handle navigate to patient
  function navigateToPatient(patientId: number) {
    if (!patientId) return;
    onClose();
    navigate(`/patients/${patientId}`);
  }
  
  // Early return
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader className="px-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Detail Slot Terapi (Simplified)
          </DialogTitle>
          <DialogDescription>
            Menampilkan detail slot terapi dan daftar pasien
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-6 text-destructive">
            <p>Error: {error.message}</p>
          </div>
        ) : !slotData ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>Data slot tidak tersedia</p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Slot Information */}
            <div className="rounded-lg bg-muted/50 p-3 border">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">Tanggal:</div>
                <div className="font-medium">{formatDate(slotData.date)}</div>
                
                <div className="text-muted-foreground">Waktu:</div>
                <div className="font-medium">{slotData.timeSlot || '-'}</div>
                
                <div className="text-muted-foreground">Kuota:</div>
                <div className="font-medium">
                  {typeof slotData.currentCount === 'number' ? slotData.currentCount : 0}/
                  {typeof slotData.maxQuota === 'number' ? slotData.maxQuota : 0}
                </div>
                
                <div className="text-muted-foreground">Status:</div>
                <div>
                  {slotData.isActive ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Aktif</Badge>
                  ) : (
                    <Badge variant="destructive">Tidak Aktif</Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Simple Patients List */}
            <div>
              <h3 className="text-sm font-medium mb-2">Daftar Pasien</h3>
              
              {appointments.length === 0 ? (
                <p className="text-center py-4 text-sm text-muted-foreground border rounded">
                  Belum ada pasien terdaftar
                </p>
              ) : (
                <div className="border rounded-md divide-y">
                  {appointments.map((app: any) => (
                    <div key={app.id} className="p-3 text-sm hover:bg-muted/50">
                      <div className="font-medium">{app.patient?.name || 'Pasien'}</div>
                      <div className="text-muted-foreground text-xs mt-1">{app.patient?.phoneNumber || '-'}</div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 px-2 text-xs"
                        onClick={() => navigateToPatient(app.patient?.id || app.patientId)}
                      >
                        <User className="h-3 w-3 mr-1" />
                        Detail Pasien
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}