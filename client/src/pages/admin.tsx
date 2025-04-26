import { useState, useEffect } from "react";
import { useNavigate } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DuplicatePatients } from "@/components/admin/duplicate-patients";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

export default function AdminPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("duplicate-patients");

  // Verificar se o usuário está autenticado e é um administrador
  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: "Acesso restrito",
        description: "Você precisa fazer login para acessar esta página.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    if (user?.role !== "admin") {
      toast({
        title: "Acesso restrito",
        description: "Esta página é restrita a administradores.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }
  }, [isAuthenticated, user, navigate, toast]);

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Administração do Sistema</h1>
          <Button onClick={() => navigate("/")} variant="outline">
            Voltar ao Dashboard
          </Button>
        </div>

        <Tabs
          defaultValue="duplicate-patients"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="duplicate-patients">Pacientes Duplicados</TabsTrigger>
            <TabsTrigger value="system-maintenance">Manutenção do Sistema</TabsTrigger>
            <TabsTrigger value="data-consistency">Consistência de Dados</TabsTrigger>
          </TabsList>

          <TabsContent value="duplicate-patients" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Pacientes Duplicados</CardTitle>
                <CardDescription>
                  Identifique e mescle registros duplicados de pacientes para manter a integridade dos dados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DuplicatePatients />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system-maintenance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Manutenção do Sistema</CardTitle>
                <CardDescription>
                  Ferramenta de manutenção do sistema, backup e restauração de dados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-12">
                  Funcionalidade em desenvolvimento. Estará disponível em breve.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data-consistency" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Verificação de Consistência de Dados</CardTitle>
                <CardDescription>
                  Ferramentas para verificar e corrigir inconsistências nos dados do sistema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-12">
                  Funcionalidade em desenvolvimento. Estará disponível em breve.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}