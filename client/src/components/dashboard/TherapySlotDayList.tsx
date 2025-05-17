/**
 * Komponen untuk menampilkan daftar slot terapi harian
 * Menggunakan SimpleSlotDialog untuk menampilkan detail
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SimpleSlotDialog } from './simple-slot-dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, Users } from 'lucide-react';

// Interface untuk data slot terapi
interface TherapySlot {
  id: number;
  date: string;
  timeSlot: string;
  maxQuota: number;
  currentCount: number;
  isActive: boolean;
}

interface TherapySlotDayListProps {
  date: string;
  slots: TherapySlot[];
  onRefresh?: () => void;
}

export function TherapySlotDayList({ date, slots, onRefresh }: TherapySlotDayListProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Fungsi untuk membuka dialog dengan slot tertentu
  const openSlotDialog = (slotId: number) => {
    setSelectedSlotId(slotId);
    setDialogOpen(true);
  };
  
  // Fungsi untuk menutup dialog
  const closeSlotDialog = () => {
    setDialogOpen(false);
    // Tunda reset selectedSlotId untuk mencegah flash UI
    setTimeout(() => setSelectedSlotId(null), 300);
  };
  
  // Kelompokkan slot berdasarkan tanggal
  const groupedSlots = slots.reduce<Record<string, TherapySlot[]>>((acc, slot) => {
    const day = slot.date.split(' ')[0]; // Ambil tanggal saja
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(slot);
    return acc;
  }, {});
  
  // Jika tidak ada slot
  if (Object.keys(groupedSlots).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Slot Terapi - {date}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Tidak ada slot terapi untuk hari ini
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      {Object.entries(groupedSlots).map(([day, daySlots]) => (
        <Card key={day} className="mb-4">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Slot Terapi - {date}</span>
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  Refresh
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {daySlots.map((slot) => (
                <div
                  key={slot.id}
                  className={`
                    border rounded-lg p-3 hover:bg-accent transition-colors cursor-pointer
                    ${!slot.isActive ? 'opacity-60' : ''}
                  `}
                  onClick={() => openSlotDialog(slot.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-primary" />
                      <span className="font-medium">{slot.timeSlot}</span>
                    </div>
                    <Badge variant={slot.isActive ? "default" : "secondary"}>
                      {slot.isActive ? 'Aktif' : 'Tidak Aktif'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Users className="h-4 w-4 mr-1" />
                      <span>
                        {slot.currentCount}/{slot.maxQuota} pasien
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Lihat Detail
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      
      {/* Dialog Slot Terapi */}
      <SimpleSlotDialog 
        slotId={selectedSlotId}
        isOpen={dialogOpen}
        onClose={closeSlotDialog}
      />
    </>
  );
}