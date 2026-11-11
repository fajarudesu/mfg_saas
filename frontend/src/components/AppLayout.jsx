
import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';

// Daftar nama judul sesuai URL rute
const PAGE_TITLES = {
  '/': 'Dashboard - SAIYA MFG',
  '/dashboard-shiage': 'Dashboard Shiage - SAIYA MFG',
  '/scheduling': 'Scheduling - SAIYA MFG',
  '/parts-inbound': 'Inbound Parts - SAIYA MFG',
  '/parts-outbound': 'Outbound Parts - SAIYA MFG',
  '/orders': 'BD Generator - SAIYA MFG',
  '/breakdown-master-update': 'Master Update - SAIYA MFG',
  '/breakdown-bc': 'BD Testing BC - SAIYA MFG',
  '/breakdown-shiage': 'BD Testing Shiage - SAIYA MFG',
  '/reports/order-in': 'Report Order In - SAIYA MFG',
  '/reports/production-progress': 'Production Progress - SAIYA MFG',
  '/reports/progress-perline': 'Prod Ress Perline - SAIYA MFG',
  '/reports/assembling-result': 'Assembling Result - SAIYA MFG',
  '/reports/delivery': 'Delivery Report - SAIYA MFG',
  '/reports/fab-special-process': 'Fab Special Process - SAIYA MFG',
  '/reports/backlog-part': 'Backlog Part - SAIYA MFG',
  '/reports/fab-remain-picking': 'Fab Remain Picking - SAIYA MFG',
  '/inspection': 'Inspection - SAIYA MFG',
  '/settings': 'Settings - SAIYA MFG',
  '/cutting-input': 'Cutting Input - SAIYA MFG',
  '/cutting-result': 'Cutting Result - SAIYA MFG',
};

export default function AppLayout({ user, onLogout, onLoginClick }) {
  const location = useLocation();

  useEffect(() => {
    // Ubah judul tab browser otomatis saat berpindah halaman
    const currentTitle = PAGE_TITLES[location.pathname] || 'SAIYA MFG';
    document.title = currentTitle;
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex flex-col">
      <Navbar user={user} onLogout={onLogout} onLoginClick={onLoginClick} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}