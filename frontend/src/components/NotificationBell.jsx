import { useState, useEffect, useRef } from 'react';
import { Bell, Sparkles, CheckCircle2, ChevronRight, X, Calendar } from 'lucide-react';
import { CHANGELOG_DATA } from '../data/changelog';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const popoverRef = useRef(null);

  const latestVersion = CHANGELOG_DATA[0]?.version;

  useEffect(() => {
    // Cek apakah ada versi baru yang belum dilihat
    const lastSeenVersion = localStorage.getItem('saiyamfg_last_seen_version');
    if (lastSeenVersion !== latestVersion) {
      setHasUnread(true);
    }
  }, [latestVersion]);

  const handleOpenToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    // Jika dibuka dan ada notifikasi baru, tandai sudah dibaca
    if (nextState && hasUnread) {
      localStorage.setItem('saiyamfg_last_seen_version', latestVersion);
      setHasUnread(false);
    }
  };

  // Tutup popover saat klik di luar area
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={popoverRef}>
      {/* Tombol Lonceng */}
      <button
        onClick={handleOpenToggle}
        className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        title="Catatan Pembaruan Sistem"
        aria-label="Catatan Pembaruan"
      >
        <Bell size={19} />
        {/* Badge Merah Notifikasi Baru */}
        {hasUnread && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse" />
        )}
      </button>

      {/* Popover / Panel Changelog */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl z-[99999] overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95">
          {/* Header Panel */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-amber-300" />
              <div>
                <span className="font-bold text-sm block leading-tight">Pembaruan Sistem</span>
                <span className="text-[10px] text-blue-100 font-medium">SAIYAMFG Release Notes</span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {/* Daftar Riwayat Versi */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60 p-2 scrollbar-thin">
            {CHANGELOG_DATA.map((item, idx) => (
              <div key={item.version} className="p-3 hover:bg-gray-50/50 dark:hover:bg-gray-750/30 rounded-xl transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono ${
                    idx === 0 
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-800' 
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    v{item.version}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1 font-mono">
                    <Calendar size={11} /> {item.date}
                  </span>
                </div>
                
                <h4 className="text-xs font-bold text-gray-800 dark:text-gray-100 mb-2">
                  {item.title}
                </h4>
                
                <ul className="space-y-1.5">
                  {item.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-300 leading-snug">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 flex-shrink-0" />
                      <span>{change.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer Panel */}
          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-700/80 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500 font-mono">
            <span>Saiya MFG Version Control</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">v{latestVersion}</span>
          </div>
        </div>
      )}
    </div>
  );
}