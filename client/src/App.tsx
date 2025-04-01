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
import Layout from "@/components/layout/layout";
import { AuthProvider } from "@/lib/auth";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/patients" component={Patients} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/transactions/new" component={Transactions} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/products" component={Products} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route path="/daftar" component={Register} />
      <Route path="/register" component={Register} />
      <Route path="/registration-links" component={RegistrationLinks} />
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
