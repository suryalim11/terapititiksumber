import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, InfoIcon, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";

export default function AppointmentFixPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  useEffect(() => {
    // Redirect to dashboard after a short delay with info toast
    toast({
      title: "Halaman Perbaikan Appointment",
      description: "Sistem perbaikan appointment telah diperbarui. Anda akan dialihkan ke Dashboard.",
      variant: "default",
      duration: 4000,
    });
    
    // Redirect to dashboard after a delay
    const redirectTimer = setTimeout(() => {
      navigate("/dashboard");
    }, 2000);
    
    return () => clearTimeout(redirectTimer);
  }, [toast, navigate]);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Perbaikan Appointment</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Halaman Telah Diperbarui</CardTitle>
          <CardDescription>
            Sistem perbaikan appointment telah diintegrasikan ke halaman detail pasien untuk memudahkan penggunaan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Perhatian</AlertTitle>
            <AlertDescription>
              Untuk memperbaiki appointment yang hilang, silakan gunakan tombol "Fix Appointment" yang tersedia pada halaman detail pasien.
            </AlertDescription>
          </Alert>
          
          <div className="pt-4 text-center">
            <Button onClick={() => navigate("/dashboard")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Kembali ke Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}