import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { HelmetProvider } from "react-helmet-async";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import PatientDetail from "@/pages/patient-detail";
import Transactions from "@/pages/transactions";
import Products from "@/pages/products";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import Register from "@/pages/register";
import IntegratedManagement from "@/pages/integrated-management";
import Login from "@/pages/login";
import BackupRestore from "@/pages/backup-restore";
import DateTest from "@/pages/date-test";
import Layout from "@/components/layout/layout";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/lib/protected-route";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/patients" component={Patients} />
      <ProtectedRoute path="/patients/:id" component={PatientDetail} />
      <ProtectedRoute path="/transactions" component={Transactions} />
      <ProtectedRoute path="/transactions/new" component={Transactions} />

      <ProtectedRoute path="/products" component={Products} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/pendaftaran" component={IntegratedManagement} />
      <ProtectedRoute path="/backup-restore" component={BackupRestore} />
      <ProtectedRoute path="/date-test" component={DateTest} />
      <Route path="/login" component={Login} />
      <Route path="/daftar" component={Register} />
      <Route path="/register" component={Register} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <AuthProvider>
          <Layout>
            <Router />
          </Layout>
        </AuthProvider>
      </HelmetProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
