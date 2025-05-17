/**
 * Komponen yang menangani pengambilan, caching, dan loading progresif data slot terapi
 * Menggunakan API sederhana dan endpoint teroptimasi untuk performa maksimal
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { fetchSlotProgressively, ProgressiveSlotData } from './super-optimized-fetch-helper';
import { fetchWithTimeout } from '../../lib/fetch-with-timeout';

// Interface untuk context data slot
interface SlotDataContextType {
  // Data
  slotData: ProgressiveSlotData | null;
  appointments: any[];
  isLoading: boolean;
  error: Error | null;
  
  // Status
  dataStage: 'idle' | 'loading' | 'basic' | 'full' | 'error';
  
  // Aksi
  fetchSlotData: (slotId: number) => Promise<void>;
  refreshData: () => Promise<void>;
  clearData: () => void;
}

// Buat context untuk berbagi data slot
const SlotDataContext = createContext<SlotDataContextType | null>(null);

// Props untuk provider
interface SlotDataProviderProps {
  children: ReactNode;
  initialSlotId?: number;
}

/**
 * Provider untuk pengambilan dan pengelolaan data slot terapi
 */
export function SlotDataProvider({ children, initialSlotId }: SlotDataProviderProps) {
  // State untuk tracking data slot
  const [slotData, setSlotData] = useState<ProgressiveSlotData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentSlotId, setCurrentSlotId] = useState<number | null>(initialSlotId || null);
  const [dataStage, setDataStage] = useState<'idle' | 'loading' | 'basic' | 'full' | 'error'>('idle');
  
  // Mengambil daftar appointment dari data slot
  const appointments = slotData?.appointments || [];
  
  // Callback untuk memperbarui data secara bertahap
  const handleProgressUpdate = useCallback((progressData: ProgressiveSlotData) => {
    setSlotData(progressData);
    setDataStage(progressData.stage === 'full' ? 'full' : 'basic');
  }, []);
  
  // Fungsi untuk mengambil data slot
  const fetchSlotData = useCallback(async (slotId: number) => {
    if (!slotId) return;
    
    try {
      setIsLoading(true);
      setCurrentSlotId(slotId);
      setError(null);
      setDataStage('loading');
      
      // Gunakan helper yang menerapkan loading progresif
      await fetchSlotProgressively(
        slotId,
        fetchWithTimeout,
        handleProgressUpdate
      );
      
    } catch (error) {
      console.error("Error mengambil data slot:", error);
      setError(error instanceof Error ? error : new Error('Terjadi kesalahan saat mengambil data'));
      setDataStage('error');
    } finally {
      setIsLoading(false);
    }
  }, [handleProgressUpdate]);
  
  // Fungsi untuk memuat ulang data
  const refreshData = useCallback(async () => {
    if (currentSlotId) {
      await fetchSlotData(currentSlotId);
    }
  }, [currentSlotId, fetchSlotData]);
  
  // Fungsi untuk membersihkan data
  const clearData = useCallback(() => {
    setSlotData(null);
    setCurrentSlotId(null);
    setError(null);
    setDataStage('idle');
  }, []);
  
  // Ambil data awal jika ada initialSlotId
  useEffect(() => {
    if (initialSlotId && dataStage === 'idle') {
      fetchSlotData(initialSlotId);
    }
  }, [initialSlotId, dataStage, fetchSlotData]);
  
  // Nilai context untuk dibagikan ke komponen
  const contextValue: SlotDataContextType = {
    slotData,
    appointments,
    isLoading,
    error,
    dataStage,
    fetchSlotData,
    refreshData,
    clearData
  };
  
  return (
    <SlotDataContext.Provider value={contextValue}>
      {children}
    </SlotDataContext.Provider>
  );
}

/**
 * Hook untuk menggunakan context SlotData
 */
export function useSlotData() {
  const context = useContext(SlotDataContext);
  
  if (!context) {
    throw new Error('useSlotData harus digunakan di dalam SlotDataProvider');
  }
  
  return context;
}