/**
 * Halaman dashboard untuk pengelolaan slot terapi
 * Menggunakan komponen teroptimasi dengan loading progresif
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { TherapySlotDayList } from '../components/dashboard/TherapySlotDayList';
import { queryClient } from '../lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function TherapySlotDashboard() {
  const today = new Date();
  const [activeTab, setActiveTab] = useState('today');
  
  // Query untuk mengambil slot terapi hari ini
  const { 
    data: todaySlots = [], 
    isLoading: isTodayLoading,
    isError: isTodayError,
    refetch: refetchToday
  } = useQuery({
    queryKey: ['todaySlots'],
    queryFn: async () => {
      const res = await queryClient.fetchQuery({
        queryKey: ['/api/therapy-slots'],
        queryFn: () => fetch('/api/therapy-slots').then(r => r.json())
      });
      return res || [];
    }
  });
  
  const todayFormatted = format(today, 'EEEE, dd MMMM yyyy', { locale: id });
  
  // Loading skeleton
  if (isTodayLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Slot Terapi</h1>
        </div>
        
        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">Hari Ini</TabsTrigger>
          </TabsList>
          
          <TabsContent value="today" className="mt-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }
  
  // Error state
  if (isTodayError) {
    return (
      <div className="container mx-auto py-6">
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">
              Terjadi kesalahan saat memuat data slot terapi.
            </p>
            <Button 
              variant="outline" 
              onClick={() => refetchToday()}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Coba Lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Slot Terapi</h1>
        <Button variant="outline" onClick={() => refetchToday()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Hari Ini
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="today" className="mt-4">
          <TherapySlotDayList 
            date={todayFormatted}
            slots={todaySlots}
            onRefresh={() => refetchToday()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}