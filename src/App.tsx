import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext.js';
import { Sidebar } from './components/layout/Sidebar.js';
import { Header } from './components/layout/Header.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { AdmissionsPage } from './pages/AdmissionsPage.js';
import { StudentsPage } from './pages/StudentsPage.js';
import { FeesPage } from './pages/FeesPage.js';
import { PaymentsPage } from './pages/PaymentsPage.js';
import { ReceiptsPage } from './pages/ReceiptsPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { StaffPage } from './pages/StaffPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { FeeCollectionModal } from './components/fees/FeeCollectionModal.js';
import { ReceiptModal } from './components/receipts/ReceiptModal.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Protected Route Component
const ProtectedLayout: React.FC<{
  onOpenFeeCollection: (studentId?: string) => void;
  onOpenReceipt: (receiptId: string) => void;
}> = ({ onOpenFeeCollection, onOpenReceipt }) => {
  const { user, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <span className="text-xs font-semibold text-slate-500">Initializing PBPS Management System...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex w-full max-w-full overflow-x-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-68 min-w-0 w-full max-w-full overflow-x-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenFeeCollection={() => onOpenFeeCollection()}
        />

        <main className="flex-1 p-3 sm:p-5 md:p-8 max-w-7xl w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default function App() {
  // Modal state accessible across routes
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [selectedStudentForFee, setSelectedStudentForFee] = useState<string | undefined>(undefined);

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const handleOpenFeeCollection = (studentId?: string) => {
    setSelectedStudentForFee(studentId);
    setFeeModalOpen(true);
  };

  const handleOpenReceipt = (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    setReceiptModalOpen(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Shell */}
            <Route
              element={
                <ProtectedLayout
                  onOpenFeeCollection={handleOpenFeeCollection}
                  onOpenReceipt={handleOpenReceipt}
                />
              }
            >
              <Route
                path="/"
                element={
                  <DashboardPage
                    onOpenFeeCollection={() => handleOpenFeeCollection()}
                    onOpenReceipt={handleOpenReceipt}
                  />
                }
              />
              <Route
                path="/admissions"
                element={
                  <AdmissionsPage
                    onOpenFeeCollectionForStudent={(id) => handleOpenFeeCollection(id)}
                  />
                }
              />
              <Route
                path="/students"
                element={
                  <StudentsPage
                    onOpenFeeCollection={handleOpenFeeCollection}
                    onOpenReceipt={handleOpenReceipt}
                  />
                }
              />
              <Route
                path="/fees"
                element={<FeesPage onOpenFeeCollection={handleOpenFeeCollection} />}
              />
              <Route
                path="/payments"
                element={
                  <PaymentsPage
                    onOpenFeeCollection={handleOpenFeeCollection}
                    onOpenReceipt={handleOpenReceipt}
                  />
                }
              />
              <Route
                path="/receipts"
                element={<ReceiptsPage onOpenReceipt={handleOpenReceipt} />}
              />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>

          {/* Global Fee Collection Modal */}
          <FeeCollectionModal
            isOpen={feeModalOpen}
            onClose={() => setFeeModalOpen(false)}
            initialStudentId={selectedStudentForFee}
            onPaymentSuccess={() => {
              // triggers re-renders or queries
            }}
          />

          {/* Global Official Receipt Modal */}
          <ReceiptModal
            isOpen={receiptModalOpen}
            onClose={() => setReceiptModalOpen(false)}
            receiptId={selectedReceiptId}
          />

          {/* Toast notifications */}
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
