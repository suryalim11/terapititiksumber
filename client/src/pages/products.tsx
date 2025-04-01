import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatRupiah } from "@/lib/utils";
import { ProductForm } from "@/components/products/product-form";
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
import { 
  PlusIcon, 
  PencilIcon, 
  EyeIcon, 
  TrashIcon,
  AlertTriangleIcon
} from "lucide-react";

type Product = {
  id: number;
  name: string;
  price: string;
  stock: number;
  description?: string;
};

export default function Products() {
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: products = [], isLoading, error } = useQuery<Product[]>({
    queryKey: ["/api/products"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      
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

  // Filter products
  const filteredProducts = products.filter((product: Product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Produk
          </h1>
          <p className="text-muted-foreground">
            Kelola inventaris produk terapi
          </p>
        </div>
        <Button
          onClick={() => setIsProductFormOpen(true)}
          className="flex items-center gap-1"
        >
          <PlusIcon className="h-4 w-4" />
          Tambah Produk
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Daftar Produk</CardTitle>
            <CardDescription>
              Inventaris produk untuk terapi dan penjualan
            </CardDescription>
          </div>
          <div>
            <Input
              placeholder="Cari produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-[250px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
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
                            title="Lihat detail"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Button>
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
      
      {/* Delete Confirmation Dialog */}
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
    </div>
  );
}
