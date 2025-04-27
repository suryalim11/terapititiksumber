import React from 'react';
import { Link } from 'wouter';
import { DashboardHeader } from '../../components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { BarChart2, Calendar, FileText, Users } from 'lucide-react';

export default function ReportsIndex() {
  const reports = [
    {
      id: 'patients-daily',
      title: 'Laporan Pasien Harian',
      description: 'Analisis jumlah pasien yang datang setiap hari dalam sebulan',
      icon: <Calendar className="w-8 h-8 text-primary" />,
      route: '/reports/patients-daily'
    },
    {
      id: 'financial-monthly',
      title: 'Laporan Keuangan Bulanan',
      description: 'Ringkasan pendapatan dan transaksi per bulan',
      icon: <BarChart2 className="w-8 h-8 text-primary" />,
      route: '/reports/financial-monthly'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-6">
      <DashboardHeader
        heading="Laporan"
        text="Akses berbagai laporan untuk analisis bisnis Anda"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {reports.map((report) => (
          <Card key={report.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                {report.icon}
                <span>{report.title}</span>
              </CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={report.route}>
                <Button className="w-full">Lihat Laporan</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}