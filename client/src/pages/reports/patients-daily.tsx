import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../../components/ui/table';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Cell,
  LabelList
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { DashboardHeader } from '../../components/header';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// Mendapatkan tahun saat ini
const currentYear = new Date().getFullYear();
// Mendapatkan bulan saat ini (1-12)
const currentMonth = new Date().getMonth() + 1;

// Membuat array tahun untuk dropdown (tahun saat ini dan 2 tahun sebelumnya)
const years = [currentYear, currentYear - 1, currentYear - 2];

// Array nama bulan untuk dropdown
const months = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

// Fungsi helper untuk mendapatkan nama bulan
const getMonthName = (monthNumber: number) => {
  return months.find(m => m.value === monthNumber)?.label || '';
};

// Fungsi untuk menentukan warna berdasarkan hari
const getDayColor = (dayName: string) => {
  switch (dayName) {
    case 'Minggu':
      return '#ff8a65'; // Merah muda
    case 'Sabtu':
      return '#4fc3f7'; // Biru muda
    default:
      return '#81c784'; // Hijau
  }
};

export default function PatientsDailyReport() {
  // State untuk bulan dan tahun yang dipilih
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Fetch data laporan pasien harian
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/reports/patients-per-day', selectedMonth, selectedYear],
    queryFn: async () => {
      const response = await fetch(`/api/reports/patients-per-day?month=${selectedMonth}&year=${selectedYear}&apiKey=terapi-titik-sumber-public`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch patients daily report');
      }
      
      return await response.json();
    }
  });

  // Handler untuk perubahan bulan
  const handleMonthChange = (value: string) => {
    setSelectedMonth(parseInt(value));
  };

  // Handler untuk perubahan tahun
  const handleYearChange = (value: string) => {
    setSelectedYear(parseInt(value));
  };

  // Menyiapkan data untuk grafik
  const chartData = data?.dailyData?.map((item: any) => ({
    ...item,
    day: parseInt(item.date.split('-')[2]), // Mendapatkan tanggal dari format yyyy-MM-dd
  })) || [];

  // Format data untuk tabel dengan pengelompokan mingguan
  const getWeeklyData = () => {
    if (!data?.dailyData) return [];
    
    const result = [];
    const dailyData = [...data.dailyData];
    
    // Mengelompokkan per 7 hari (minggu)
    for (let i = 0; i < dailyData.length; i += 7) {
      const weekData = dailyData.slice(i, i + 7);
      const totalPatients = weekData.reduce((sum, day) => sum + day.patientCount, 0);
      
      result.push({
        weekNumber: Math.ceil((i + 1) / 7),
        startDate: weekData[0]?.date,
        endDate: weekData[weekData.length - 1]?.date,
        totalPatients,
        dailyData: weekData
      });
    }
    
    return result;
  };

  const weeklyData = getWeeklyData();

  return (
    <div className="container mx-auto px-4 py-6">
      <DashboardHeader
        heading="Laporan Pasien Harian"
        text="Analisis jumlah pasien per hari dalam bulan yang dipilih"
      />

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="w-full md:w-1/2 lg:w-1/4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Bulan</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedMonth.toString()} onValueChange={handleMonthChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih bulan" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
        
        <div className="w-full md:w-1/2 lg:w-1/4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">Tahun</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tahun" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
        
        {data && (
          <>
            <div className="w-full md:w-1/2 lg:w-1/4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Total Pasien</CardTitle>
                  <CardDescription>
                    {getMonthName(selectedMonth)} {selectedYear}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.totalPatients}</div>
                </CardContent>
              </Card>
            </div>
            
            <div className="w-full md:w-1/2 lg:w-1/4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Rata-rata Per Hari</CardTitle>
                  <CardDescription>
                    {getMonthName(selectedMonth)} {selectedYear}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.averagePatientsPerDay}</div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              Terjadi kesalahan saat mengambil data laporan. Silakan coba lagi.
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Grafik Pasien per Hari</CardTitle>
              <CardDescription>
                {getMonthName(selectedMonth)} {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      label={{ 
                        value: 'Tanggal', 
                        position: 'insideBottom', 
                        offset: -10 
                      }} 
                    />
                    <YAxis 
                      label={{ 
                        value: 'Jumlah Pasien', 
                        angle: -90, 
                        position: 'insideLeft' 
                      }} 
                    />
                    <Tooltip 
                      formatter={(value) => [`${value} pasien`, 'Jumlah']}
                      labelFormatter={(day) => `Tanggal ${day}`}
                    />
                    <Legend />
                    <Bar 
                      dataKey="patientCount" 
                      name="Jumlah Pasien"
                      radius={[4, 4, 0, 0]}
                    >
                      {chartData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={getDayColor(entry.dayName)} />
                      ))}
                      <LabelList dataKey="patientCount" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Laporan Mingguan</CardTitle>
              <CardDescription>
                {getMonthName(selectedMonth)} {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Minggu</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead className="text-right">Total Pasien</TableHead>
                    <TableHead className="text-right">Rata-rata/Hari</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyData.map((week) => (
                    <TableRow key={week.weekNumber}>
                      <TableCell className="font-medium">
                        Minggu {week.weekNumber}
                      </TableCell>
                      <TableCell>
                        {week.startDate.split('-')[2]} - {week.endDate.split('-')[2]} {getMonthName(selectedMonth)}
                      </TableCell>
                      <TableCell className="text-right">{week.totalPatients}</TableCell>
                      <TableCell className="text-right">
                        {(week.totalPatients / week.dailyData.length).toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detail Harian</CardTitle>
              <CardDescription>
                {getMonthName(selectedMonth)} {selectedYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Hari</TableHead>
                    <TableHead className="text-right">Jumlah Pasien</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.dailyData.map((day: any) => (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium">
                        {day.date.split('-')[2]} {getMonthName(selectedMonth)}
                      </TableCell>
                      <TableCell>{day.dayName}</TableCell>
                      <TableCell className="text-right">{day.patientCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}