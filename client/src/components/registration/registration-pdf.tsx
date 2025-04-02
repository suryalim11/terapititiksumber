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
    doc.setFontSize(18);
    doc.setTextColor(0, 128, 128); // Teal color
    doc.text("TERAPI TITIK SUMBER", 105, 20, { align: "center" });
    
    // Add contact info
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Telp: +62 811-777-3608 | www.terapititiksumber.com", 105, 25, { align: "center" });
    
    // Divider line
    doc.setDrawColor(0, 128, 128);
    doc.setLineWidth(0.5);
    doc.line(20, 30, 190, 30);
    
    // Title
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("BUKTI PENDAFTARAN RESMI", 105, 35, { align: "center" });
    
    // Add subtitle
    doc.setFontSize(12);
    doc.setTextColor(70, 70, 70);
    doc.text("Dokumen Resmi Terapi Titik Sumber", 105, 43, { align: "center" });
    
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
    
    // Appointment details section - always show this
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("KONFIRMASI JADWAL TERAPI", 20, y); y += lineHeight;
    
    doc.setFont("helvetica", "normal");
    // Draw a box around the appointment details
    doc.setDrawColor(0, 128, 128);
    doc.setLineWidth(0.5);
    const boxStartY = y;
    
    // Add therapy date
    doc.setFont("helvetica", "bold");
    if (therapyDate) {
      doc.text(`Tanggal: `, 25, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${therapyDate}`, 65, y); 
      y += lineHeight;
    }
    
    // Add therapy time
    doc.setFont("helvetica", "bold");
    if (therapyTime) {
      doc.text(`Jam: `, 25, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${therapyTime}`, 65, y); 
      y += lineHeight;
    }
    
    // Add location information
    doc.setFont("helvetica", "bold");
    doc.text(`Lokasi: `, 25, y);
    doc.setFont("helvetica", "normal");
    doc.text(`Klinik Terapi Titik Sumber`, 65, y); 
    y += lineHeight;
    
    // Add status information
    doc.setFont("helvetica", "bold");
    doc.text(`Status: `, 25, y);
    doc.setFont("helvetica", "normal");
    doc.text(`TERJADWAL & TERKONFIRMASI`, 65, y); 
    y += lineHeight;
    
    // Draw the box around appointment details
    doc.rect(20, boxStartY - 5, 170, y - boxStartY + 5);
    
    // Note section
    y += 10;
    doc.setFont("helvetica", "italic");
    const note1 = "* Harap datang 15 menit sebelum jadwal untuk persiapan terapi.";
    const note2 = "* Bukti pendaftaran ini harap dibawa saat datang ke klinik.";
    
    doc.text(note1, 20, y); 
    y += lineHeight;
    doc.text(note2, 20, y); 
    y += lineHeight;
    
    // Signature section
    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    
    // Current date in Jakarta
    const today = format(new Date(), "dd MMMM yyyy");
    doc.text(`Jakarta, ${today}`, 140, y);
    y += 5;
    
    doc.text("Admin Terapi Titik Sumber", 140, y + 25);
    
    // Draw signature line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(140, y + 20, 190, y + 20);
    
    // Add digital stamp
    doc.setDrawColor(0, 128, 128);
    doc.setFillColor(240, 255, 255);
    doc.circle(50, y + 15, 15, 'FD');
    doc.setTextColor(0, 128, 128);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("TERAPI", 50, y + 13, { align: "center" });
    doc.text("TITIK", 50, y + 17, { align: "center" });
    doc.text("SUMBER", 50, y + 21, { align: "center" });
    
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
      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white mt-4 py-6 text-lg font-medium w-full justify-center"
    >
      <Download className="h-5 w-5 mr-2" />
      Unduh Bukti Pendaftaran Resmi
    </Button>
  );
}