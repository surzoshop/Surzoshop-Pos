import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import { ShopProvider } from "@/hooks/useShop";
import { MobileScannerProvider } from "@/hooks/useMobileScanner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageGate } from "@/components/PageGate";
import AppLayout from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import Installments from "./pages/Installments";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import Suppliers from "./pages/Suppliers";
import Purchases from "./pages/Purchases";
import Expenses from "./pages/Expenses";
import StockAdjustments from "./pages/StockAdjustments";
import Staff from "./pages/Staff";
import Attendance from "./pages/Attendance";
import Shops from "./pages/Shops";
import InstallApp from "./pages/InstallApp";
import ScannerCompanion from "./pages/ScannerCompanion";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <ShopProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/" element={<PageGate page="dashboard"><Dashboard /></PageGate>} />
                  <Route path="/pos" element={<PageGate page="pos"><POS /></PageGate>} />
                  <Route path="/products" element={<PageGate page="products"><Products /></PageGate>} />
                  <Route path="/customers" element={<PageGate page="customers"><Customers /></PageGate>} />
                  <Route path="/installments" element={<PageGate page="installments"><Installments /></PageGate>} />
                  <Route path="/sales" element={<PageGate page="sales"><Sales /></PageGate>} />
                  <Route path="/reports" element={<PageGate page="reports"><Reports /></PageGate>} />
                  <Route path="/suppliers" element={<PageGate page="suppliers"><Suppliers /></PageGate>} />
                  <Route path="/purchases" element={<PageGate page="purchases"><Purchases /></PageGate>} />
                  <Route path="/expenses" element={<PageGate page="expenses"><Expenses /></PageGate>} />
                  <Route path="/stock-adjustments" element={<PageGate page="stock-adjustments"><StockAdjustments /></PageGate>} />
                  <Route path="/staff" element={<PageGate page="staff"><Staff /></PageGate>} />
                  <Route path="/attendance" element={<PageGate page="attendance"><Attendance /></PageGate>} />
                  <Route path="/shops" element={<Shops />} />
                  <Route path="/install" element={<InstallApp />} />
                  <Route path="/scanner" element={<ScannerCompanion />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ShopProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
