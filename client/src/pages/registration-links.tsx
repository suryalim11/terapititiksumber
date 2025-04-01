import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AuthContext } from "@/lib/auth";
import { useContext } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Link, MoreVertical, PlusCircle, Trash2 } from "lucide-react";

// Registration Link Types
interface RegistrationLink {
  id: number;
  code: string;
  expiryTime: string;
  dailyLimit: number;
  currentRegistrations: number;
  createdAt: string;
  isActive: boolean;
  createdBy: number;
}

interface CreateLinkRequest {
  expiryHours: number;
  dailyLimit: number;
}

export default function RegistrationLinksPage() {
  const auth = useContext(AuthContext);
  const isAuthenticated = auth.isAuthenticated;
  const user = auth.user;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [expiryHours, setExpiryHours] = useState(24);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [linkToDeactivate, setLinkToDeactivate] = useState<number | null>(null);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);

  // Query to fetch registration links
  const { data: links, isLoading, error } = useQuery({
    queryKey: ['/api/registration-links'],
    enabled: isAuthenticated && user?.role === 'admin'
  });

  // Mutation to create a new registration link
  const createLinkMutation = useMutation({
    mutationFn: async (data: CreateLinkRequest) => {
      return apiRequest('/api/registration-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/registration-links'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Link Pendaftaran Berhasil Dibuat",
        description: "Link pendaftaran baru telah dibuat dan siap digunakan.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Gagal Membuat Link",
        description: error.message || "Terjadi kesalahan saat membuat link pendaftaran.",
      });
    }
  });

  // Mutation to deactivate a registration link
  const deactivateLinkMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/registration-links/deactivate/${id}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/registration-links'] });
      setIsDeactivateDialogOpen(false);
      toast({
        title: "Link Pendaftaran Dinonaktifkan",
        description: "Link pendaftaran berhasil dinonaktifkan.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Gagal Menonaktifkan Link",
        description: error.message || "Terjadi kesalahan saat menonaktifkan link pendaftaran.",
      });
    }
  });

  const handleCreateLink = () => {
    if (expiryHours < 1 || expiryHours > 720) {
      toast({
        variant: "destructive",
        title: "Input Tidak Valid",
        description: "Durasi berlaku harus antara 1 jam sampai 30 hari (720 jam)",
      });
      return;
    }

    if (dailyLimit < 1 || dailyLimit > 100) {
      toast({
        variant: "destructive",
        title: "Input Tidak Valid",
        description: "Batas pendaftaran harian harus antara 1 hingga 100",
      });
      return;
    }

    createLinkMutation.mutate({ expiryHours, dailyLimit });
  };

  const copyLinkToClipboard = (code: string) => {
    const registrationLink = `${window.location.origin}/register?kode=${code}`;
    navigator.clipboard.writeText(registrationLink);
    toast({
      title: "Link Disalin",
      description: "Link pendaftaran berhasil disalin ke clipboard.",
    });
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy, HH:mm");
    } catch (error) {
      return dateString;
    }
  };

  // Check if user is authenticated and has admin role
  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[420px]">
          <CardHeader>
            <CardTitle>Akses Tidak Diizinkan</CardTitle>
            <CardDescription>
              Anda harus login sebagai admin untuk mengakses halaman ini.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => window.location.href = "/"} className="w-full">
              Kembali ke Beranda
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Link Pendaftaran Pasien</h1>
          <p className="text-gray-500">Kelola link yang dapat dibagikan untuk pendaftaran pasien</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Buat Link Baru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Link Pendaftaran Baru</DialogTitle>
              <DialogDescription>
                Buat link pendaftaran dengan batas waktu dan jumlah pendaftaran tertentu.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="expiryHours" className="col-span-4">
                  Berlaku selama (jam)
                </Label>
                <Input
                  id="expiryHours"
                  type="number"
                  min="1"
                  max="720"
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(parseInt(e.target.value))}
                  className="col-span-4"
                />
                <p className="text-sm text-muted-foreground col-span-4">
                  Link akan kedaluwarsa setelah {expiryHours} jam (maks. 30 hari / 720 jam)
                </p>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dailyLimit" className="col-span-4">
                  Batas pendaftaran harian
                </Label>
                <Input
                  id="dailyLimit"
                  type="number"
                  min="1"
                  max="100"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                  className="col-span-4"
                />
                <p className="text-sm text-muted-foreground col-span-4">
                  Maksimal {dailyLimit} pendaftaran per hari menggunakan link ini
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Batal
              </Button>
              <Button 
                onClick={handleCreateLink}
                disabled={createLinkMutation.isPending}
              >
                {createLinkMutation.isPending ? "Membuat..." : "Buat Link"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Link Pendaftaran</CardTitle>
          <CardDescription>
            Link ini dapat dibagikan kepada calon pasien untuk mendaftar secara mandiri
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-4 text-red-500">
              Terjadi kesalahan saat memuat data. Silakan coba lagi.
            </div>
          ) : links && links.length > 0 ? (
            <Table>
              <TableCaption>Daftar link pendaftaran pasien</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal Dibuat</TableHead>
                  <TableHead>Berlaku Hingga</TableHead>
                  <TableHead>Batas Harian</TableHead>
                  <TableHead>Pendaftaran</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link: RegistrationLink) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.code}</TableCell>
                    <TableCell>
                      {link.isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-100 text-gray-500 hover:bg-gray-100">
                          Nonaktif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(link.createdAt)}</TableCell>
                    <TableCell>{formatDate(link.expiryTime)}</TableCell>
                    <TableCell>{link.dailyLimit}</TableCell>
                    <TableCell>{link.currentRegistrations}/{link.dailyLimit}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Buka menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => copyLinkToClipboard(link.code)}
                            disabled={!link.isActive}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Salin Link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setLinkToDeactivate(link.id);
                              setIsDeactivateDialogOpen(true);
                            }}
                            disabled={!link.isActive}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Nonaktifkan
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Link className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium">Belum Ada Link Pendaftaran</h3>
              <p className="text-gray-500 mt-2 mb-6">
                Anda belum membuat link pendaftaran. Klik tombol "Buat Link Baru" untuk membuat.
              </p>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="mx-auto"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Buat Link Baru
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deactivate Link Dialog */}
      <AlertDialog 
        open={isDeactivateDialogOpen} 
        onOpenChange={setIsDeactivateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan Link Pendaftaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Link yang sudah dinonaktifkan tidak dapat digunakan lagi untuk pendaftaran pasien baru.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeactivateDialogOpen(false)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (linkToDeactivate) {
                  deactivateLinkMutation.mutate(linkToDeactivate);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deactivateLinkMutation.isPending ? "Menonaktifkan..." : "Nonaktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}