/**
 * Komponen indikator loading progresif
 * Menampilkan status tahap loading dan persentase keseluruhan
 */

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';

interface ProgressiveLoadingIndicatorProps {
  stage: 'idle' | 'loading' | 'basic' | 'full' | 'error';
  patientCount?: number;
  patientsLoaded?: number;
}

export function ProgressiveLoadingIndicator({
  stage,
  patientCount = 0,
  patientsLoaded = 0
}: ProgressiveLoadingIndicatorProps) {
  // Hitung persentase kemajuan berdasarkan tahap
  let progress = 0;
  let statusText = '';
  
  switch (stage) {
    case 'idle':
      progress = 0;
      statusText = 'Siap memuat data';
      break;
    case 'loading':
      progress = 10;
      statusText = 'Memulai pengambilan data...';
      break;
    case 'basic':
      progress = 50;
      statusText = 'Memuat data pasien...';
      break;
    case 'full':
      progress = 100;
      statusText = 'Data lengkap dimuat';
      break;
    case 'error':
      progress = 100;
      statusText = 'Terjadi kesalahan';
      break;
  }
  
  // Kalkulasi persentase pasien yang dimuat (jika tersedia)
  if (stage === 'basic' && patientCount > 0) {
    statusText = `Memuat ${patientsLoaded} dari ${patientCount} pasien...`;
  }
  
  // Tampilkan indikator berbeda untuk error
  if (stage === 'error') {
    return (
      <div className="flex flex-col items-center space-y-2 py-2 text-destructive">
        <span>❗ {statusText}</span>
        <Progress value={100} className="w-full h-2 bg-red-100" />
      </div>
    );
  }
  
  // Loading selesai
  if (stage === 'full') {
    return (
      <div className="flex flex-col items-center space-y-2 py-2 text-emerald-600">
        <span>✓ {statusText}</span>
        <Progress value={100} className="w-full h-2 bg-emerald-100" />
      </div>
    );
  }
  
  // Loading normal
  return (
    <div className="flex flex-col items-center space-y-2 py-2">
      <div className="flex items-center space-x-2">
        {stage !== 'idle' && <Loader2 className="h-4 w-4 animate-spin" />}
        <span>{statusText}</span>
      </div>
      <Progress value={progress} className="w-full h-2" />
    </div>
  );
}