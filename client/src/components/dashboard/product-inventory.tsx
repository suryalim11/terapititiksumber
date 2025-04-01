import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useNavigate } from "wouter";

type Product = {
  id: number;
  name: string;
  price: string;
  stock: number;
  description?: string;
};

export default function ProductInventory() {
  const [, navigate] = useNavigate();
  
  const { data: products, isLoading, error } = useQuery({
    queryKey: ["/api/products"],
  });

  const getLimitedProducts = () => {
    if (!products) return [];
    return products.slice(0, 4);
  };

  const getStockStatus = (stock: number) => {
    if (stock <= 5) {
      return "text-red-500 dark:text-red-400";
    }
    if (stock <= 10) {
      return "text-yellow-500 dark:text-yellow-400";
    }
    return "text-gray-800 dark:text-gray-200";
  };

  const formatPrice = (price: string) => {
    return `Rp${parseInt(price).toLocaleString('id-ID')}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold font-heading text-gray-800 dark:text-white">Stok Produk</h3>
        <button 
          onClick={() => navigate("/products")}
          className="text-sm text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Tambah
        </button>
      </div>
      <div className="p-6">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 mr-3"></div>
                  <div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-4 text-red-500">
            Terjadi kesalahan saat memuat data produk.
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            Belum ada produk dalam inventaris.
          </div>
        ) : (
          <div className="space-y-4">
            {getLimitedProducts().map((product: Product, index: number) => (
              <div key={product.id} className={cn(
                "flex items-center justify-between",
                index < getLimitedProducts().length - 1 ? "border-b border-gray-200 dark:border-gray-700 pb-3" : ""
              )}>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 mr-3"></div>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{formatPrice(product.price)}</div>
                  </div>
                </div>
                <div className="text-sm">
                  <span className={cn("font-medium", getStockStatus(product.stock))}>
                    {product.stock}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400"> tersisa</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <button 
          onClick={() => navigate("/products")}
          className="mt-4 w-full py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition duration-150 flex items-center justify-center"
        >
          Lihat Semua Produk
        </button>
      </div>
    </div>
  );
}
