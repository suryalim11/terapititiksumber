import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Phone, User, Calendar, Package, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface PatientGroup {
  phoneNumber: string;
  patients: Patient[];
  totalPatients: number;
}

interface Patient {
  id: number;
  name: string;
  phoneNumber: string;
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

export default function DuplicatePatients() {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const { data, isLoading, isError, error } = useQuery<PatientGroup[]>({
    queryKey: ["/api/admin/duplicate-patients"],
    retry: 2
  });

  const handleViewDetails = (group: PatientGroup) => {
    if (expandedGroup === group.phoneNumber) {
      setExpandedGroup(null);
    } else {
      setExpandedGroup(group.phoneNumber);
      setSelectedPatient(null);
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Memuat data pasien duplikat...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 p-4 rounded-lg text-red-800">
        <h3 className="font-bold flex items-center">
          <AlertCircle className="mr-2" />
          Error saat memuat data
        </h3>
        <p className="mt-2">Tidak dapat memuat daftar pasien duplikat.</p>
        <p className="text-sm mt-1">{error instanceof Error ? error.message : "Error tidak diketahui"}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-blue-50 p-4 rounded-lg text-blue-800">
        <h3 className="font-bold flex items-center">
          <CheckCircle2 className="mr-2" />
          Tidak ditemukan duplikat
        </h3>
        <p className="mt-2">Tidak ditemukan pasien dengan nomor telepon duplikat dalam sistem.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Kami menemukan {data.length} kelompok pasien dengan nomor telepon duplikat.
          Pasien-pasien ini mungkin merupakan data duplikat yang memerlukan perhatian.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lista de grupos de pacientes */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Kelompok Duplikat</CardTitle>
              <CardDescription>Dikelompokkan berdasarkan nomor telepon</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto">
              {data.map((group) => (
                <div 
                  key={group.phoneNumber}
                  className={`p-2 mb-2 rounded-md cursor-pointer hover:bg-gray-100 transition-colors ${
                    expandedGroup === group.phoneNumber ? "bg-gray-100 border-l-4 border-primary" : ""
                  }`}
                  onClick={() => handleViewDetails(group)}
                >
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="font-medium">{group.phoneNumber}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1 text-sm text-gray-600">
                    <span>{group.totalPatients} data</span>
                    <Badge variant="outline">{group.patients[0]?.name}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Pacientes no grupo selecionado */}
        <div className="md:col-span-2">
          {expandedGroup ? (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg">
                      Detail Kelompok: {expandedGroup}
                    </CardTitle>
                    <CardDescription>
                      {data.find(g => g.phoneNumber === expandedGroup)?.totalPatients || 0} data
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {data
                    .find(g => g.phoneNumber === expandedGroup)
                    ?.patients.map(patient => (
                      <Card 
                        key={patient.id}
                        className={`cursor-pointer hover:border-primary transition-colors ${
                          selectedPatient?.id === patient.id ? "border-primary bg-primary/5" : ""
                        }`}
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <CardHeader className="p-3 pb-0">
                          <CardTitle className="text-md flex items-center">
                            <User className="w-4 h-4 mr-2" />
                            {patient.name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 pt-2">
                          <div className="text-xs text-gray-600 space-y-1">
                            <div className="flex items-center">
                              <span className="font-medium mr-1">ID:</span> {patient.patientId}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              <span className="font-medium mr-1">Criado em:</span> 
                              {new Date(patient.createdAt).toLocaleDateString()}
                            </div>
                            <div className="flex items-center">
                              <Package className="w-3 h-3 mr-1" />
                              <span className="font-medium mr-1">Sessões:</span> 
                              {patient.sessions?.length || 0}
                            </div>
                            <div className="flex items-center">
                              <CreditCard className="w-3 h-3 mr-1" />
                              <span className="font-medium mr-1">Transações:</span> 
                              {patient.transactions?.length || 0}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>

                {selectedPatient && (
                  <div className="mt-4">
                    <Separator className="my-4" />
                    <h3 className="font-medium text-lg mb-3">Detalhes do Paciente: {selectedPatient.name}</h3>
                    
                    <Accordion type="single" collapsible className="w-full">
                      {selectedPatient.sessions && selectedPatient.sessions.length > 0 && (
                        <AccordionItem value="sessions">
                          <AccordionTrigger className="py-2">
                            <span className="flex items-center">
                              <Package className="w-4 h-4 mr-2" />
                              Pacotes e Sessões ({selectedPatient.sessions.length})
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>ID</TableHead>
                                  <TableHead>Pacote</TableHead>
                                  <TableHead>Progresso</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedPatient.sessions.map(session => (
                                  <TableRow key={session.id}>
                                    <TableCell>{session.id}</TableCell>
                                    <TableCell>{session.packageName}</TableCell>
                                    <TableCell>{session.sessionsUsed}/{session.totalSessions}</TableCell>
                                    <TableCell>
                                      <Badge 
                                        variant={
                                          session.status === 'active' ? 'default' : 
                                          session.status === 'completed' ? 'success' : 
                                          'secondary'
                                        }
                                      >
                                        {session.status}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {selectedPatient.transactions && selectedPatient.transactions.length > 0 && (
                        <AccordionItem value="transactions">
                          <AccordionTrigger className="py-2">
                            <span className="flex items-center">
                              <CreditCard className="w-4 h-4 mr-2" />
                              Transações ({selectedPatient.transactions.length})
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>ID</TableHead>
                                  <TableHead>Data</TableHead>
                                  <TableHead>Valor</TableHead>
                                  <TableHead>Método</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {selectedPatient.transactions.map(transaction => (
                                  <TableRow key={transaction.id}>
                                    <TableCell>{transaction.transactionId}</TableCell>
                                    <TableCell>{new Date(transaction.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell>Rp {transaction.totalAmount}</TableCell>
                                    <TableCell>{transaction.paymentMethod}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button variant="outline" onClick={() => setExpandedGroup(null)}>
                  Fechar
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8">
              <div className="text-center">
                <Phone className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="font-medium text-lg text-gray-700">Selecione um grupo</h3>
                <p className="text-gray-500 mt-2">
                  Clique em um dos grupos de pacientes à esquerda para visualizar os detalhes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}