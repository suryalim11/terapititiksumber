import { useRef } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

type InvoiceProps = {
  isOpen: boolean;
  onClose: () => void;
  data: {
    transaction: any;
    patient: any;
    items: Array<{
      id: number;
      type: string;
      name: string;
      price: string;
      quantity: number;
    }>;
    paymentMethod: string;
  };
};

export default function Invoice({ isOpen, onClose, data }: InvoiceProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const formatPrice = (price: string) => {
    return `Rp${parseInt(price).toLocaleString('id-ID')}`;
  };

  const getPaymentMethodName = (method: string) => {
    switch (method) {
      case "bank_transfer":
        return "Transfer Bank";
      case "qris":
        return "QRIS";
      case "cash":
        return "Tunai";
      default:
        return method;
    }
  };

  const handlePrint = () => {
    if (invoiceRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Invoice - ${data.transaction.transactionId}</title>
              <style>
                body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; }
                .invoice { max-width: 800px; margin: 0 auto; }
                .invoice-header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .logo { font-size: 24px; font-weight: bold; color: #4F7CAC; }
                .invoice-title { text-align: right; }
                .invoice-info { margin-bottom: 20px; }
                .invoice-info-row { display: flex; margin-bottom: 5px; }
                .invoice-info-label { width: 150px; font-weight: bold; }
                .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .invoice-table th, .invoice-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                .invoice-table th { background-color: #f5f5f5; }
                .invoice-total { text-align: right; margin-top: 20px; }
                .invoice-total-label { font-weight: bold; margin-right: 20px; }
                .invoice-footer { margin-top: 40px; text-align: center; color: #666; }
              </style>
            </head>
            <body>
              <div class="invoice">
                ${invoiceRef.current.innerHTML}
                <div class="invoice-footer">
                  <p>Terima kasih telah memilih Terapinya Terapi Titik Sumber</p>
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleDownload = () => {
    // In a real application, this would use a PDF generation library
    // For this demo, we'll just show a toast
    toast({
      title: "Invoice diunduh",
      description: "Invoice telah berhasil diunduh sebagai PDF",
    });
  };

  const handleShareWhatsApp = () => {
    // In a real application, this would integrate with WhatsApp API
    // For this demo, we'll just show a toast
    toast({
      title: "Invoice dibagikan",
      description: "Invoice telah dikirim melalui WhatsApp",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold font-heading">Invoice</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh]">
          <div ref={invoiceRef} className="p-4 bg-white rounded">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-xl font-bold text-primary">Terapinya Terapi Titik Sumber</h1>
                <p className="text-gray-500 text-sm mt-1">Klinik Terapi Holistik</p>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-semibold">INVOICE</h2>
                <p className="text-gray-500 text-sm">{data.transaction.transactionId}</p>
                <p className="text-gray-500 text-sm">
                  {format(new Date(data.transaction.createdAt), "d MMMM yyyy", { locale: id })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Detail Pasien:</h3>
                <p className="text-gray-600">
                  <strong>Nama:</strong> {data.patient?.name}
                </p>
                <p className="text-gray-600">
                  <strong>ID Pasien:</strong> {data.patient?.patientId}
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Pembayaran:</h3>
                <p className="text-gray-600">
                  <strong>Metode:</strong> {getPaymentMethodName(data.paymentMethod)}
                </p>
                <p className="text-gray-600">
                  <strong>Status:</strong> <span className="text-green-600">Lunas</span>
                </p>
              </div>
            </div>

            <table className="w-full mb-6 border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2 text-left text-gray-700">Item</th>
                  <th className="px-4 py-2 text-right text-gray-700">Jumlah</th>
                  <th className="px-4 py-2 text-right text-gray-700">Harga</th>
                  <th className="px-4 py-2 text-right text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="px-4 py-2 text-gray-700">{item.name}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatPrice(item.price)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {formatPrice((parseFloat(item.price) * item.quantity).toString())}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}></td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-700">Total:</td>
                  <td className="px-4 py-2 text-right font-semibold text-primary">
                    {formatPrice(data.transaction.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-gray-600 text-sm">
                <strong>Catatan:</strong> Terima kasih atas kepercayaan Anda. Paket terapi yang telah dibeli
                dapat digunakan sesuai jadwal yang telah disepakati.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Cetak
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Unduh PDF
          </Button>
          <Button onClick={handleShareWhatsApp}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Kirim via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
