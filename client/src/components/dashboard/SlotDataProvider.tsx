/**
 * Provider untuk loading progresif data slot terapi
 * Menangani pengambilan dan pengelolaan data secara bertahap
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchWithTimeout, fetchWithCache } from '../../lib/fetch-with-timeout';

// Definisi tipe data appointment dan pasien
interface Appointment {
  id: number;
  patientId: number;
  status: string;
  date: string;
  timeSlot: string;
  patientName?: string;
  patientPhone?: string;
  notes?: string;
}

// Data slot terapi dengan loading progresif
export interface ProgressiveSlotData {
  // Informasi dasar
  id: number;
  date: string;
  timeSlot: string;
  maxQuota: number;
  currentCount: number;
  isActive: boolean;
  
  // Status loading
  stage: 'basic' | 'loading' | 'partial' | 'full';
  
  // Data tambahan opsional
  timeSlotKey?: string;
  globalQuota?: number;
  patientCount?: number;
}

// Tipe Context Provider
interface SlotDataContextType {
  slotData: ProgressiveSlotData | null;
  appointments: Appointment[];
  isLoading: boolean;
  error: Error | null;
  dataStage: 'loading' | 'basic' | 'partial' | 'full';
  refreshData: () => void;
}

// Nilai default untuk Context
const defaultContextValue: SlotDataContextType = {
  slotData: null,
  appointments: [],
  isLoading: false,
  error: null,
  dataStage: 'loading',
  refreshData: () => {}
};

// Buat context
const SlotDataContext = createContext<SlotDataContextType>(defaultContextValue);

// Hook custom untuk menggunakan context
export const useSlotData = () => useContext(SlotDataContext);

// Props untuk Provider
interface SlotDataProviderProps {
  children: React.ReactNode;
  initialSlotId: number;
}

// Provider component
export function SlotDataProvider({ children, initialSlotId }: SlotDataProviderProps) {
  // State untuk menyimpan data
  const [slotData, setSlotData] = useState<ProgressiveSlotData | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [dataStage, setDataStage] = useState<'loading' | 'basic' | 'partial' | 'full'>('loading');
  const [slotId, setSlotId] = useState<number>(initialSlotId);
  
  // Fungsi untuk mem-fetch data basic slot terapi
  const fetchBasicSlotData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setDataStage('loading');
    
    try {
      console.log(`🚀 Request untuk basic slot ${slotId} info`);
      
      // Gunakan fetchWithCache untuk caching
      const cacheKey = `therapy_slot_basic_${slotId}_${Date.now()}`;
      const response = await fetchWithCache(
        `/api/simple-slot/${slotId}/basic`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          timeout: 10000, // 10 detik timeout
          retries: 2,
          onRetry: (attempt, error) => {
            console.log(`⚠️ Mencoba lagi (${attempt}) untuk basic slot: ${error.message}`);
          }
        },
        cacheKey,
        60000 // Cache selama 1 menit
      );
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const basicData = await response.json();
      
      // Update state dengan data dasar
      setSlotData({
        ...basicData,
        stage: 'basic'
      });
      
      setDataStage('basic');
      console.log('📊 Data dasar slot terapi dimuat:', basicData);
      
      return basicData;
      
    } catch (err: any) {
      console.error('Error fetching basic slot data:', err);
      setError(new Error(err.message || 'Gagal mengambil data dasar slot terapi'));
      return null;
    } finally {
      // Keep isLoading true because we're fetching more data
    }
  }, [slotId]);
  
  // Fungsi untuk mem-fetch data appointment
  const fetchAppointments = useCallback(async () => {
    if (!slotData) return;
    
    try {
      console.log(`📅 Request untuk appointment slot ${slotId}`);
      
      // Gunakan fetchWithTimeout karena data ini bisa berubah
      const response = await fetchWithTimeout(
        `/api/simple-slot/${slotId}/appointments`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          timeout: 15000, // 15 detik timeout untuk data yang lebih besar
          retries: 2
        }
      );
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const appointmentsData = await response.json();
      setAppointments(appointmentsData);
      
      // Update stage
      setDataStage('partial');
      setSlotData(prev => prev ? {...prev, stage: 'partial'} : null);
      
      console.log(`📊 ${appointmentsData.length} appointments dimuat`);
      
      return appointmentsData;
      
    } catch (err: any) {
      console.error('Error fetching appointment data:', err);
      // Don't set error state here, the basic data is already loaded
      // Just log the error and continue
      return [];
    }
  }, [slotId, slotData]);
  
  // Fungsi untuk mem-fetch data pasien lengkap
  const fetchPatientData = useCallback(async () => {
    if (!slotData) return;
    
    try {
      console.log(`👥 Request untuk patients slot ${slotId}`);
      
      // Fetch patient data - this might be slower and heavier
      const response = await fetchWithTimeout(
        `/api/simple-slot/${slotId}/patients`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          timeout: 20000, // 20 detik timeout untuk data pasien (bisa lebih lambat)
          retries: 1
        }
      );
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const patientsData = await response.json();
      
      // Enrich appointments with patient data
      const enrichedAppointments = appointments.map(appointment => {
        const patient = patientsData.find(p => p.id === appointment.patientId);
        return {
          ...appointment,
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
          patientPhone: patient?.phoneNumber || '-'
        };
      });
      
      setAppointments(enrichedAppointments);
      setDataStage('full');
      setSlotData(prev => prev ? {...prev, stage: 'full'} : null);
      
      console.log(`📊 ${patientsData.length} patient data dimuat dan diintegrasikan`);
      
      return patientsData;
      
    } catch (err: any) {
      console.error('Error fetching patient data:', err);
      // Don't set error state here, we at least have basic and appointment data
      // Just log the error and continue
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [slotId, slotData, appointments]);
  
  // Fungsi untuk memuat semua data secara bertahap
  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Muat data secara bertahap
      const basicData = await fetchBasicSlotData();
      
      if (basicData) {
        // Lanjutkan dengan data appointment setelah data dasar dimuat
        await fetchAppointments();
        
        // Akhirnya muat data pasien secara lengkap
        await fetchPatientData();
      }
    } catch (err: any) {
      console.error('Error in progressive loading:', err);
      setError(new Error(err.message || 'Gagal memuat data secara bertahap'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchBasicSlotData, fetchAppointments, fetchPatientData]);
  
  // Fungsi untuk me-refresh data
  const refreshData = useCallback(() => {
    loadAllData();
  }, [loadAllData]);
  
  // Effect untuk memulai loading data
  useEffect(() => {
    if (slotId) {
      loadAllData();
    }
    
    // Cleanup pada unmount
    return () => {
      // Bersihkan state jika perlu
    };
  }, [slotId, loadAllData]);
  
  // Nilai provider yang diberikan ke consumer
  const value: SlotDataContextType = {
    slotData,
    appointments,
    isLoading,
    error,
    dataStage,
    refreshData
  };
  
  return (
    <SlotDataContext.Provider value={value}>
      {children}
    </SlotDataContext.Provider>
  );
}