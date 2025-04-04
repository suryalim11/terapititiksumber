import React, { useState } from 'react';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";

const DateTest = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [results, setResults] = useState<string[]>([]);

  // Fungsi untuk menambahkan hasil ke log
  const addResult = (message: string) => {
    setResults(prev => [message, ...prev].slice(0, 20)); // Keep only the last 20 results
  };

  // Test 1: Mengirim tanggal sebagai ISO string
  const testISOString = async () => {
    if (!selectedDate) return;
    
    try {
      const isoString = selectedDate.toISOString();
      addResult(`Mengirim tanggal sebagai ISO string: ${isoString}`);
      
      const res = await fetch('/api/test/date-handler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: isoString, type: 'iso' })
      });
      
      const data = await res.json();
      addResult(`Respons untuk ISO string: ${JSON.stringify(data)}`);
      
      toast({
        title: "Test ISO String Selesai",
        description: "Lihat hasil di log",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addResult(`Error saat mengirim ISO string: ${errorMessage}`);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Test 2: Mengirim tanggal sebagai format string YYYY-MM-DD
  const testFormattedString = async () => {
    if (!selectedDate) return;
    
    try {
      const formattedString = format(selectedDate, 'yyyy-MM-dd');
      addResult(`Mengirim tanggal sebagai format string: ${formattedString}`);
      
      const res = await fetch('/api/test/date-handler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: formattedString, type: 'formatted' })
      });
      
      const data = await res.json();
      addResult(`Respons untuk format string: ${JSON.stringify(data)}`);
      
      toast({
        title: "Test Format String Selesai",
        description: "Lihat hasil di log",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addResult(`Error saat mengirim format string: ${errorMessage}`);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Test 3: Mengirim tanggal sebagai Date object (akan dikonversi ke ISO string oleh JSON.stringify)
  const testDateObject = async () => {
    if (!selectedDate) return;
    
    try {
      addResult(`Mengirim Date object (akan dikonversi JSON ke ISO): ${selectedDate.toString()}`);
      
      const res = await fetch('/api/test/date-handler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, type: 'object' })
      });
      
      const data = await res.json();
      addResult(`Respons untuk Date object: ${JSON.stringify(data)}`);
      
      toast({
        title: "Test Date Object Selesai",
        description: "Lihat hasil di log",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addResult(`Error saat mengirim Date object: ${errorMessage}`);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Test 4: Buat slot terapi dengan tanggal yang dipilih
  const testCreateTherapySlot = async () => {
    if (!selectedDate) return;
    
    try {
      const formattedString = format(selectedDate, 'yyyy-MM-dd');
      addResult(`Membuat slot terapi untuk tanggal: ${formattedString}`);
      
      const slotData = {
        date: formattedString,
        timeSlot: "11:00-12:00",
        maxQuota: 5,
        isActive: true
      };
      
      const res = await fetch('/api/therapy-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slotData)
      });
      
      if (!res.ok) {
        throw new Error(`Failed to create therapy slot: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      addResult(`Slot terapi dibuat: ID=${data.id}, Tanggal=${data.date}`);
      
      toast({
        title: "Slot Terapi Dibuat",
        description: `Berhasil membuat slot terapi untuk tanggal ${formattedString}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addResult(`Error saat membuat slot terapi: ${errorMessage}`);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Date Handling Test Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pilih Tanggal untuk Pengujian</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
            />
            
            <div className="mt-4 space-y-2">
              <p>Tanggal yang dipilih: {selectedDate ? format(selectedDate, 'dd MMMM yyyy') : 'None'}</p>
              <p>ISO String: {selectedDate?.toISOString()}</p>
              <p>Format yyyy-MM-dd: {selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'None'}</p>
            </div>
            
            <div className="mt-6 space-x-2">
              <Button onClick={testISOString}>Test ISO String</Button>
              <Button onClick={testFormattedString}>Test Format String</Button>
              <Button onClick={testDateObject}>Test Date Object</Button>
              <Button onClick={testCreateTherapySlot} variant="default">Buat Slot Terapi</Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Hasil Pengujian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 overflow-y-auto border rounded p-2">
              {results.length === 0 ? (
                <p className="text-muted-foreground">Belum ada hasil pengujian</p>
              ) : (
                results.map((result, idx) => (
                  <React.Fragment key={idx}>
                    <p className="whitespace-pre-wrap">{result}</p>
                    {idx < results.length - 1 && <Separator className="my-2" />}
                  </React.Fragment>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DateTest;