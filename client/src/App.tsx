import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { HelmetProvider } from "react-helmet-async";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import PatientDetailMobile from "@/pages/patient-detail-mobile"; // New mobile friendly version
import Transactions from "@/pages/transactions";
import Products from "@/pages/products";
import Reports from "@/pages/reports";
import ReportsIndex from "@/pages/reports/index";
import PatientsDailyReport from "@/pages/reports/patients-daily";
import Settings from "@/pages/settings";
import Register from "@/pages/register";
// import RegistrationSuccess from "@/pages/registration-success";
import RegistrationSuccess from "@/pages/registration-success-fixed";
// Import halaman register sederhana untuk testing
import SimpleRegister from "@/pages/register.simple";
import Login from "@/pages/login";
import BackupRestore from "@/pages/backup-restore";
import DateTest from "@/pages/date-test";
import TherapySlots from "@/pages/therapy-slots";
import AdminPage from "@/pages/admin";
import TestDevPage from "@/pages/test-dev";
import AppointmentFix from "@/pages/appointment-fix";
import Layout from "@/components/layout/layout";
import PublicLayout from "@/components/layout/public-layout";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/lib/protected-route";

// Aplikasi utama dengan layout admin
function AdminApp() {
  return (
    <Layout>
      <Switch>
        <ProtectedRoute path="/" component={Dashboard} />
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/patients" component={Patients} />
        <ProtectedRoute path="/patients/:id" component={PatientDetailMobile} />
        <ProtectedRoute path="/transactions" component={Transactions} />
        <ProtectedRoute path="/transactions/new" component={Transactions} />
        <ProtectedRoute path="/therapy-slots" component={TherapySlots} />
        <ProtectedRoute path="/products" component={Products} />
        <ProtectedRoute path="/reports" component={Reports} />
        <ProtectedRoute path="/reports/index" component={ReportsIndex} />
        <ProtectedRoute path="/reports/patients-daily" component={PatientsDailyReport} />
        <ProtectedRoute path="/settings" component={Settings} />
        <ProtectedRoute path="/backup-restore" component={BackupRestore} />
        <ProtectedRoute path="/admin" component={AdminPage} />
        <ProtectedRoute path="/appointment-fix" component={AppointmentFix} />
        <ProtectedRoute path="/date-test" component={DateTest} />
        <ProtectedRoute path="/test-dev" component={TestDevPage} />
        <Route path="/login" component={Login} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

// Aplikasi publik (pendaftaran pasien)
function PublicApp() {
  return (
    <PublicLayout>
      <Switch>
        <Route path="/daftar" component={Register} />
        <Route path="/register" component={Register} />
        <Route path="/registration-success" component={RegistrationSuccess} />
        <Route path="/register-simple" component={SimpleRegister} />
        <Route component={NotFound} />
      </Switch>
    </PublicLayout>
  );
}

function App() {
  // Tentukan apakah ini halaman publik berdasarkan URL
  const isPublicPage = window.location.pathname.includes('/register') || 
                      window.location.pathname.includes('/daftar') || 
                      window.location.pathname.includes('/registration-success');
  
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <AuthProvider>
          {isPublicPage ? <PublicApp /> : <AdminApp />}
        </AuthProvider>
      </HelmetProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
