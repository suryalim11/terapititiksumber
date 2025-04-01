import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/utils";

interface Setting {
  id: number;
  key: string;
  value: string;
  description: string;
  updatedAt: Date;
  updatedBy: number;
}

const Settings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [therapySinglePrice, setTherapySinglePrice] = useState("");
  const [therapyPackagePrice, setTherapyPackagePrice] = useState("");
  
  // Fetch all settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings"],
  });
  
  // Update settings mutation
  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await apiRequest("POST", "/api/settings", { key, value });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Pengaturan berhasil diperbarui",
        description: "Perubahan telah disimpan",
      });
    },
    onError: (error) => {
      toast({
        title: "Gagal memperbarui pengaturan",
        description: `Error: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Initialize form with current settings when data is loaded
  useEffect(() => {
    if (settings && Array.isArray(settings)) {
      const singlePrice = settings.find(s => s.key === "therapy.single.price");
      const packagePrice = settings.find(s => s.key === "therapy.package.price");
      
      if (singlePrice) {
        setTherapySinglePrice(singlePrice.value);
      }
      
      if (packagePrice) {
        setTherapyPackagePrice(packagePrice.value);
      }
    }
  }, [settings]);
  
  // Handle form submission for therapy pricing
  const handleSaveTherapyPricing = () => {
    // Validate inputs
    if (!therapySinglePrice || !therapyPackagePrice) {
      toast({
        title: "Validasi gagal",
        description: "Semua harga harus diisi",
        variant: "destructive",
      });
      return;
    }
    
    // Update settings
    updateSetting.mutate({ key: "therapy.single.price", value: therapySinglePrice });
    updateSetting.mutate({ key: "therapy.package.price", value: therapyPackagePrice });
  };
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Pengaturan Aplikasi</h1>
      
      <div className="grid gap-6">
        {/* Therapy Pricing Card */}
        <Card>
          <CardHeader>
            <CardTitle>Harga Terapi</CardTitle>
            <CardDescription>
              Atur harga untuk berbagai jenis paket terapi
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-10 w-32" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="singlePrice">Harga Sesi Tunggal</Label>
                  <div className="flex space-x-2 items-center">
                    <Input
                      id="singlePrice"
                      type="number"
                      value={therapySinglePrice}
                      onChange={(e) => setTherapySinglePrice(e.target.value)}
                      placeholder="Masukkan harga sesi tunggal"
                    />
                    <span className="text-sm text-muted-foreground">
                      {formatRupiah(Number(therapySinglePrice))}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="packagePrice">Harga Paket 12 Sesi</Label>
                  <div className="flex space-x-2 items-center">
                    <Input
                      id="packagePrice"
                      type="number"
                      value={therapyPackagePrice}
                      onChange={(e) => setTherapyPackagePrice(e.target.value)}
                      placeholder="Masukkan harga paket 12 sesi"
                    />
                    <span className="text-sm text-muted-foreground">
                      {formatRupiah(Number(therapyPackagePrice))}
                    </span>
                  </div>
                </div>
                
                <Button 
                  onClick={handleSaveTherapyPricing}
                  disabled={updateSetting.isPending}
                >
                  {updateSetting.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;