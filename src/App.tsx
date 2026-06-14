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
import StaffDashboard from "./pages/StaffDashboard";
import StaffHistory from "./pages/StaffHistory";
import ActivityLogs from "./pages/ActivityLogs";
import { useAuth } from "@/hooks/useAuth";
import POS from "./pages/POS";
import Products from "./pages/Products";
import BarcodePrint from "./pages/BarcodePrint";
import Categories from "./pages/Categories";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Installments from "./pages/Installments";
import Sales from "./pages/Sales";
import SalesReturns from "./pages/SalesReturns";
import Reports from "./pages/Reports";
import Suppliers from "./pages/Suppliers";
import SupplierLedger from "./pages/SupplierLedger";
import CustomerLedger from "./pages/CustomerLedger";
import StockLedger from "./pages/StockLedger";
import Purchases from "./pages/Purchases";
import Ledger from "./pages/Ledger";
import CashbookHistory from "./pages/CashbookHistory";
import Expenses from "./pages/Expenses";
import StockAdjustments from "./pages/StockAdjustments";
import Staff from "./pages/Staff";
import Attendance from "./pages/Attendance";
import Shops from "./pages/Shops";
import InstallApp from "./pages/InstallApp";
import ScannerCompanion from "./pages/ScannerCompanion";
import Contacts from "./pages/Contacts";
import Warranty from "./pages/Warranty";
import Account from "./pages/Account";
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
              <MobileScannerProvider>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route path="/" element={<PageGate page="dashboard"><DashboardSwitcher /></PageGate>} />
                    <Route path="/pos" element={<PageGate page="pos"><POS /></PageGate>} />
                    <Route path="/products" element={<PageGate page="products"><Products /></PageGate>} />
                    <Route path="/products/barcodes" element={<PageGate page="products"><BarcodePrint /></PageGate>} />
                    <Route path="/products/categories" element={<PageGate page="products"><Categories /></PageGate>} />
                    <Route path="/customers" element={<PageGate page="customers"><Customers /></PageGate>} />
                    <Route path="/customers/:id" element={<PageGate page="customers"><CustomerDetail /></PageGate>} />
                    <Route path="/installments" element={<PageGate page="installments"><Installments /></PageGate>} />
                    <Route path="/sales" element={<PageGate page="sales"><Sales /></PageGate>} />
                    <Route path="/sales/returns" element={<PageGate page="sales-returns"><SalesReturns /></PageGate>} />
                    <Route path="/reports" element={<PageGate page="reports"><Reports /></PageGate>} />
                    <Route path="/suppliers" element={<PageGate page="suppliers"><Suppliers /></PageGate>} />
                    <Route path="/suppliers/ledger" element={<PageGate page="supplier-ledger"><SupplierLedger /></PageGate>} />
                    <Route path="/customers/ledger" element={<PageGate page="customer-ledger"><CustomerLedger /></PageGate>} />
                    <Route path="/stock-ledger" element={<PageGate page="stock-ledger"><StockLedger /></PageGate>} />
                    <Route path="/purchases" element={<PageGate page="purchases"><Purchases /></PageGate>} />
                    <Route path="/ledger" element={<Ledger />} />
                    <Route path="/cashbook-history" element={<CashbookHistory />} />
                    <Route path="/expenses" element={<PageGate page="expenses"><Expenses /></PageGate>} />
                    <Route path="/stock-adjustments" element={<PageGate page="stock-adjustments"><StockAdjustments /></PageGate>} />
                    <Route path="/staff" element={<PageGate page="staff"><Staff /></PageGate>} />
                    <Route path="/staff/:id/history" element={<PageGate page="staff"><StaffHistory /></PageGate>} />
                    <Route path="/activity-logs" element={<PageGate page="activity-logs"><ActivityLogs /></PageGate>} />
                    <Route path="/attendance" element={<PageGate page="attendance"><Attendance /></PageGate>} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/warranty" element={<Warranty />} />
                    <Route path="/shops" element={<Shops />} />
                    <Route path="/install" element={<InstallApp />} />
                    <Route path="/scanner" element={<ScannerCompanion />} />
                    <Route path="/account" element={<Account />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </MobileScannerProvider>
            </ShopProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

function DashboardSwitcher() {
  const { role } = useAuth();
  // Admin / super_admin → full dashboard. Everyone else (staff) → restricted view.
  return (role === "admin" || role === "super_admin") ? <Dashboard /> : <StaffDashboard />;
}
