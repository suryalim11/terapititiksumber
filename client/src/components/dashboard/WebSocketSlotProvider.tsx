import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';

// Definisi untuk tipe data yang dikirim melalui WebSocket
interface Patient {
  id: number;
  name: string;
  phone: string;
  appointmentStatus: string;
  appointmentId: number;
}

interface Appointment {
  id: number;
  patientId: number;
  status: string;
  date: string;
  timeSlot: string;
}

interface SlotBasicData {
  id: number;
  date: string;
  timeSlot: string;
  maxQuota: number;
  currentCount: number;
  isActive: boolean;
}

interface WSMessage {
  type: 'basic_data' | 'appointments' | 'patients' | 'update' | 'error';
  data?: any;
  message?: string;
}

// Context state yang dikelola
interface WebSocketSlotContextType {
  slotData: SlotBasicData | null;
  appointments: Appointment[];
  patients: Patient[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  dataStage: 'idle' | 'loading' | 'basic' | 'partial' | 'full';
  connectToSlot: (slotId: number) => void;
  disconnectFromSlot: () => void;
}

// Nilai default untuk context
const defaultContext: WebSocketSlotContextType = {
  slotData: null,
  appointments: [],
  patients: [],
  isConnected: false,
  isLoading: false,
  error: null,
  dataStage: 'idle',
  connectToSlot: () => {},
  disconnectFromSlot: () => {}
};

// Buat context untuk WebSocket slot
const WebSocketSlotContext = createContext<WebSocketSlotContextType>(defaultContext);

// Custom hook untuk menggunakan WebSocket slot context
export const useWebSocketSlot = () => useContext(WebSocketSlotContext);

interface WebSocketSlotProviderProps {
  children: ReactNode;
}

export const WebSocketSlotProvider: React.FC<WebSocketSlotProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [slotData, setSlotData] = useState<SlotBasicData | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSlotId, setCurrentSlotId] = useState<number | null>(null);
  const [dataStage, setDataStage] = useState<'idle' | 'loading' | 'basic' | 'partial' | 'full'>('idle');

  // Reset state saat ganti slot
  const resetState = useCallback(() => {
    setSlotData(null);
    setAppointments([]);
    setPatients([]);
    setError(null);
    setDataStage('idle');
  }, []);

  // Hubungkan ke WebSocket server dan subscribe ke slot tertentu
  const connectToSlot = useCallback((slotId: number) => {
    if (currentSlotId === slotId && isConnected) {
      console.log(`Already connected to slot ${slotId}`);
      return;
    }
    
    resetState();
    
    try {
      // Tutup koneksi sebelumnya jika ada
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      
      setIsLoading(true);
      setDataStage('loading');
      setCurrentSlotId(slotId);
      
      // Buat koneksi WebSocket baru
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log(`🔌 Connecting to WebSocket at ${wsUrl}`);
      
      const newSocket = new WebSocket(wsUrl);
      
      // Setup event listeners
      newSocket.onopen = () => {
        console.log('📡 WebSocket connection established');
        setIsConnected(true);
        
        // Subscribe ke slot yang diminta
        const subscribeMessage = {
          type: 'subscribe',
          slotId: slotId
        };
        
        newSocket.send(JSON.stringify(subscribeMessage));
        console.log(`📢 Subscribed to slot ${slotId}`);
      };
      
      newSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          
          switch (message.type) {
            case 'basic_data':
              console.log('📋 Received basic slot data', message.data);
              setSlotData(message.data);
              setDataStage('basic');
              break;
              
            case 'appointments':
              console.log('📆 Received appointments data', message.data);
              setAppointments(message.data);
              setDataStage('partial');
              break;
              
            case 'patients':
              console.log('👥 Received patients data', message.data);
              setPatients(message.data);
              setIsLoading(false);
              setDataStage('full');
              break;
              
            case 'update':
              console.log('🔄 Received update', message.data);
              // Penanganan update sesuai jenis data yang diperbarui
              if (message.data.type === 'appointment_status') {
                setAppointments(prev => 
                  prev.map(app => 
                    app.id === message.data.appointmentId 
                    ? { ...app, status: message.data.status } 
                    : app
                  )
                );
                
                setPatients(prev => 
                  prev.map(patient => 
                    patient.appointmentId === message.data.appointmentId 
                    ? { ...patient, appointmentStatus: message.data.status } 
                    : patient
                  )
                );
              } else if (message.data.type === 'slot_update') {
                setSlotData(prev => prev ? { ...prev, ...message.data.slot } : null);
              }
              break;
              
            case 'error':
              console.error('⚠️ WebSocket error:', message.message);
              setError(message.message || 'Unknown error from server');
              break;
              
            default:
              console.warn('🤔 Received unknown message type:', message);
          }
        } catch (err) {
          console.error('❌ Error parsing WebSocket message:', err);
          setError('Failed to parse server response');
        }
      };
      
      newSocket.onerror = (err) => {
        console.error('❌ WebSocket error:', err);
        setError('WebSocket connection error');
        setIsConnected(false);
        setIsLoading(false);
      };
      
      newSocket.onclose = (event) => {
        console.log(`📴 WebSocket connection closed: ${event.code} ${event.reason}`);
        setIsConnected(false);
        setIsLoading(false);
        
        if (event.code !== 1000) {
          // 1000 adalah kode normal untuk close
          setError(`Connection closed: ${event.reason || 'Unknown reason'}`);
          toast({
            title: "Koneksi terputus",
            description: "Koneksi ke server terputus. Mencoba menghubungkan kembali...",
            variant: "destructive"
          });
          
          // Coba reconnect setelah beberapa detik
          setTimeout(() => {
            if (currentSlotId) {
              connectToSlot(currentSlotId);
            }
          }, 5000);
        }
      };
      
      setSocket(newSocket);
      
    } catch (err) {
      console.error('❌ Error establishing WebSocket connection:', err);
      setError('Failed to establish WebSocket connection');
      setIsLoading(false);
      setIsConnected(false);
    }
  }, [currentSlotId, isConnected, resetState, socket]);
  
  // Putuskan koneksi WebSocket
  const disconnectFromSlot = useCallback(() => {
    if (socket) {
      console.log('🔌 Closing WebSocket connection');
      socket.close(1000, 'Disconnected by user');
      setSocket(null);
      setCurrentSlotId(null);
      resetState();
    }
  }, [resetState, socket]);
  
  // Cleanup saat komponen unmount
  useEffect(() => {
    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log('🧹 Cleaning up WebSocket connection');
        socket.close(1000, 'Provider unmounted');
      }
    };
  }, [socket]);

  const value = {
    slotData,
    appointments,
    patients,
    isConnected,
    isLoading,
    error,
    dataStage,
    connectToSlot,
    disconnectFromSlot
  };

  return (
    <WebSocketSlotContext.Provider value={value}>
      {children}
    </WebSocketSlotContext.Provider>
  );
};