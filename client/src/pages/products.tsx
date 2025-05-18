import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatRupiah } from "@/lib/utils";
import { ProductForm } from "@/components/products/product-form";
import { PackageForm } from "@/components/products/package-form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  PlusIcon, 
  PencilIcon, 
  EyeIcon, 
  TrashIcon,
  AlertTriangleIcon,
  Package2Icon,
  ShoppingBagIcon 
} from "lucide-react";

type Product = {
  id: number;
  name: string;
  price: string;
  stock: number;
  description?: string;
};

type Package = {
  id: number;
  name: string;
  sessions: number;
  price: string;
  description?: string;
};

export default function Products() {
  // States for products
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // States for packages
  const [isPackageFormOpen, setIsPackageFormOpen] = useState(false);
  const [searchPackageTerm, setSearchPackageTerm] = useState("");
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [deletePackageConfirmOpen, setDeletePackageConfirmOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<Package | null>(null);
  const [isDeletingPackage, setIsDeletingPackage] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query products using fixed API endpoint
  const { 
    data: products = [], 
    isLoading: isLoadingProducts, 
    error: productsError 
  } = useQuery<Product[]>({
    queryKey: ["/api/fixed/products"],
    staleTime: 10 * 1000, // 10 seconds
  });
  
  // Query packages using fixed API endpoint
  const { 
    data: packages = [], 
    isLoading: isLoadingPackages, 
    error: packagesError 
  } = useQuery<Package[]>({
    queryKey: ["/api/fixed/packages"],
    staleTime: 10 * 1000, // 10 seconds
  });

  // Reset form when dialog is closed
  const handleCloseForm = () => {
    setIsProductFormOpen(false);
    setEditingProduct(null);
  };

  // Open edit form
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsProductFormOpen(true);
  };

  // Handle form success
  const handleFormSuccess = () => {
    handleCloseForm();
  };
  
  // Open delete confirmation dialog
  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };
  
  // Delete product
  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    
    try {
      setIsDeleting(true);
      await apiRequest(`/api/products/${productToDelete.id}`, {
        method: "DELETE",
      });
      
      // Invalidate products cache to refetch the data
      queryClient.invalidateQueries({ queryKey: ["/api/fixed/products"] });
      
      toast({
        title: "Produk dihapus",
        description: `${productToDelete.name} telah dihapus dari inventaris`,
      });
      
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "Gagal menghapus produk",
        description: "Terjadi kesalahan, silakan coba lagi",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Package form handlers
  const handleClosePackageForm = () => {
    setIsPackageFormOpen(false);
    setEditingPackage(null);
  };

  const handleEditPackage = (pkg: Package) => {
    setEditingPackage(pkg);
    setIsPackageFormOpen(true);
  };

  const handlePackageFormSuccess = () => {
    handleClosePackageForm();
  };

  const handleDeletePackageClick = (pkg: Package) => {
    setPackageToDelete(pkg);
    setDeletePackageConfirmOpen(true);
  };

  const handleDeletePackageConfirm = async () => {
    if (!packageToDelete) return;
    
    try {
      setIsDeletingPackage(true);
      
      try {
        // Gunakan fetch() langsung untuk mendapatkan lebih banyak kontrol terhadap response
        const response = await fetch(`/api/packages/${packageToDelete.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });
        
        // Ambil hasil JSON response
        const result = await response.json();
        
        // Periksa status response
        if (response.ok) {
          // Invalidate packages cache untuk memperbarui data
          queryClient.invalidateQueries({ queryKey: ["/api/fixed/packages"] });
          
          toast({
            title: "Paket terapi dihapus",
            description: `${packageToDelete.name} telah dihapus`,
          });
          
          setDeletePackageConfirmOpen(false);
          setPackageToDelete(null);
        } else {
          // Jika response tidak ok, gunakan pesan error dari server
          throw new Error(result.message || "Gagal menghapus paket terapi");
        }
      } catch (fetchError: any) {
        // Tangkap error dari fetch atau parsing JSON
        console.error("Fetch error:", fetchError);
        throw fetchError;
      }
    } catch (error: any) {
      console.error("Error deleting package:", error);
      
      // Tampilkan pesan error yang spesifik jika tersedia
      let errorMessage = "Terjadi kesalahan, silakan coba lagi";
      
      if (error.message?.includes("masih digunakan oleh sesi terapi aktif")) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Gagal menghapus paket terapi",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeletingPackage(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter((product: Product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Filter packages
  const filteredPackages = packages.filter((pkg: Package) =>
    pkg.name.toLowerCase().includes(searchPackageTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Produk & Paket
          </h1>
          <p className="text-muted-foreground">
            Kelola inventaris produk dan paket terapi
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Manajemen Produk & Paket</CardTitle>
            <CardDescription>
              Inventaris produk dan paket terapi untuk penjualan
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="products" className="flex items-center gap-2">
                <ShoppingBagIcon className="h-4 w-4" />
                Produk Terapi
              </TabsTrigger>
              <TabsTrigger value="packages" className="flex items-center gap-2">
                <Package2Icon className="h-4 w-4" />
                Paket Terapi
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="products">
              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-lg font-medium">Daftar Produk</h3>
                <Button
                  onClick={() => setIsProductFormOpen(true)}
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  Tambah Produk
                </Button>
              </div>
              
              <div className="w-full mb-4">
                <Input
                  placeholder="Cari produk..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-full"
                />
              </div>
              
              {isLoadingProducts ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : productsError ? (
                <div className="text-center py-8 text-destructive">
                  Terjadi kesalahan saat memuat data produk.
                </div>
              ) : !filteredProducts || filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Tidak ada produk yang sesuai dengan pencarian." : "Belum ada produk dalam inventaris."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Produk</TableHead>
                        <TableHead>Harga</TableHead>
                        <TableHead>Stok</TableHead>
                        <TableHead>Deskripsi</TableHead>
                        <TableHead className="w-[100px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product: Product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{formatRupiah(product.price)}</TableCell>
                          <TableCell>
                            <span className={
                              product.stock <= 5 
                                ? "text-red-500 font-medium" 
                                : product.stock <= 10
                                  ? "text-yellow-500 font-medium"
                                  : ""
                            }>
                              {product.stock}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {product.description || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0"
                                onClick={() => handleEditProduct(product)}
                                title="Edit produk"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteClick(product)}
                                title="Hapus produk"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="packages">
              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-lg font-medium">Daftar Paket Terapi</h3>
                <Button
                  onClick={() => setIsPackageFormOpen(true)}
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  Tambah Paket
                </Button>
              </div>
              
              <div className="w-full mb-4">
                <Input
                  placeholder="Cari paket terapi..."
                  value={searchPackageTerm}
                  onChange={(e) => setSearchPackageTerm(e.target.value)}
                  className="max-w-full"
                />
              </div>
              
              {isLoadingPackages ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : packagesError ? (
                <div className="text-center py-8 text-destructive">
                  Terjadi kesalahan saat memuat data paket terapi.
                </div>
              ) : !filteredPackages || filteredPackages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchPackageTerm ? "Tidak ada paket yang sesuai dengan pencarian." : "Belum ada paket terapi yang tersedia."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Paket</TableHead>
                        <TableHead>Jumlah Sesi</TableHead>
                        <TableHead>Harga</TableHead>
                        <TableHead>Deskripsi</TableHead>
                        <TableHead className="w-[100px]">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPackages.map((pkg: Package) => (
                        <TableRow key={pkg.id}>
                          <TableCell className="font-medium">{pkg.name}</TableCell>
                          <TableCell>{pkg.sessions} sesi</TableCell>
                          <TableCell>{formatRupiah(pkg.price)}</TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {pkg.description || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0"
                                onClick={() => handleEditPackage(pkg)}
                                title="Edit paket"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeletePackageClick(pkg)}
                                title="Hapus paket"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Product Form Dialog */}
      <Dialog open={isProductFormOpen} onOpenChange={setIsProductFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Produk" : "Tambah Produk Baru"}
            </DialogTitle>
          </DialogHeader>

          <ProductForm 
            onSuccess={handleFormSuccess}
            defaultValues={editingProduct || undefined}
            isEditing={!!editingProduct}
            productId={editingProduct?.id}
          />
        </DialogContent>
      </Dialog>
      
      {/* Package Form Dialog */}
      <Dialog open={isPackageFormOpen} onOpenChange={setIsPackageFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPackage ? "Edit Paket Terapi" : "Tambah Paket Terapi Baru"}
            </DialogTitle>
            <DialogDescription>
              Kelola informasi paket terapi untuk manajemen sesi pasien
            </DialogDescription>
          </DialogHeader>

          <PackageForm 
            onSuccess={handlePackageFormSuccess}
            initialValues={editingPackage ? {
              name: editingPackage.name,
              price: editingPackage.price,
              sessions: editingPackage.sessions,
              description: editingPackage.description || ""
            } : undefined}
            mode={editingPackage ? "edit" : "create"}
            id={editingPackage?.id}
            onCancel={handleClosePackageForm}
          />
        </DialogContent>
      </Dialog>
      
      {/* Delete Product Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="h-5 w-5 text-red-500" />
              Konfirmasi Hapus Produk
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus produk <strong>{productToDelete?.name}</strong>? 
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:space-x-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setDeleteConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button 
              type="button" 
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Menghapus..." : "Hapus Produk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Package Confirmation Dialog */}
      <Dialog open={deletePackageConfirmOpen} onOpenChange={setDeletePackageConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="h-5 w-5 text-red-500" />
              Konfirmasi Hapus Paket Terapi
            </DialogTitle>
            <DialogDescription>
              <p className="mb-2">Apakah Anda yakin ingin menghapus paket terapi <strong>{packageToDelete?.name}</strong>?</p>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <span className="text-yellow-700 font-medium">Perhatian:</span> 
                <ul className="list-disc ml-5 mt-1 text-sm space-y-1 text-yellow-700">
                  <li>Paket yang sedang aktif digunakan oleh pasien <strong>tidak dapat dihapus</strong>.</li>
                  <li>Pastikan paket ini sudah tidak lagi dibutuhkan sebelum menghapusnya.</li>
                  <li>Tindakan ini tidak dapat dibatalkan.</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:space-x-0 mt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setDeletePackageConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button 
              type="button" 
              variant="destructive"
              onClick={handleDeletePackageConfirm}
              disabled={isDeletingPackage}
            >
              {isDeletingPackage ? "Menghapus..." : "Hapus Paket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
