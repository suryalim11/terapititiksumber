import { useRef, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { InvoiceSettings, defaultInvoiceSettings, INVOICE_SETTINGS_KEY } from "@/components/settings/invoice-settings";

// Fungsi helper untuk pengelolaan angka yang aman
const safeParseFloat = (value: any): number => {
  if (value === undefined || value === null) return 0;
  const num = parseFloat(String(value));
  return isNaN(num) ? 0 : num;
};

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
    discount?: number;
    subtotal?: number;
    isPaid?: boolean;
    creditAmount?: number | string; 
    paidAmount?: number | string;
    displayName?: "original" | "alias"; // Tambahan untuk menampilkan nama Syafliana jika dipilih
  };
};

export default function Invoice({ isOpen, onClose, data }: InvoiceProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [settings, setSettings] = useState<InvoiceSettings>(defaultInvoiceSettings);
  
  // Load saved invoice settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(INVOICE_SETTINGS_KEY);
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        console.log("Loaded invoice settings:", parsedSettings);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error("Error loading invoice settings:", error);
    }
  }, []);
  
  // Handle case when data is null or undefined
  if (!data) {
    return null; // Tidak render apa-apa jika data tidak ada
  }

  const formatPrice = (price: string) => {
    return `Rp${parseFloat(price).toLocaleString('id-ID')}`;
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
        console.log("PDF Generation - Transaction Data:", {
          subtotal: data.subtotal,
          discount: data.discount,
          totalAmount: data.transaction.totalAmount,
          items: data.items
        });
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
        
        // Pastikan createdAt ada, jika tidak gunakan date atau fallback ke tanggal sekarang
        const dateToFormat = data.transaction.createdAt || data.transaction.date || new Date();
        const formattedDate = format(new Date(dateToFormat), "d MMMM yyyy", { locale: id });
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
        
        // Cek apakah ini pasien Queenzky dan pilihan displayName adalah alias (Syafliana)
        let patientName = data.patient?.name || '-';
        if (data.patient?.name?.includes('Queenzky') && data.displayName === 'alias') {
          patientName = 'Syafliana'; // Gunakan nama alternatif Syafliana
          console.log("Menggunakan nama alternatif 'Syafliana' pada invoice");
        }
        
        doc.text(`Nama: ${patientName}`, 14, 52);
        doc.text(`ID Pasien: ${data.patient?.patientId || '-'}`, 14, 58);
        
        doc.text(`Metode: ${getPaymentMethodName(data.paymentMethod)}`, 120, 52);
        
        // Tampilkan status pembayaran sesuai apakah transaksi kredit atau lunas
        const isPaid = data.transaction.isPaid === undefined ? true : data.transaction.isPaid;
        const statusText = isPaid ? "Status: Lunas" : "Status: Kredit (Belum Lunas)";
        
        if (!isPaid) {
          doc.setTextColor(220, 53, 69); // Warna merah untuk kredit
          doc.text(statusText, 120, 58);
          doc.setTextColor(0, 0, 0); // Reset warna teks
        } else {
          doc.setTextColor(25, 135, 84); // Warna hijau untuk lunas
          doc.text(statusText, 120, 58);
          doc.setTextColor(0, 0, 0); // Reset warna teks
        }
        
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
        
        // Debug item data untuk memahami struktur yang benar
        console.log("Item data dari transaksi:", JSON.stringify(data.items));
        
        // Pastikan items adalah array dan setiap item memiliki properti yang diperlukan
        if (Array.isArray(data.items) && data.items.length > 0) {
          data.items.forEach((item, index) => {
            console.log(`Item #${index} diproses:`, JSON.stringify(item));
            
            try {
              // Dapatkan nama produk/paket
              // Gunakan String() untuk memastikan nilai tidak undefined bahkan jika null
              const itemName = String(item.name || `Item #${index+1}`);
              console.log(`Item name untuk #${index}:`, itemName);
              
              // Pastikan quantity dan price ada dan valid
              const itemQuantity = item.quantity !== undefined && item.quantity !== null 
                ? String(item.quantity) 
                : '1';
              
              const itemPrice = item.price !== undefined && item.price !== null 
                ? String(item.price) 
                : '0';
              
              // Hitung total harga dengan aman
              const itemTotalPrice = safeParseFloat(itemPrice) * safeParseFloat(itemQuantity);
              
              // Tampilkan item ke PDF
              doc.text(itemName, 14, y);
              doc.text(itemQuantity, 100, y, { align: 'right' });
              doc.text(formatPrice(itemPrice), 140, y, { align: 'right' });
              doc.text(formatPrice(itemTotalPrice.toString()), 195, y, { align: 'right' });
            } catch (err) {
              console.error(`Error processing item ${index}:`, err);
              // Fallback jika terjadi error
              doc.text(`Item #${index+1}`, 14, y);
              doc.text("1", 100, y, { align: 'right' });
              doc.text(formatPrice("0"), 140, y, { align: 'right' });
              doc.text(formatPrice("0"), 195, y, { align: 'right' });
            }
            
            y += 8;
          });
        } else {
          console.error("data.items kosong atau bukan array:", JSON.stringify(data.items));
          
          // Fallback jika items tidak ada, tambahkan pesan "Tidak ada item"
          doc.text("Tidak ada item", 14, y);
          doc.text("-", 100, y, { align: 'right' });
          doc.text("-", 140, y, { align: 'right' });
          doc.text("-", 195, y, { align: 'right' });
          y += 8;
        }
        
        // Garis sebelum total
        doc.setLineWidth(0.3);
        doc.line(14, y + 2, 196, y + 2);
        
        // Subtotal, Discount, and Total
        doc.setFont("helvetica", "normal");
        
        // Tambahkan subtotal jika tersedia
        // Jika subtotal adalah 0, gunakan totalAmount + discount sebagai subtotal
        const subtotalValue = safeParseFloat(data.subtotal);
        const discountValue = safeParseFloat(data.discount);
        const totalAmountValue = safeParseFloat(data.transaction.totalAmount);
        
        const subtotalToShow = subtotalValue > 0 
          ? subtotalValue 
          : totalAmountValue + discountValue;
        
        doc.text("Subtotal:", 140, y + 10, { align: 'right' });
        doc.text(formatPrice(subtotalToShow.toString()), 195, y + 10, { align: 'right' });
        y += 7;
        
        // Tambahkan diskon jika ada
        if (discountValue > 0) {
          doc.text("Diskon:", 140, y + 10, { align: 'right' });
          doc.text(`${formatPrice(discountValue.toString())}`, 195, y + 10, { align: 'right' });
          y += 7;
        }
        
        // Total akhir
        doc.setFont("helvetica", "bold");
        doc.text("Total:", 140, y + 10, { align: 'right' });
        // Gunakan totalAmount dari transaksi sebagai total akhir 
        // (lebih konsisten dan mencegah hasil perhitungan yang berbeda)
        doc.text(formatPrice(data.transaction.totalAmount.toString()), 195, y + 10, { align: 'right' });
        y += 10;
        
        // Jika ada kredit, tambahkan ke PDF
        const creditAmount = safeParseFloat(data.transaction.creditAmount);
        
        if (creditAmount > 0) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(255, 0, 0); // Red for kredit
          doc.text("Kredit:", 140, y + 10, { align: 'right' });
          doc.text(formatPrice(creditAmount.toString()), 195, y + 10, { align: 'right' });
          y += 8;
          
          // Hitung jumlah yang dibayar (total - kredit)
          const paidAmount = totalAmountValue - creditAmount;
          
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 128, 0); // Green for amount paid
          doc.text("Dibayar:", 140, y + 10, { align: 'right' });
          doc.text(formatPrice(paidAmount.toString()), 195, y + 10, { align: 'right' });
          y += 12;
          doc.setTextColor(0, 0, 0); // Reset text color to black
        } else {
          y += 2; // Add just a little spacing if no kredit info
        }
        
        // Tambahkan informasi kredit jika ini adalah transaksi kredit
        // Gunakan nilai isPaid yang sudah didefinisikan sebelumnya
        if (!isPaid && data.transaction.creditAmount && data.transaction.paidAmount) {
          // Buat kotak untuk info kredit
          doc.setFillColor(248, 249, 250); // Light gray background
          doc.setDrawColor(222, 226, 230); // Border color
          doc.roundedRect(120, y + 2, 75, 25, 2, 2, 'FD');
          
          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text("Informasi Kredit:", 125, y + 8);
          
          doc.setFont("helvetica", "normal");
          doc.text("Dibayar Dimuka:", 125, y + 15);
          doc.text(formatPrice(data.transaction.paidAmount.toString()), 190, y + 15, { align: 'right' });
          
          doc.setTextColor(220, 53, 69); // Red for debt
          doc.text("Sisa Hutang:", 125, y + 22);
          doc.text(formatPrice(data.transaction.creditAmount.toString()), 190, y + 22, { align: 'right' });
          
          // Reset text color
          doc.setTextColor(0, 0, 0);
          y += 27;
        }
        
        // Mulai posisi untuk catatan dan info bank
        let nextY = y + 5;
        
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
        bankInfo = `*Informasi Pembayaran:*`;
        if (settings.bankName) bankInfo += `\nBank: ${settings.bankName}`;
        if (settings.bankAccountNumber) bankInfo += `\nNo. Rekening: ${settings.bankAccountNumber}`;
        if (settings.bankAccountName) bankInfo += `\nAtas Nama: ${settings.bankAccountName}`;
      }
      
      // Format detail item jika opsi includeDetailedItems diaktifkan
      let itemDetails = '';
      if (settings.includeDetailedItems && data.items && data.items.length > 0) {
        itemDetails = '\n*Detail Item:*';
        data.items.forEach(item => {
          // Gunakan properti name atau fallback jika tidak ada
          // String() untuk memastikan nilai tidak undefined
          const itemName = String(item.name || `Item`);
          const itemQuantity = item.quantity !== undefined && item.quantity !== null 
            ? String(item.quantity) 
            : '1';
          const itemPrice = item.price !== undefined && item.price !== null 
            ? String(item.price) 
            : '0';
            
          itemDetails += `\n${itemQuantity} x ${itemName} - ${formatPrice(itemPrice)}`;
        });
      }
      
      // Buat pesan berdasarkan template atau gunakan template default
      let message = '';
      
      if (settings.whatsappTemplate) {
        // Gunakan totalAmount dari transaksi sebagai total akhir
        // untuk mencegah perbedaan perhitungan dan memastikan konsistensi
        const totalAmount = data.transaction.totalAmount.toString();
        
        // Buat informasi kredit jika transaksi menggunakan kredit
        let creditInfo = '';
        const creditAmount = safeParseFloat(data.transaction.creditAmount);
        
        if (creditAmount > 0) {
          const totalAmountValue = safeParseFloat(totalAmount);
          const paidAmount = totalAmountValue - creditAmount;
          
          creditInfo = `*Informasi Kredit:*\nTotal Belanja: ${formatPrice(totalAmount)}\nJumlah Dibayar: ${formatPrice(paidAmount.toString())}\nSisa Kredit: ${formatPrice(creditAmount.toString())}`;
        }
        
        // Cek apakah ini pasien Queenzky dan pilihan displayName adalah alias (Syafliana)
        let patientName = data.patient.name;
        if (data.patient.name.includes('Queenzky') && data.displayName === 'alias') {
          patientName = 'Syafliana'; // Gunakan nama alternatif Syafliana
          console.log("Menggunakan nama alternatif 'Syafliana' pada WhatsApp message");
        }
        
        // Gunakan template kustom dan ganti variabel dengan nilai sebenarnya
        message = settings.whatsappTemplate
          .replace(/{{companyName}}/g, settings.companyName)
          .replace(/{{invoiceId}}/g, invoiceId)
          .replace(/{{totalAmount}}/g, formatPrice(totalAmount))
          .replace(/{{patientName}}/g, patientName)
          .replace(/{{bankInfo}}/g, bankInfo || '')
          .replace(/{{items}}/g, itemDetails || '')
          .replace(/{{creditInfo}}/g, creditInfo || '')
          .replace(/{{subtotal}}/g, data.subtotal ? formatPrice(data.subtotal.toString()) : formatPrice(totalAmount))
          .replace(/{{discount}}/g, data.discount && parseFloat(data.discount.toString()) > 0 ? formatPrice(data.discount.toString()) : '0');
      } else {
        // Gunakan format default jika tidak ada template kustom
        message = `*INVOICE ${invoiceId}*`;
        
        // Tambahkan salam pembuka jika tersedia
        if (settings.whatsappGreeting) {
          message += `\n${settings.whatsappGreeting.replace(/{{patientName}}/g, data.patient.name)}`;
        } else {
          message += `\nYth. ${data.patient.name},`;
        }
        
        message += `\n\nTerima kasih telah mengunjungi ${settings.companyName}.`;
        
        // Tambahkan informasi subtotal dan diskon jika tersedia
        if (data.subtotal && data.discount && data.discount > 0) {
          message += `\nSubtotal: ${formatPrice(data.subtotal.toString())}`;
          message += `\nDiskon: ${formatPrice(data.discount.toString())}`;
        }
        
        // Gunakan nilai totalAmount dari transaksi
        message += `\nTotal Pembayaran: ${formatPrice(data.transaction.totalAmount.toString())}`;
        
        // Tambahkan informasi kredit jika ada
        const creditAmount = safeParseFloat(data.transaction.creditAmount);
        if (creditAmount > 0) {
          const totalAmountValue = safeParseFloat(data.transaction.totalAmount);
          const paidAmount = totalAmountValue - creditAmount;
          
          message += `\n\n*Informasi Kredit:*`;
          message += `\nTotal Belanja: ${formatPrice(data.transaction.totalAmount.toString())}`;
          message += `\nJumlah Dibayar: ${formatPrice(paidAmount.toString())}`;
          message += `\nSisa Kredit: ${formatPrice(creditAmount.toString())}`;
        }
        
        // Tambahkan info bank jika ada
        if (bankInfo) {
          message += `\n\n${bankInfo}`;
        }
        
        // Tambahkan detail item jika opsi diaktifkan
        if (itemDetails) {
          message += `\n${itemDetails}`;
        }
        
        // Tambahkan pesan terima kasih
        message += `\n\n${settings.invoiceThankYouMessage || "Semoga sehat selalu!"}`;
        
        // Tambahkan tanda tangan
        if (settings.whatsappSignature) {
          message += `\n\n${settings.whatsappSignature.replace(/{{companyName}}/g, settings.companyName)}`;
        } else {
          message += `\n\nSalam,\nTim ${settings.companyName}`;
        }
      }
      
      // Tambahkan pengingat jadwal jika diaktifkan
      if (settings.includeAppointmentReminder) {
        const appointments = data.items.filter(item => item.type === 'package')
          .map(item => `\n• ${item.name}: Silahkan jadwalkan sesi terapi Anda melalui bagian resepsionis kami.`);
          
        if (appointments.length > 0) {
          message += '\n\n*Pengingat Jadwal Terapi:*';
          message += appointments.join('');
        }
      }

      // Encode pesan untuk URL WhatsApp
      const encodedMessage = encodeURIComponent(message);
      
      // Dapatkan nomor telepon pasien dan hapus karakter non-numerik
      let phoneNumber = data.patient.phoneNumber.replace(/\D/g, '');
      
      // Pastikan format nomor telepon benar (tambahkan 62 jika dimulai dengan 0)
      if (phoneNumber.startsWith('0')) {
        phoneNumber = '62' + phoneNumber.substring(1);
      }
      
      // Buka WhatsApp Business API dengan pesan yang sudah disiapkan
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodedMessage}`;
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
                  <strong>Nama:</strong> {
                    data.patient?.name?.includes('Queenzky') && data.displayName === 'alias'
                    ? 'Syafliana'
                    : data.patient?.name
                  }
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
                  <strong>Status:</strong> {" "}
                  {data.transaction.creditAmount && safeParseFloat(data.transaction.creditAmount) > 0
                    ? <span className="text-yellow-600">Kredit</span>
                    : data.transaction.isPaid === undefined || data.transaction.isPaid 
                      ? <span className="text-green-600">Lunas</span> 
                      : <span className="text-red-600">Belum Lunas</span>}
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
                {Array.isArray(data.items) && data.items.length > 0 ? (
                  data.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="px-4 py-2 text-gray-700">
                        {item.name || `Item #${index+1}`}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {item.quantity || 1}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {formatPrice(item.price || '0')}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {formatPrice(((parseFloat(item.price || '0') * (item.quantity || 1)).toString()))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2 text-gray-700 text-center" colSpan={4}>
                      Tidak ada item dalam transaksi ini
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                {data.subtotal && (
                  <tr>
                    <td colSpan={2}></td>
                    <td className="px-4 py-2 text-right text-gray-700">Subtotal:</td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {formatPrice(data.subtotal.toString())}
                    </td>
                  </tr>
                )}
                
                {data.discount && data.discount > 0 && (
                  <tr>
                    <td colSpan={2}></td>
                    <td className="px-4 py-2 text-right text-red-500">Diskon:</td>
                    <td className="px-4 py-2 text-right text-red-500">
                      {formatPrice(data.discount.toString())}
                    </td>
                  </tr>
                )}
                
                <tr>
                  <td colSpan={2}></td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-700">Total:</td>
                  <td className="px-4 py-2 text-right font-semibold text-primary">
                    {formatPrice(data.transaction.totalAmount.toString())}
                  </td>
                </tr>
                {data.transaction.creditAmount && parseFloat(data.transaction.creditAmount.toString()) > 0 && (
                <tr>
                  <td colSpan={2}></td>
                  <td className="px-4 py-2 text-right font-semibold text-red-500">Kredit:</td>
                  <td className="px-4 py-2 text-right font-semibold text-red-500">
                    {formatPrice(data.transaction.creditAmount.toString())}
                  </td>
                </tr>
                )}
                {data.transaction.creditAmount && parseFloat(data.transaction.creditAmount.toString()) > 0 && (
                <tr>
                  <td colSpan={2}></td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-700">Dibayar:</td>
                  <td className="px-4 py-2 text-right font-semibold text-primary">
                    {formatPrice((parseFloat(data.transaction.totalAmount.toString()) - parseFloat(data.transaction.creditAmount.toString())).toString())}
                  </td>
                </tr>
                )}
              </tfoot>
            </table>

            {/* Total section dengan subtotal dan diskon */}
            <div className="border-t border-gray-200 pt-4 mb-4">
              {/* Subtotal */}
              {data.subtotal && (
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">Subtotal</span>
                  <span>{formatPrice(data.subtotal.toString())}</span>
                </div>
              )}
              
              {/* Diskon jika ada dan lebih dari 0 */}
              {data.discount && parseFloat(data.discount.toString()) > 0 && (
                <div className="flex justify-between text-sm mb-2 text-red-500">
                  <span className="font-medium">Diskon</span>
                  <span>{formatPrice(data.discount.toString())}</span>
                </div>
              )}
              
              {/* Total akhir */}
              <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{formatPrice(data.transaction.totalAmount.toString())}</span>
              </div>
              
              {/* Kredit (jika ada) */}
              {data.transaction.creditAmount && parseFloat(data.transaction.creditAmount.toString()) > 0 && (
                <div className="flex justify-between text-sm mt-2 font-medium text-red-500">
                  <span>Kredit</span>
                  <span>{formatPrice(data.transaction.creditAmount.toString())}</span>
                </div>
              )}
              
              {/* Total yang dibayarkan (jika ada kredit) */}
              {data.transaction.creditAmount && parseFloat(data.transaction.creditAmount.toString()) > 0 && (
                <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-gray-200 text-green-600">
                  <span>Dibayar</span>
                  <span>{formatPrice((parseFloat(data.transaction.totalAmount.toString()) - parseFloat(data.transaction.creditAmount.toString())).toString())}</span>
                </div>
              )}
              
              {/* Informasi kredit jika transaksi belum lunas */}
              {(data.isPaid === false || data.transaction.isPaid === false) && 
               data.transaction.creditAmount && parseFloat(data.transaction.creditAmount.toString()) > 0 && (
                <div className="mt-3 p-3 bg-gray-50 border border-red-200 rounded-md">
                  <div className="font-medium text-sm mb-2 text-red-700">Informasi Kredit:</div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Dibayar Dimuka</span>
                    <span>{formatPrice(data.transaction.paidAmount?.toString() || "0")}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-red-600">
                    <span>Sisa Hutang</span>
                    <span>{formatPrice(data.transaction.creditAmount.toString())}</span>
                  </div>
                </div>
              )}
            </div>

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
          <Button variant="outline" onClick={handlePrint} className="border-gray-300 hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Cetak
          </Button>
          <Button variant="outline" onClick={handleDownload} data-action="download-pdf" className="border-blue-300 text-blue-700 hover:bg-blue-50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Unduh PDF
          </Button>
          <Button onClick={handleShareWhatsApp} className="bg-green-600 hover:bg-green-700 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="h-4 w-4 mr-2 fill-white">
              <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
            </svg>
            Kirim via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
