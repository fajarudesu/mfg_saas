import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// Import Pages
import OrderList from './pages/OrderList';
import OrderDetail from './pages/OrderDetail';
import Reports from './pages/Reports_order_in'; 
import Dashboard from './pages/Dashboard';
import ProductionProgress from './pages/ProductionProgress';
import ProductionProgressPerline from './pages/ProductionProgressPerline';
import BreakdownTesting from './pages/BreakdownTesting';
import Settings from './pages/Settings';
import BreakdownShiage from './pages/BreakdownShiage';
import ReportsDelivery from './pages/Reports_delivery';
import FabSpecialProcess from './pages/Fab_Special_Process';
import SchedulingView from './pages/SchedulingView';
import SalesOrderView from './pages/SalesOrderView';
import BacklogPartReport from './pages/BacklogPartReport';
import AssemblingResultReport from './pages/AssemblingResultReport';
import DashboardShiage from './pages/DashboardShiage';
import FabRemainPickingReport from './pages/FabRemainPickingReport';
import BreakdownMasterUpdate from './pages/BreakdownMasterUpdate';
import PartsInbound from './pages/PartsInbound';
import PartsOutbound from './pages/PartsOutbound';
import CuttingInput from './pages/CuttingInput';
import CuttingResult from './pages/CuttingResult';
import Inspection from './pages/Inspection';

// Import Layout & Icons
import AppLayout from './components/AppLayout';
import { LogIn, X, Lock, CreditCard, Loader2 } from 'lucide-react';
import axios from 'axios';

// INTERCEPTOR GLOBAL AXIOS
axios.interceptors.request.use((config) => {
  const savedUser = localStorage.getItem('saiyamfg_current_user');
  if (savedUser) {
    try {
      const userObj = JSON.parse(savedUser);
      config.headers['X-User-NIK'] = userObj.nik || '-';
      config.headers['X-User-Name'] = userObj.name || 'System/Guest';
    } catch (e) {
      console.error("Gagal membaca session user:", e);
    }
  }
  return config;
}, (error) => Promise.reject(error));

// KOMPONEN GUARD (PROTECTED ROUTE)
function ProtectedRoute({ user, allowedRoles, onRequireLogin, redirectTo = "/dashboard-shiage" }) {
  // 1. Jika belum login sama sekali
  if (!user) {
    if (onRequireLogin) onRequireLogin();
    return <Navigate to={redirectTo} replace />;
  }

  // 2. Jika ada pembatasan Role
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (user.role || '').toLowerCase();
    const isAllowed = allowedRoles.some(r => r.toLowerCase() === userRole);
    if (!isAllowed) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <Outlet />;
}

