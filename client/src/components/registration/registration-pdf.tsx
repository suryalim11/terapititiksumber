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
    
    // Add logo or header
    doc.setFontSize(18);
    doc.setTextColor(0, 128, 128); // Teal color
    doc.text("TERAPI TITIK SUMBER", 105, 20, { align: "center" });
    
    // Divider line
    doc.setDrawColor(0, 128, 128);
    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25);
    
    // Title
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("BUKTI PENDAFTARAN", 105, 35, { align: "center" });
    
    // Patient Information
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    
    const startY = 50;
    const lineHeight = 10;
    let y = startY;
    
    // Data section
    doc.setFont("helvetica", "bold");
    doc.text("Detail Pasien:", 20, y); y += lineHeight;
    
    doc.setFont("helvetica", "normal");
    doc.text(`Nama: ${patientName}`, 25, y); y += lineHeight;
    
    if (patientId) {
      doc.text(`ID Pasien: ${patientId}`, 25, y); y += lineHeight;
    }
    
    if (phoneNumber) {
      doc.text(`No. WhatsApp: ${phoneNumber}`, 25, y); y += lineHeight;
    }
    
    // Add space
    y += 5;
    
    // Registration details
    doc.setFont("helvetica", "bold");
    doc.text("Detail Pendaftaran:", 20, y); y += lineHeight;
    
    doc.setFont("helvetica", "normal");
    if (registrationNumber) {
      doc.text(`Nomor Registrasi: ${registrationNumber}`, 25, y); y += lineHeight;
    }
    
    doc.text(`Tanggal Pendaftaran: ${format(registrationDate, "dd MMMM yyyy")}`, 25, y); y += lineHeight;
    
    // Appointment details if available
    if (therapyDate || therapyTime) {
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text("Detail Jadwal Terapi:", 20, y); y += lineHeight;
      
      doc.setFont("helvetica", "normal");
      if (therapyDate) {
        doc.text(`Tanggal: ${therapyDate}`, 25, y); y += lineHeight;
      }
      if (therapyTime) {
        doc.text(`Jam: ${therapyTime}`, 25, y); y += lineHeight;
      }
    }
    
    // Note
    y += 10;
    doc.setFont("helvetica", "italic");
    doc.text("* Harap datang 15 menit sebelum jadwal untuk persiapan terapi.", 20, y); 
    y += lineHeight;
    doc.text("* Bukti pendaftaran ini harap dibawa saat datang ke klinik.", 20, y); 
    y += lineHeight;
    
    // Footer
    const footerY = 270;
    doc.setDrawColor(0, 128, 128);
    doc.setLineWidth(0.5);
    doc.line(20, footerY - 5, 190, footerY - 5);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Terapi Titik Sumber | Telp: +62 811-777-3608", 105, footerY, { align: "center" });
    doc.text(`Dokumen ini dibuat pada: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 105, footerY + 7, { align: "center" });
    
    // Save the PDF
    doc.save(`Bukti-Pendaftaran-${patientName.replace(/\s+/g, "-")}.pdf`);
  };
  
  return (
    <Button
      onClick={generatePDF}
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white mt-4"
    >
      <Download className="h-4 w-4" />
      Unduh Bukti Pendaftaran
    </Button>
  );
}