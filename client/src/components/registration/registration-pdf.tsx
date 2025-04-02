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
    
    // Add header
    doc.setFontSize(20);
    doc.setTextColor(0, 128, 128); // Teal color
    doc.setFont("helvetica", "bold");
    doc.text("TERAPI TITIK SUMBER", 105, 20, { align: "center" });
    
    // Add WhatsApp contact info
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.text("hubungi WA +628127003608", 105, 30, { align: "center" });
    
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
    doc.text(`Nama: ${patientName}`, 25, y); y += lineHeight;
    
    if (patientId) {
      doc.text(`ID: ${patientId}`, 25, y); 
    } else {
      doc.text(`ID: -`, 25, y);
    }
    y += lineHeight;
    
    if (phoneNumber) {
      doc.text(`No WA: ${phoneNumber}`, 25, y); 
    } else {
      doc.text(`No WA: -`, 25, y);
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
      const dateParts = therapyDate.split('/');
      if (dateParts.length >= 3) {
        // Attempt to construct date object
        // Format: DD/MM/YYYY
        const therapyDateObj = new Date(
          parseInt(dateParts[2]), // Year
          parseInt(dateParts[1]) - 1, // Month (0-based)
          parseInt(dateParts[0]) // Day
        );
        
        if (!isNaN(therapyDateObj.getTime())) {
          // Get day name in Indonesian
          const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
          const dayName = dayNames[therapyDateObj.getDay()];
          
          doc.text(`Hari: ${dayName}`, 25, y);
          y += lineHeight;
          doc.text(`Tanggal: ${therapyDate}`, 25, y);
        } else {
          doc.text(`Tanggal: ${therapyDate}`, 25, y);
        }
      } else {
        doc.text(`Tanggal: ${therapyDate}`, 25, y);
      }
    } else {
      doc.text(`Tanggal: -`, 25, y);
    }
    y += lineHeight;
    
    if (therapyTime) {
      doc.text(`Waktu: ${therapyTime}`, 25, y); 
    } else {
      doc.text(`Waktu: -`, 25, y);
    }
    y += lineHeight;
    
    // Add space
    y += 10;
    
    // Preparation section
    doc.setFillColor(255, 245, 230);
    doc.rect(20, y, 170, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 95, 6);
    doc.text("PERSIAPAN SEBELUM TERAPI", 30, y + 6);
    y += 15;
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text("- Mohon datang 15 menit lebih awal", 25, y); y += lineHeight;
    doc.text("- Mohon bawa baju ganti (sesi terapi akan keringatan)", 25, y); y += lineHeight;
    
    // Tambahkan teks konfirmasi di bagian bawah
    y += 30;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 128, 128);
    doc.text("TERJADWAL & TERKONFIRMASI", 105, y, { align: "center" });
    
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