export default function App() {
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [vapsSubView, setVapsSubView] = useState('scheduling');

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('saiyamfg_current_user');
    return savedUser ? JSON.parse(savedUser) : null;
  }); 

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ nik: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    const trimmedNik = loginForm.nik.trim();
    const trimmedPassword = loginForm.password.trim();

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-NIK': trimmedNik,
          'X-User-Name': 'Login Attempt'
        },
        body: JSON.stringify({ username: trimmedNik, password: trimmedPassword }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'NIK atau Password salah!');

      const activeUserData = {
        nik: data.user.nik || data.user.username,
        name: data.user.name,
        role: data.user.role,
      };

      setUser(activeUserData);
      localStorage.setItem('saiyamfg_current_user', JSON.stringify(activeUserData));
      setIsLoginModalOpen(false);
      setLoginForm({ nik: '', password: '' });
    } catch (err) {
      setLoginError(err.message || 'Gagal terhubung ke server backend');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('saiyamfg_current_user');
  };

  return (
    <Router>
      <Routes>
        {/* SEMUA RUTE UTAMA DIBUNGKUS OLEH APPLAYOUT */}
        <Route 
          element={
            <AppLayout 
              user={user} 
              onLogout={handleLogout} 
              onLoginClick={() => setIsLoginModalOpen(true)} 
            />
          }
        >
          {/* ============================================================== */}
          {/* 1. RUTE PUBLIK (Dapat dibuka tanpa login untuk monitoring)     */}
          {/* ============================================================== */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard-shiage" element={<DashboardShiage />} />

          {/* ============================================================== */}
          {/* 2. RUTE CUTTING (Wajib Login: Admin, PPIC, Prod, MT, Operator) */}
          {/* ============================================================== */}
          <Route 
            element={
              <ProtectedRoute 
                user={user} 
                allowedRoles={['admin', 'ppic', 'production', 'mt', 'operator', 'cutting']}
                onRequireLogin={() => setIsLoginModalOpen(true)}
              />
            }
          >
            <Route path="/cutting-input" element={<CuttingInput />} />
            <Route path="/cutting-result" element={<CuttingResult />} />
          </Route>

          {/* ============================================================== */}
          {/* 3. RUTE SCHEDULING & ORDERS                                    */}
          {/* ============================================================== */}
          <Route 
            element={
              <ProtectedRoute 
                user={user} 
                allowedRoles={['admin', 'ppic', 'production', 'mt']}
                onRequireLogin={() => setIsLoginModalOpen(true)}
              />
            }
          >
            <Route 
              path="/orders" 
              element={
                selectedOrderId ? (
                  <OrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
                ) : (
                  <OrderList onSelectOrder={setSelectedOrderId} />
                )
              } 
            />

            <Route 
              path="/scheduling" 
              element={
                <div className="flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Visual Scheduler:</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase">
                        {vapsSubView === 'scheduling' ? 'Capacities View' : 'Sales Orders View'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setVapsSubView('scheduling')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                          vapsSubView === 'scheduling' 
                            ? 'bg-slate-800 text-white dark:bg-blue-600' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Capacity Scheduling
                      </button>
                      <button
                        onClick={() => setVapsSubView('salesOrder')}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                          vapsSubView === 'salesOrder' 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        Sales Orders (Read-Only)
                      </button>
                    </div>
                  </div>
                  {vapsSubView === 'scheduling' ? (
                    <SchedulingView onSwitchToSalesOrder={() => setVapsSubView('salesOrder')} />
                  ) : (
                    <SalesOrderView onSwitchToScheduling={() => setVapsSubView('scheduling')} />
                  )}
                </div>
              } 
            />

            {/* Parts Inbound & Outbound */}
            <Route path="/parts-inbound" element={<PartsInbound />} />
            <Route path="/parts-outbound" element={<PartsOutbound />} />

            {/* Breakdown */}
            <Route path="/breakdown-master-update" element={<BreakdownMasterUpdate />} />
            <Route path="/breakdown-bc" element={<BreakdownTesting />} />
            <Route path="/breakdown-shiage" element={<BreakdownShiage />} />

            {/* Inspection */}
            <Route path="/inspection" element={<Inspection />} />
          </Route>

          {/* ============================================================== */}
          {/* 4. RUTE REPORTS                                                */}
          {/* ============================================================== */}
          <Route 
            element={
              <ProtectedRoute 
                user={user} 
                allowedRoles={['admin', 'ppic', 'production', 'delivery']}
                onRequireLogin={() => setIsLoginModalOpen(true)}
              />
            }
          >
            <Route path="/reports/order-in" element={<Reports />} />
            <Route path="/reports/progress-perline" element={<ProductionProgressPerline />} />
            <Route path="/reports/production-progress" element={<ProductionProgress />} />
            <Route path="/reports/assembling-result" element={<AssemblingResultReport />} />
            <Route path="/reports/delivery" element={<ReportsDelivery />} />
            <Route path="/reports/fab-special-process" element={<FabSpecialProcess />} />
            <Route path="/reports/backlog-part" element={<BacklogPartReport />} />
            <Route path="/reports/fab-remain-picking" element={<FabRemainPickingReport />} />
          </Route>

          {/* ============================================================== */}
          {/* 5. RUTE SETTINGS (Khusus Admin)                                */}
          {/* ============================================================== */}
          <Route 
            element={
              <ProtectedRoute 
                user={user} 
                allowedRoles={['admin']}
                onRequireLogin={() => setIsLoginModalOpen(true)}
              />
            }
          >
            <Route path="/settings" element={<Settings currentUser={user} />} />
          </Route>

          {/* Fallback jika route tidak ditemukan */}
          <Route path="*" element={<Navigate to="/dashboard-shiage" replace />} />
        </Route>
      </Routes>

      {/* MODAL LOGIN */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <LogIn size={20} className="text-blue-600 dark:text-blue-400" /> Login System
              </h3>
              <button 
                onClick={() => setIsLoginModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
              {loginError && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl border border-red-200 dark:border-red-800">
                  {loginError}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  NIK
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    value={loginForm.nik}
                    onChange={(e) => setLoginForm({ ...loginForm, nik: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Masukkan NIK Anda"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 text-gray-400" size={18} />
                  <input
                    type="password"
                    required
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Masukkan password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium shadow-md shadow-blue-500/20 disabled:opacity-60 transition-all text-sm mt-2"
              >
                {loginLoading && <Loader2 size={16} className="animate-spin" />}
                {loginLoading ? 'Memverifikasi...' : 'Masuk'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Router>
  );
}