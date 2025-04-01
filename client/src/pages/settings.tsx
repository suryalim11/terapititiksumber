import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/ui/theme-provider";
import { useForm } from "react-hook-form";
import { THEME_STORAGE_KEY } from "../main";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { InvoiceSettings } from "@/components/settings/invoice-settings";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Profile form schema
const profileFormSchema = z.object({
  name: z.string().min(3, "Nama harus minimal 3 karakter"),
  username: z.string().min(3, "Username harus minimal 3 karakter"),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  // If any password field is filled, all must be filled
  if (data.currentPassword || data.newPassword || data.confirmPassword) {
    return !!data.currentPassword && !!data.newPassword && !!data.confirmPassword;
  }
  return true;
}, {
  message: "Semua field password harus diisi jika ingin mengubah password",
  path: ["confirmPassword"],
}).refine((data) => {
  // New password and confirm password must match
  if (data.newPassword && data.confirmPassword) {
    return data.newPassword === data.confirmPassword;
  }
  return true;
}, {
  message: "Password baru dan konfirmasi password tidak cocok",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

// Store settings form schema
const storeSettingsSchema = z.object({
  clinicName: z.string().min(3, "Nama klinik harus minimal 3 karakter"),
  address: z.string().min(5, "Alamat harus minimal 5 karakter"),
  phone: z.string().min(5, "Nomor telepon harus minimal 5 karakter"),
  email: z.string().email("Email tidak valid"),
  operationalHours: z.string().min(3, "Jam operasional harus diisi"),
});

type StoreSettingsValues = z.infer<typeof storeSettingsSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  // Sincronizar com o tema atual quando o componente é montado
  useEffect(() => {
    // Carregar configurações do aplicativo ao iniciar
    try {
      const savedSettings = localStorage.getItem('app_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        // Atualizar as configurações do app para usar o tema atual do ThemeProvider
        // para manter a consistência entre os sistemas
        if (theme !== settings.theme) {
          localStorage.setItem('app_settings', JSON.stringify({
            ...settings,
            theme: theme
          }));
        }
      }
    } catch (error) {
      console.error("Erro ao sincronizar tema:", error);
    }
  }, [theme]);
  
  // Load application settings from localStorage
  const [isWhatsappEnabled, setIsWhatsappEnabled] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('app_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        return settings.isWhatsappEnabled || false;
      }
    } catch (error) {
      console.error("Error loading WhatsApp settings:", error);
    }
    return false;
  });
  
  const [isEmailNotificationsEnabled, setIsEmailNotificationsEnabled] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('app_settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        return settings.isEmailNotificationsEnabled || false;
      }
    } catch (error) {
      console.error("Error loading email notification settings:", error);
    }
    return false;
  });

  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || "",
      username: user?.username || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Store settings form - load default values from localStorage if available
  const storeSettingsForm = useForm<StoreSettingsValues>({
    resolver: zodResolver(storeSettingsSchema),
    defaultValues: {
      clinicName: "",
      address: "",
      phone: "",
      email: "",
      operationalHours: "",
    },
  });

  // Handle profile form submission
  const onSubmitProfile = async (values: ProfileFormValues) => {
    try {
      // Only include password fields if the current password is provided
      const payload = {
        name: values.name,
        username: values.username,
      };

      if (values.currentPassword) {
        // Jika password diisi, gunakan API untuk mengubah password
        try {
          const passwordResponse = await apiRequest('/api/change-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              currentPassword: values.currentPassword,
              newPassword: values.newPassword,
            }),
          });
          
          console.log('Password berhasil diperbarui:', passwordResponse);
          
          toast({
            title: "Kata sandi diperbarui",
            description: "Kata sandi baru berhasil disimpan",
          });
        } catch (passwordError: any) {
          console.error('Error saat mengubah password:', passwordError);
          
          toast({
            variant: "destructive",
            title: "Gagal memperbarui kata sandi",
            description: passwordError.message || "Kata sandi lama mungkin salah",
          });
          
          // Return early since password update failed
          return;
        }
      }

      // Perbarui profil lainnya jika diperlukan
      // Saat ini hanya nama yang disimpan di localStorage untuk prototipe
      if (user) {
        localStorage.setItem('user_profile', JSON.stringify({
          ...user,
          name: values.name,
        }));
      }

      toast({
        title: "Profil diperbarui",
        description: "Perubahan profil telah disimpan",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal memperbarui profil",
        description: error.message || "Terjadi kesalahan saat menyimpan profil",
      });
    }
  };

  // Handle store settings form submission
  const onSubmitStoreSettings = async (values: StoreSettingsValues) => {
    try {
      console.log("Menyimpan pengaturan klinik:", values);
      
      // Simpan pengaturan ke localStorage karena kita belum menggunakan database untuk pengaturan
      localStorage.setItem('clinic_settings', JSON.stringify(values));
      
      // Simpan juga di state global jika nanti akan dibuat
      // dispatch({ type: 'UPDATE_CLINIC_SETTINGS', payload: values });
      
      // Invalidate cache jika diperlukan
      // queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      
      toast({
        title: "Pengaturan disimpan",
        description: "Pengaturan klinik telah diperbarui",
      });
    } catch (error: any) {
      console.error("Error saat menyimpan pengaturan klinik:", error);
      toast({
        variant: "destructive",
        title: "Gagal menyimpan pengaturan",
        description: error.message || "Terjadi kesalahan saat menyimpan pengaturan",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-gray-900 dark:text-white">
          Pengaturan
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Kelola pengaturan aplikasi dan profil
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
          <TabsTrigger value="app">Aplikasi</TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-heading">Profil Pengguna</CardTitle>
              <CardDescription>
                Perbarui informasi profil dan kata sandi Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-6">
                  <FormField
                    control={profileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Masukkan nama lengkap" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Masukkan username" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                      Ubah Kata Sandi
                    </h3>

                    <div className="space-y-4">
                      <FormField
                        control={profileForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kata Sandi Saat Ini</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                placeholder="Masukkan kata sandi saat ini"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={profileForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Kata Sandi Baru</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                placeholder="Masukkan kata sandi baru"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={profileForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Konfirmasi Kata Sandi</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="password"
                                placeholder="Konfirmasi kata sandi baru"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button type="submit">Simpan Perubahan</Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>



        {/* Application Settings */}
        <TabsContent value="invoice">
          <InvoiceSettings />
        </TabsContent>

        <TabsContent value="app">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-heading">Pengaturan Aplikasi</CardTitle>
              <CardDescription>
                Kustomisasi pengaturan aplikasi sesuai kebutuhan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Settings */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Tema Aplikasi
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="theme-toggle">Mode Gelap</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Aktifkan tampilan gelap untuk kenyamanan
                    </p>
                  </div>
                  <Switch
                    id="theme-toggle"
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => {
                      // Simpan tema dalam variabel untuk uso nos toasts
                      const newTheme = checked ? "dark" : "light";
                      
                      // Aplicar a mudança no tema - setTheme já salva no localStorage usando a chave THEME_STORAGE_KEY 
                      setTheme(newTheme);
                      
                      // Também salvar nas configurações do app para manter compatibilidade
                      localStorage.setItem('app_settings', JSON.stringify({
                        theme: newTheme,
                        isWhatsappEnabled,
                        isEmailNotificationsEnabled
                      }));
                      
                      toast({
                        title: "Tema diperbarui",
                        description: checked ? "Mode gelap diaktifkan" : "Mode terang diaktifkan",
                      });
                    }}
                  />
                </div>
              </div>

              {/* Notification Settings */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Notifikasi
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="whatsapp-toggle">Notifikasi WhatsApp</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Kirim notifikasi melalui WhatsApp ke pasien
                      </p>
                    </div>
                    <Switch
                      id="whatsapp-toggle"
                      checked={isWhatsappEnabled}
                      onCheckedChange={setIsWhatsappEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="email-toggle">Notifikasi Email</Label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Kirim notifikasi melalui email ke pasien
                      </p>
                    </div>
                    <Switch
                      id="email-toggle"
                      checked={isEmailNotificationsEnabled}
                      onCheckedChange={setIsEmailNotificationsEnabled}
                    />
                  </div>
                </div>
              </div>

              {/* About Application */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tentang Aplikasi
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Terapinya Terapi Titik Sumber - Sistem Manajemen Klinik
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Versi 1.0.0
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  try {
                    // Simpan ke localStorage untuk sementara
                    localStorage.setItem('app_settings', JSON.stringify({
                      theme,
                      isWhatsappEnabled,
                      isEmailNotificationsEnabled
                    }));
                    
                    console.log("Menyimpan pengaturan aplikasi:", {
                      theme,
                      isWhatsappEnabled,
                      isEmailNotificationsEnabled
                    });
                    
                    toast({
                      title: "Pengaturan disimpan",
                      description: "Pengaturan aplikasi telah diperbarui",
                    });
                  } catch (error) {
                    console.error("Error saat menyimpan pengaturan aplikasi:", error);
                    toast({
                      variant: "destructive",
                      title: "Gagal menyimpan pengaturan",
                      description: "Terjadi kesalahan saat menyimpan pengaturan aplikasi",
                    });
                  }
                }}
              >
                Simpan Pengaturan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
