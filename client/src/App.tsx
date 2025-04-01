import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import Transactions from "@/pages/transactions";
import Schedule from "@/pages/schedule";
import Products from "@/pages/products";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import Register from "@/pages/register";
import RegistrationLinks from "@/pages/registration-links";
import Login from "@/pages/login";
import Layout from "@/components/layout/layout";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/lib/protected-route";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/patients" component={Patients} />
      <ProtectedRoute path="/transactions" component={Transactions} />
      <ProtectedRoute path="/transactions/new" component={Transactions} />
      <ProtectedRoute path="/schedule" component={Schedule} />
      <ProtectedRoute path="/products" component={Products} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/registration-links" component={RegistrationLinks} />
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
      <AuthProvider>
        <Layout>
          <Router />
        </Layout>
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
