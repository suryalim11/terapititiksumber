import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import { format } from "date-fns";

interface RegistrationPDFProps {
  patientName: string;
  registrationNumber?: string;
  patientId?: string;
  therapyDate?: string;
  therapyTime?: string;
  phoneNumber?: string;
  registrationDate?: Date;
}

export function RegistrationPDF({
  patientName,
  registrationNumber,
  patientId,
  therapyDate,
  therapyTime,
  phoneNumber,
  registrationDate = new Date(),
}: RegistrationPDFProps) {
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Add colored header bar
    doc.setFillColor(0, 128, 128);
    doc.rect(0, 0, 210, 8, 'F');
    
    // Add logo or header
    doc.setFontSize(20);
    doc.setTextColor(0, 128, 128); // Teal color
    doc.setFont("helvetica", "bold");
    doc.text("TERAPI TITIK SUMBER", 105, 20, { align: "center" });
    
    // Add emergency contact info with telephone icon
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.text("📞 Kontak Darurat: +62 812-700-3608 (Agus Lim)", 105, 30, { align: "center" });
    
    // Add link to WhatsApp (not clickable in PDF, but visible)
    doc.setFontSize(9);
    doc.setTextColor(0, 150, 70);
    doc.text("Hubungi WhatsApp: https://wa.me/6281277003608", 105, 35, { align: "center" });
    
    // Divider line
    doc.setDrawColor(0, 128, 128);
    doc.setLineWidth(0.5);
    doc.line(20, 38, 190, 38);
    
    // Title
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("BUKTI PENDAFTARAN RESMI", 105, 48, { align: "center" });
    
    // Patient Information
    doc.setFillColor(240, 248, 255);
    doc.rect(20, 55, 170, 8, 'F');
    doc.setFontSize(14);
    doc.setTextColor(0, 100, 100);
    doc.text("DETAIL PASIEN", 30, 61);
    
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    
    const startY = 70;
    const lineHeight = 10;
    let y = startY;
    
    // Patient data
    doc.setFont("helvetica", "normal");
    doc.text(`📅 Nama: ${patientName}`, 25, y); y += lineHeight;
    
    if (patientId) {
      doc.text(`🆔 ID Pasien: ${patientId}`, 25, y); 
    } else {
      doc.text(`🆔 ID Pasien: -`, 25, y);
    }
    y += lineHeight;
    
    if (phoneNumber) {
      doc.text(`📱 No. WhatsApp: ${phoneNumber}`, 25, y); 
    } else {
      doc.text(`📱 No. WhatsApp: -`, 25, y);
    }
    y += lineHeight;
    
    // Add space
    y += 10;
    
    // Appointment details section
    doc.setFillColor(230, 248, 248);
    doc.rect(20, y, 170, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 100, 100);
    doc.text("JADWAL TERAPI", 30, y + 6);
    y += 15;
    
    // Therapy details
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    
    if (therapyDate) {
      doc.text(`🗓️ Tanggal: ${therapyDate}`, 25, y); 
    } else {
      doc.text(`🗓️ Tanggal: -`, 25, y);
    }
    y += lineHeight;
    
    if (therapyTime) {
      doc.text(`⏰ Waktu: Pukul ${therapyTime} WIB`, 25, y); 
    } else {
      doc.text(`⏰ Waktu: -`, 25, y);
    }
    y += lineHeight;
    
    // Add location information
    doc.text(`📍 Lokasi: Klinik Terapi Titik Sumber`, 25, y); 
    y += lineHeight;
    
    // Add status information
    doc.text(`✅ Status: TERJADWAL & TERKONFIRMASI`, 25, y); 
    y += lineHeight + 10;
    
    // Preparation section
    doc.setFillColor(255, 245, 230);
    doc.rect(20, y, 170, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 95, 6);
    doc.text("PERSIAPAN SEBELUM TERAPI", 30, y + 6);
    y += 15;
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("✔️ Mohon datang 15 menit lebih awal", 25, y); y += lineHeight;
    doc.text("✔️ Bawa baju ganti (sesi terapi akan keringatan)", 25, y); y += lineHeight + 10;
    
    // Important notes section
    doc.setFillColor(245, 245, 250);
    doc.rect(20, y, 170, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setTextColor(75, 75, 130);
    doc.text("CATATAN PENTING", 30, y + 6);
    y += 15;
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("🔒 Kerahasiaan Data:", 25, y); y += lineHeight;
    doc.setFont("helvetica", "normal");
    doc.text("\"Data pribadi Anda terlindungi dan hanya digunakan untuk keperluan terapi.\"", 30, y); y += lineHeight + 5;
    
    doc.setFont("helvetica", "bold");
    doc.text("❌ Kebijakan Pembatalan:", 25, y); y += lineHeight;
    doc.setFont("helvetica", "normal");
    doc.text("\"Harap konfirmasi pembatalan minimal 24 jam sebelum jadwal.\"", 30, y); y += lineHeight + 10;
    
    // Digital stamp
    doc.setDrawColor(0, 128, 128);
    doc.setFillColor(240, 255, 255);
    doc.circle(160, y - 5, 15, 'FD');
    doc.setTextColor(0, 128, 128);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("TERAPI", 160, y - 7, { align: "center" });
    doc.text("TITIK", 160, y - 3, { align: "center" });
    doc.text("SUMBER", 160, y + 1, { align: "center" });
    
    // Contact clinic section
    const footerY = 270;
    doc.setFillColor(0, 128, 128);
    doc.rect(0, footerY - 30, 210, 35, 'F');
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("KONTAK KLINIK", 105, footerY - 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("📞 Hubungi kami di: +62 811-777-3608", 105, footerY - 10, { align: "center" });
    doc.text("📍 Alamat: Kokapersuja Blok A2, Sungai Harapan, Sekupang, Batam, Indonesia 29425", 105, footerY, { align: "center" });
    
    // Document creation timestamp
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.text(`Dokumen ini dibuat pada: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 105, footerY + 7, { align: "center" });
    
    // Save the PDF
    doc.save(`Bukti-Pendaftaran-${patientName.replace(/\s+/g, "-")}.pdf`);
  };
  
  return (
    <Button
      onClick={generatePDF}
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white mt-4 py-6 text-lg font-medium w-full justify-center"
    >
      <Download className="h-5 w-5 mr-2" />
      Unduh Bukti Pendaftaran Resmi
    </Button>
  );
}