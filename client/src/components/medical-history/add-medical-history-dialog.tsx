import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';
import { MedicalHistoryForm } from './medical-history-form';

interface AddMedicalHistoryDialogProps {
  patientId: number;
  appointmentId?: number;
  onSuccess?: () => void;
  buttonText?: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  buttonSize?: "default" | "sm" | "lg" | "icon";
  buttonClassName?: string;
}

export function AddMedicalHistoryDialog({
  patientId,
  appointmentId,
  onSuccess,
  buttonText = "Tambah Catatan Medis",
  buttonVariant = "outline",
  buttonSize = "sm",
  buttonClassName,
}: AddMedicalHistoryDialogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  return (
    <>
      <Button
        onClick={handleOpenDialog}
        variant={buttonVariant}
        size={buttonSize}
        className={buttonClassName}
      >
        <Plus className="mr-1 h-4 w-4" />
        {buttonText}
      </Button>

      {isDialogOpen && (
        <MedicalHistoryForm
          isOpen={isDialogOpen}
          onClose={handleCloseDialog}
          patientId={patientId}
          appointmentId={appointmentId}
          onSubmitSuccess={onSuccess}
        />
      )}
    </>
  );
}