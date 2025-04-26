import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatRupiah } from "@/lib/utils";
import { AlertTriangle, Check, Phone, RefreshCw, Users } from "lucide-react";

interface PatientSession {
  id: number;
  packageId: number;
  totalSessions: number;
  sessionsUsed: number;
  status: string;
  packageName: string;
  packagePrice: string;
}

interface Patient {
  id: number;
  displayId: string;
  name: string;
  phoneNumber: string;
  birthDate: string;
  gender: string;
  address: string;
  complaints: string;
  createdAt: string;
  activeSessions: PatientSession[];
}

interface DuplicateGroup {
  phoneNumber: string;
  count: number;
  patients: Patient[];
}

interface DuplicatePatientsResponse {
  success: boolean;
  duplicateGroups: DuplicateGroup[];
}

export function DuplicatePatients() {
  const { toast } = useToast();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Consulta para obter grupos de pacientes duplicados
  const { data, isLoading, isError, refetch } = useQuery<DuplicatePatientsResponse>({
    queryKey: ['/api/admin/duplicate-patients-details'],
    staleTime: 60000, // 1 minuto
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-[250px]" />
          <Skeleton className="h-10 w-[100px]" />
        </div>
        
        {[1, 2, 3].map(i => (
          <Card key={i} className="w-full">
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-[200px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[120px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="w-full border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <AlertTriangle className="mr-2 h-5 w-5" />
            Erro ao carregar dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Não foi possível carregar os dados de pacientes duplicados. Tente novamente mais tarde.</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data?.duplicateGroups || data.duplicateGroups.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Check className="mr-2 h-5 w-5 text-green-500" />
            Sistema em ordem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Não foram encontrados pacientes duplicados no sistema.</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Verificar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="px-4 py-2">
            <Users className="mr-2 h-4 w-4" />
            {data.duplicateGroups.length} grupos de pacientes duplicados
          </Badge>
        </div>
        
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Informações sobre pacientes duplicados</CardTitle>
          <CardDescription>
            Esta ferramenta ajuda a identificar pacientes com o mesmo número de telefone, que podem ser registros duplicados.
            Por enquanto, apenas visualize os dados - não tente mesclar os registros automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">Atenção: Não tente mesclar registros</h4>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  A mesclagem automática de registros duplicados está causando problemas de integridade de dados.
                  Por enquanto, use esta ferramenta apenas para identificar possíveis duplicações e corrija os registros manualmente.
                </p>
              </div>
            </div>
          </div>
          
          <Accordion 
            type="single" 
            collapsible 
            className="w-full"
            value={selectedGroup}
            onValueChange={setSelectedGroup}
          >
            {data.duplicateGroups.map((group) => (
              <AccordionItem 
                key={group.phoneNumber} 
                value={group.phoneNumber}
                className="border rounded-lg mb-4 overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-2 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center">
                      <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="font-mono">{group.phoneNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{group.patients.length} registros</Badge>
                      {group.patients.some(p => p.activeSessions.length > 0) && (
                        <Badge variant="secondary">Sessões ativas</Badge>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="overflow-x-auto px-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">ID</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Gênero</TableHead>
                          <TableHead>Data de Criação</TableHead>
                          <TableHead>Sessões Ativas</TableHead>
                          <TableHead>Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.patients.map((patient) => (
                          <TableRow key={patient.id}>
                            <TableCell className="font-medium">{patient.displayId}</TableCell>
                            <TableCell>{patient.name}</TableCell>
                            <TableCell>{patient.gender}</TableCell>
                            <TableCell>{new Date(patient.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell>
                              {patient.activeSessions.length > 0 ? (
                                <div className="space-y-1">
                                  {patient.activeSessions.map(session => (
                                    <Badge key={session.id} variant="outline" className="mr-1">
                                      {session.packageName} ({session.sessionsUsed}/{session.totalSessions})
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">Nenhuma</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {patient.activeSessions.length > 0 ? (
                                formatRupiah(patient.activeSessions.reduce(
                                  (total, session) => total + parseFloat(session.packagePrice), 0
                                ))
                              ) : (
                                "Rp 0"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="px-4 mt-4">
                    <Card className="bg-muted/30">
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Instruções para correção manual</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2">
                        <ol className="list-decimal pl-5 space-y-1 text-sm">
                          <li>Identifique qual registro é o principal que deve ser mantido</li>
                          <li>Anote os IDs de todas as sessões ativas nos registros duplicados</li>
                          <li>Entre em contato com o desenvolvedor para transferir essas sessões manualmente</li>
                          <li>Não tente usar a funcionalidade de mesclagem automática</li>
                        </ol>
                      </CardContent>
                    </Card>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}