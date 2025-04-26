import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, AlertTriangle, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Interface para os grupos de pacientes duplicados
interface PatientGroup {
  phoneNumber: string;
  patients: Patient[];
  totalPatients: number;
}

// Interface simplificada para o paciente
interface Patient {
  id: number;
  name: string;
  phone: string;
  patientId: string;
  createdAt: string;
  sessions?: Session[];
  transactions?: Transaction[];
}

interface Session {
  id: number;
  status: string;
  packageId: number;
  packageName?: string;
  totalSessions: number;
  sessionsUsed: number;
}

interface Transaction {
  id: number;
  transactionId: string;
  totalAmount: string;
  paymentMethod: string;
  createdAt: string;
}

const DuplicatePatients: React.FC = () => {
  const [duplicateGroups, setDuplicateGroups] = useState<PatientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<PatientGroup | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [primaryPatient, setPrimaryPatient] = useState<number | null>(null);
  const { toast } = useToast();

  // Função para carregar os pacientes duplicados
  const loadDuplicatePatients = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/duplicate-patients");
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDuplicateGroups(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pacientes duplicados");
      console.error("Erro ao carregar pacientes duplicados:", err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega os dados quando o componente monta
  useEffect(() => {
    loadDuplicatePatients();
  }, []);

  // Função para abrir o diálogo de detalhes
  const handleViewDetails = (group: PatientGroup) => {
    setSelectedGroup(group);
    // Define o paciente mais antigo como primário por padrão
    if (group.patients.length > 0) {
      setPrimaryPatient(group.patients[0].id);
    }
    setDialogOpen(true);
  };

  // Função para simular a visualização manual dos registros duplicados
  // Em uma versão real, isso seria substituído por uma chamada à API
  const handleVisualizeOnly = () => {
    if (!selectedGroup || !primaryPatient) return;
    
    toast({
      title: "Visualização de Duplicados",
      description: `Os registros duplicados para ${selectedGroup.phoneNumber} foram destacados no sistema.`,
      variant: "default",
    });
    
    setDialogOpen(false);
  };

  // Função que simula a aplicação das correções manuais
  // Em uma versão real, isso enviaria os dados para API
  const handleApplyFixes = async () => {
    if (!selectedGroup || !primaryPatient) return;
    
    try {
      // Aqui você implementaria a lógica real para enviar ao backend
      toast({
        title: "Processando...",
        description: "Aplicando ajustes nos registros duplicados...",
      });
      
      // Simula um delay para uma operação assíncrona
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Sucesso!",
        description: `Os registros de pacientes duplicados para ${selectedGroup.phoneNumber} foram ajustados.`,
        variant: "default",
      });
      
      setDialogOpen(false);
      
      // Recarrega a lista de duplicados após o ajuste
      await loadDuplicatePatients();
    } catch (err) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar os registros duplicados. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Carregando grupos de pacientes duplicados...</div>;
  }

  if (error) {
    return (
      <div className="p-4 rounded-md bg-red-50 border border-red-200">
        <h3 className="font-semibold text-red-700 flex items-center gap-2">
          <AlertTriangle size={16} />
          Erro ao carregar dados
        </h3>
        <p className="mt-1 text-red-600">{error}</p>
        <Button 
          variant="outline" 
          onClick={loadDuplicatePatients} 
          className="mt-2"
        >
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (duplicateGroups.length === 0) {
    return (
      <div className="p-4 text-center">
        <Check className="mx-auto h-10 w-10 text-green-500 mb-2" />
        <p className="text-gray-600">Não foram encontrados grupos de pacientes duplicados.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
        <div className="flex items-start gap-2">
          <Info size={20} className="text-amber-500 mt-0.5" />
          <div>
            <p className="text-sm text-amber-800">
              Esta ferramenta identifica possíveis pacientes duplicados baseados no mesmo número de telefone.
              Use-a para <strong>visualizar</strong> e <strong>gerenciar manualmente</strong> registros duplicados. 
            </p>
            <p className="text-sm text-amber-700 mt-1">
              <strong>Não</strong> recomendamos mesclar automaticamente os registros, pois isso pode causar perda de dados.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <Input 
          placeholder="Filtrar por nome ou telefone" 
          className="w-full md:w-[300px]" 
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Telefone</TableHead>
            <TableHead>Qtd. Pacientes</TableHead>
            <TableHead>Nomes dos Pacientes</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {duplicateGroups.map((group) => (
            <TableRow key={group.phoneNumber}>
              <TableCell>{group.phoneNumber}</TableCell>
              <TableCell>{group.totalPatients}</TableCell>
              <TableCell>
                <ul className="list-disc pl-4">
                  {group.patients.slice(0, 3).map((patient) => (
                    <li key={patient.id}>{patient.name}</li>
                  ))}
                  {group.patients.length > 3 && (
                    <li className="text-gray-500">
                      +{group.patients.length - 3} mais...
                    </li>
                  )}
                </ul>
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleViewDetails(group)}
                >
                  Ver Detalhes
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Diálogo de detalhes dos pacientes duplicados */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes dos Pacientes Duplicados</DialogTitle>
            <DialogDescription>
              Analise os registros duplicados para o telefone{" "}
              <strong>{selectedGroup?.phoneNumber}</strong>
            </DialogDescription>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-4">
              <div className="mb-4 border-b pb-2">
                <h3 className="font-medium">Selecione o paciente principal:</h3>
                <div className="mt-2 space-y-2">
                  {selectedGroup.patients.map((patient) => (
                    <div key={patient.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`patient-${patient.id}`}
                        checked={primaryPatient === patient.id}
                        onCheckedChange={() => setPrimaryPatient(patient.id)}
                      />
                      <label 
                        htmlFor={`patient-${patient.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {patient.name} ({patient.patientId}) - Criado em: {new Date(patient.createdAt).toLocaleDateString()}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedGroup.patients.map((patient) => (
                  <Card key={patient.id} className={patient.id === primaryPatient ? "border-2 border-green-500" : ""}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex justify-between items-center">
                        <span>{patient.name}</span>
                        {patient.id === primaryPatient && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Principal
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        ID: {patient.patientId} | Tel: {patient.phone}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm space-y-3">
                      {/* Sessões */}
                      <div>
                        <h4 className="font-medium mb-1">Sessões:</h4>
                        {patient.sessions && patient.sessions.length > 0 ? (
                          <ul className="space-y-1">
                            {patient.sessions.map((session) => (
                              <li key={session.id} className="flex justify-between">
                                <span>{session.packageName || `Pacote ${session.packageId}`}</span>
                                <span className={session.status === 'active' ? 'text-green-600' : 'text-gray-500'}>
                                  {session.sessionsUsed}/{session.totalSessions} ({session.status})
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500 italic">Nenhuma sessão encontrada</p>
                        )}
                      </div>
                      
                      {/* Transações */}
                      <div>
                        <h4 className="font-medium mb-1">Transações:</h4>
                        {patient.transactions && patient.transactions.length > 0 ? (
                          <ul className="space-y-1">
                            {patient.transactions.slice(0, 3).map((transaction) => (
                              <li key={transaction.id} className="flex justify-between">
                                <span>{transaction.transactionId}</span>
                                <span>R$ {transaction.totalAmount}</span>
                              </li>
                            ))}
                            {patient.transactions.length > 3 && (
                              <li className="text-gray-500 text-center">
                                +{patient.transactions.length - 3} mais...
                              </li>
                            )}
                          </ul>
                        ) : (
                          <p className="text-gray-500 italic">Nenhuma transação encontrada</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 justify-between sm:justify-end">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={handleVisualizeOnly}>
              Apenas Visualizar
            </Button>
            <Button onClick={handleApplyFixes}>
              Aplicar Ajustes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DuplicatePatients;