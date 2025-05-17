/**
 * Komponen untuk menunjukkan status loading progresif
 * Memberikan visual feedback yang lebih jelas tentang proses loading
 */

import React from 'react';
import { Loader2, CheckCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProgressiveLoadingIndicatorProps {
  stage: 'loading' | 'basic' | 'partial' | 'full';
  patientCount?: number;
  patientsLoaded?: number;
}

export function ProgressiveLoadingIndicator({ 
  stage, 
  patientCount = 0, 
  patientsLoaded = 0 
}: ProgressiveLoadingIndicatorProps) {
  // Hitung persentase selesai berdasarkan tahap loading
  let progressPercentage = 0;
  let loadingMessage = '';

  switch (stage) {
    case 'loading':
      progressPercentage = 10;
      loadingMessage = 'Memuat info dasar...';
      break;
    case 'basic':
      progressPercentage = 40;
      loadingMessage = 'Memuat data appointment...';
      break;
    case 'partial':
      progressPercentage = 70;
      loadingMessage = 'Memuat data pasien...';
      break;
    case 'full':
      progressPercentage = 100;
      loadingMessage = 'Selesai memuat data';
      break;
  }

  // Jika sudah full, tampilkan sukses
  if (stage === 'full') {
    return (
      <div className="flex items-center gap-2 text-green-600 text-xs">
        <CheckCircle className="h-3 w-3" />
        <span>Data lengkap dimuat</span>
      </div>
    );
  }

  // Jika ada info pasien, tunjukkan juga info tersebut
  let patientInfo = '';
  if (stage === 'partial' && patientCount > 0) {
    patientInfo = ` (${patientsLoaded}/${patientCount} pasien)`;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {stage === 'loading' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        <span>{loadingMessage}{patientInfo}</span>
      </div>
      <Progress value={progressPercentage} className="h-1" />
    </div>
  );
}