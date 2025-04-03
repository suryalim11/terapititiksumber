import { useRef, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { InvoiceSettings, defaultInvoiceSettings } from "@/components/settings/invoice-settings";

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
  const [settings, setSettings] = useState<InvoiceSettings>(defaultInvoiceSettings);
  
  // Load saved invoice settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("invoice_settings");
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error("Error loading invoice settings:", error);
    }
  }, []);

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
    if (invoiceRef.current) {
      try {
        // Debug informasi yang diperlukan
        console.log("PDF Generation - Payment Method:", data.paymentMethod);
        console.log("PDF Generation - Bank Settings:", {
          bankName: settings.bankName,
          bankAccountNumber: settings.bankAccountNumber,
          bankAccountName: settings.bankAccountName
        });
        
        // Buat instance jsPDF
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });
        
        // Judul invoice
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(settings.companyName, 14, 20);
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(settings.companyTagline || "Klinik Terapi Holistik", 14, 26);
        
        // Detail invoice
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("INVOICE", 180, 20, { align: 'right' });
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const invoiceId = settings.invoicePrefix 
          ? `${settings.invoicePrefix}${data.transaction.transactionId}` 
          : data.transaction.transactionId;
        doc.text(invoiceId, 180, 26, { align: 'right' });
        
        const formattedDate = format(new Date(data.transaction.createdAt), "d MMMM yyyy", { locale: id });
        doc.text(formattedDate, 180, 32, { align: 'right' });
        
        // Garis pemisah
        doc.setLineWidth(0.3);
        doc.line(14, 35, 196, 35);
        
        // Informasi pasien dan pembayaran
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Detail Pasien:", 14, 45);
        doc.text("Pembayaran:", 120, 45);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Nama: ${data.patient?.name || '-'}`, 14, 52);
        doc.text(`ID Pasien: ${data.patient?.patientId || '-'}`, 14, 58);
        
        doc.text(`Metode: ${getPaymentMethodName(data.paymentMethod)}`, 120, 52);
        doc.text("Status: Lunas", 120, 58);
        
        // Header tabel item
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const tableTop = 70;
        doc.text("Item", 14, tableTop);
        doc.text("Jumlah", 100, tableTop, { align: 'right' });
        doc.text("Harga", 140, tableTop, { align: 'right' });
        doc.text("Total", 195, tableTop, { align: 'right' });
        
        // Garis header tabel
        doc.setLineWidth(0.3);
        doc.line(14, tableTop + 2, 196, tableTop + 2);
        
        // Isi tabel
        doc.setFont("helvetica", "normal");
        let y = tableTop + 10;
        
        data.items.forEach((item, index) => {
          doc.text(item.name, 14, y);
          doc.text(item.quantity.toString(), 100, y, { align: 'right' });
          doc.text(formatPrice(item.price), 140, y, { align: 'right' });
          doc.text(formatPrice((parseFloat(item.price) * item.quantity).toString()), 195, y, { align: 'right' });
          y += 8;
        });
        
        // Garis sebelum total
        doc.setLineWidth(0.3);
        doc.line(14, y + 2, 196, y + 2);
        
        // Total
        doc.setFont("helvetica", "bold");
        doc.text("Total:", 140, y + 10, { align: 'right' });
        doc.text(formatPrice(data.transaction.totalAmount), 195, y + 10, { align: 'right' });
        
        // Mulai posisi untuk catatan dan info bank
        let nextY = y + 25;
        
        // Tentukan apakah perlu menampilkan info bank
        const showBankInfo = (data.paymentMethod === 'bank_transfer' || data.paymentMethod === 'qris') && 
                             (settings.bankName || settings.bankAccountNumber || settings.bankAccountName);
        
        // Informasi Rekening Bank (jika perlu)
        if (showBankInfo) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text("Informasi Pembayaran:", 14, nextY);
          nextY += 6;
          
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          
          if (settings.bankName) {
            doc.text(`Bank: ${settings.bankName}`, 14, nextY);
            nextY += 5;
          }
          
          if (settings.bankAccountNumber) {
            doc.text(`No. Rekening: ${settings.bankAccountNumber}`, 14, nextY);
            nextY += 5;
          }
          
          if (settings.bankAccountName) {
            doc.text(`Atas Nama: ${settings.bankAccountName}`, 14, nextY);
            nextY += 8;
          }
          
          // Tambah spasi setelah info bank
          nextY += 5;
        }
        
        // Catatan
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Catatan: ${settings.invoiceFooterNote || defaultInvoiceSettings.invoiceFooterNote}`, 14, nextY);
        
        // Footer
        doc.setFontSize(9);
        doc.text(settings.invoiceThankYouMessage || `Terima kasih telah memilih ${settings.companyName}`, 105, 280, { align: 'center' });
        
        // Simpan PDF
        doc.save(`Invoice-${data.transaction.transactionId}.pdf`);
        
        toast({
          title: "Invoice berhasil diunduh",
          description: "Invoice telah berhasil diunduh sebagai file PDF.",
        });
      } catch (error) {
        console.error("Error downloading invoice as PDF:", error);
        toast({
          title: "Gagal mengunduh invoice",
          description: "Terjadi kesalahan saat membuat PDF. Silakan coba lagi.",
          variant: "destructive",
        });
      }
    }
  };

  const handleShareWhatsApp = () => {
    try {
      if (!data.patient || !data.transaction) {
        toast({
          title: "Gagal membagikan invoice",
          description: "Data pasien atau transaksi tidak lengkap",
          variant: "destructive"
        });
        return;
      }
      
      // Format pesan WhatsApp dengan menggunakan pengaturan yang disimpan
      const invoiceId = settings.invoicePrefix 
        ? `${settings.invoicePrefix}${data.transaction.transactionId}` 
        : data.transaction.transactionId;
        
      // Tambahkan info rekening bank jika tersedia
      let bankInfo = '';
      if ((data.paymentMethod === 'bank_transfer' || data.paymentMethod === 'qris') &&
          (settings.bankName || settings.bankAccountNumber || settings.bankAccountName)) {
        bankInfo = `
*Informasi Pembayaran:*`;
        if (settings.bankName) bankInfo += `
Bank: ${settings.bankName}`;
        if (settings.bankAccountNumber) bankInfo += `
No. Rekening: ${settings.bankAccountNumber}`;
        if (settings.bankAccountName) bankInfo += `
Atas Nama: ${settings.bankAccountName}`;
        bankInfo += '\n';
      }

      const message = `*INVOICE ${invoiceId}*
Yth. ${data.patient.name},

Terima kasih telah mengunjungi ${settings.companyName}.
Total Pembayaran: ${formatPrice(data.transaction.totalAmount)}${bankInfo}
Detail transaksi telah dikirim melalui invoice ini.
${settings.invoiceThankYouMessage || "Semoga sehat selalu!"}

Salam,
Tim ${settings.companyName}`;

      // Encode pesan untuk URL WhatsApp
      const encodedMessage = encodeURIComponent(message);
      
      // Dapatkan nomor telepon pasien dan hapus karakter non-numerik
      let phoneNumber = data.patient.phoneNumber.replace(/\D/g, '');
      
      // Pastikan format nomor telepon benar (tambahkan 62 jika dimulai dengan 0)
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '62' + phoneNumber.substring(1);
      }
      
      // Buka WhatsApp Web dengan pesan yang sudah disiapkan
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
      window.open(whatsappUrl, '_blank');
      
      toast({
        title: "WhatsApp terbuka",
        description: "Invoice telah disiapkan untuk dikirim melalui WhatsApp",
      });
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      toast({
        title: "Gagal membagikan invoice",
        description: "Terjadi kesalahan saat mengirim pesan WhatsApp",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold font-heading">Invoice</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh]">
          <div ref={invoiceRef} className="p-4 bg-white rounded">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-xl font-bold text-primary">{settings.companyName}</h1>
                <p className="text-gray-500 text-sm mt-1">{settings.companyTagline}</p>
                {settings.companyAddress && (
                  <p className="text-gray-500 text-xs mt-1">{settings.companyAddress}</p>
                )}
                {(settings.companyPhone || settings.companyEmail) && (
                  <p className="text-gray-500 text-xs mt-1">
                    {settings.companyPhone && `Tel: ${settings.companyPhone}`}
                    {settings.companyPhone && settings.companyEmail && " | "}
                    {settings.companyEmail && `Email: ${settings.companyEmail}`}
                  </p>
                )}
                {settings.companyWebsite && (
                  <p className="text-gray-500 text-xs mt-1">{settings.companyWebsite}</p>
                )}
              </div>
              <div className="text-right">
                <h2 className="text-lg font-semibold">INVOICE</h2>
                <p className="text-gray-500 text-sm">
                  {settings.invoicePrefix ? `${settings.invoicePrefix}${data.transaction.transactionId}` : data.transaction.transactionId}
                </p>
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
              {(data.paymentMethod === 'bank_transfer' || data.paymentMethod === 'qris') && 
                (settings.bankName || settings.bankAccountNumber || settings.bankAccountName) && (
                <div className="mb-3 p-3 border border-gray-200 rounded-md bg-gray-50">
                  <h3 className="font-semibold text-gray-700 mb-1">Informasi Pembayaran:</h3>
                  {settings.bankName && (
                    <p className="text-gray-600 text-sm">
                      <strong>Bank:</strong> {settings.bankName}
                    </p>
                  )}
                  {settings.bankAccountNumber && (
                    <p className="text-gray-600 text-sm">
                      <strong>No. Rekening:</strong> {settings.bankAccountNumber}
                    </p>
                  )}
                  {settings.bankAccountName && (
                    <p className="text-gray-600 text-sm">
                      <strong>Atas Nama:</strong> {settings.bankAccountName}
                    </p>
                  )}
                </div>
              )}
              
              <p className="text-gray-600 text-sm">
                <strong>Catatan:</strong> {settings.invoiceFooterNote || defaultInvoiceSettings.invoiceFooterNote}
              </p>
              {settings.invoiceThankYouMessage && (
                <p className="text-gray-600 text-sm mt-2 text-center">
                  {settings.invoiceThankYouMessage}
                </p>
              )}
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
          <Button variant="outline" onClick={handleDownload} data-action="download-pdf">
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
