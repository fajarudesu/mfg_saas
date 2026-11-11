import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardList, FileText, BarChart2, CheckSquare, 
  Settings, ChevronDown, ChevronRight, ChevronLeft, LogOut, User,
  LogIn, ShieldCheck, Factory, Box, Layers, Truck, FileSpreadsheet,
  Calendar, ScanLine, Sun, Moon, ArrowUpFromLine, Menu, X, ArrowDownToLine
} from 'lucide-react';
import NotificationBell from './NotificationBell';

// Icon Khusus Mesin Cutting Demax (Circular Saw Blade & Machine Bed Guide)
const DemaxCuttingIcon = ({ size = 18, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    {/* Piringan Pisau Potong / Circular Saw Blade */}
    <circle cx="12" cy="9" r="6" />
    <circle cx="12" cy="9" r="1.5" />
    {/* Mata Pisau / Gigi Saw Disc */}
    <path d="M12 2v2M12 14v2M5 9H3M19 9h2M7.05 4.05l1.41 1.41M15.54 12.54l1.41 1.41M7.05 13.95l1.41-1.41M15.54 5.46l1.41-1.41" />
    {/* Meja Dudukan / Machine Bed & Guide Rail Demax */}
    <path d="M3 18h18M5 18v3M19 18v3M8 18l1.5-4h5l1.5 4" />
  </svg>
);

export default function Navbar({ user, onLogout, onLoginClick }) {
  const location = useLocation();
  const navigate = useNavigate();

  // State Dropdown Desktop
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [activeSubCategory, setActiveSubCategory] = useState(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [isPartsOpen, setIsPartsOpen] = useState(false);
  const [isCuttingOpen, setIsCuttingOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ left: 0, top: 0 });

  // State Mobile & Tablet Drawer
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileOpenSection, setMobileOpenSection] = useState(null);

  // State Tema
  const [isDarkMode, setIsDarkMode] = useState(false);

  const navContainerRef = useRef(null);
  const reportsBtnRef = useRef(null);
  const breakdownBtnRef = useRef(null);
  const partsBtnRef = useRef(null);
  const cuttingBtnRef = useRef(null);
  const closeTimerRef = useRef(null);

  const userRole = user?.role?.toLowerCase() || 'guest';

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const closeDropdowns = () => {
    setIsReportsOpen(false);
    setIsBreakdownOpen(false);
    setIsPartsOpen(false);
    setIsCuttingOpen(false);
    setActiveSubCategory(null);
    setIsMobileMenuOpen(false);
  };

  const hasAccess = (allowedRoles) => allowedRoles.some(role => role.toLowerCase() === userRole);

  const scroll = (direction) => {
    if (navContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      navContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const handleReportsMouseEnter = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (reportsBtnRef.current) {
      const rect = reportsBtnRef.current.getBoundingClientRect();
      setDropdownPos({ left: rect.left, top: rect.bottom });
      setIsReportsOpen(true);
      setIsBreakdownOpen(false);
      setIsPartsOpen(false);
      setIsCuttingOpen(false);
    }
  };

  const handleReportsMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsReportsOpen(false);
      setActiveSubCategory(null);
    }, 200);
  };

  const handlePartsMouseEnter = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (partsBtnRef.current) {
      const rect = partsBtnRef.current.getBoundingClientRect();
      setDropdownPos({ left: rect.left, top: rect.bottom });
      setIsPartsOpen(true);
      setIsCuttingOpen(false);
      setIsReportsOpen(false);
      setIsBreakdownOpen(false);
    }
  };

  const handlePartsMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsPartsOpen(false);
    }, 200);
  };

  const handleCuttingMouseEnter = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (cuttingBtnRef.current) {
      const rect = cuttingBtnRef.current.getBoundingClientRect();
      setDropdownPos({ left: rect.left, top: rect.bottom });
      setIsCuttingOpen(true);
      setIsPartsOpen(false);
      setIsReportsOpen(false);
      setIsBreakdownOpen(false);
    }
  };

  const handleCuttingMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsCuttingOpen(false);
    }, 200);
  };

  const handleBreakdownMouseEnter = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (breakdownBtnRef.current) {
      const rect = breakdownBtnRef.current.getBoundingClientRect();
      setDropdownPos({ left: rect.left, top: rect.bottom });
      setIsBreakdownOpen(true);
      setIsReportsOpen(false);
      setIsPartsOpen(false);
      setIsCuttingOpen(false);
    }
  };

  const handleBreakdownMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsBreakdownOpen(false);
      setActiveSubCategory(null);
    }, 200);
  };

  const toggleMobileSection = (section) => {
    setMobileOpenSection(prev => prev === section ? null : section);
  };

  const getNavBtnClass = (isActive) => `
    relative flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-150 rounded-lg cursor-pointer whitespace-nowrap flex-shrink-0
    ${isActive 
      ? 'text-blue-600 bg-blue-50/80 font-semibold dark:text-blue-300 dark:bg-blue-900/50' 
      : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-blue-300'
    }
  `;

  const getDropdownItemClass = (isActive) => `
    flex items-center gap-2.5 w-[calc(100%-0.5rem)] text-left px-3.5 py-2 text-sm rounded-lg mx-1 cursor-pointer transition-colors
    ${isActive 
      ? 'bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/50 dark:text-blue-300' 
      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
    }
  `;

  const getSubCategoryClass = (isActive) => `
    flex items-center justify-between px-3.5 py-2 text-sm cursor-pointer rounded-lg mx-1 transition-colors
    ${isActive 
      ? 'bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/50 dark:text-blue-300' 
      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
    }
  `;

  const isBreakdownActive = 
    location.pathname.startsWith('/orders') || 
    location.pathname === '/breakdown-master-update' || 
    location.pathname.startsWith('/breakdown');

  const isPartsActive = 
    location.pathname === '/parts-inbound' || 
    location.pathname === '/parts-outbound';

  const isCuttingActive = 
    location.pathname === '/cutting-input' || 
    location.pathname === '/cutting-result';

  return (
    <nav className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 shadow-sm sticky top-0 z-[1000] w-full transition-colors duration-200">
      <div className="w-full px-2 sm:px-4">
        <div className="flex justify-between lg:justify-start items-center h-16 gap-2">
          
          {/* SISI KIRI: HAMBURGER (HP & TABLET) + LOGO */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <Link 
              to={userRole === 'mt' ? '/orders' : '/dashboard-shiage'} 
              onClick={closeDropdowns} 
              title="SYSTEM APPLIKASI INTERNAL "
              className="flex items-center gap-2 cursor-pointer group pl-1"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform bg-white dark:bg-transparent">
                <img src="/favicon.svg" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="font-extrabold text-gray-900 dark:text-white text-base sm:text-lg leading-tight tracking-tight block">
                  SAIYA<span className="text-blue-600 dark:text-blue-400">MFG</span>
                </span>
                <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase block">Version 1.0.2</span>
              </div>
            </Link>
          </div>

          {/* MENU DESKTOP HORIZONTAL */}
          <div className="hidden lg:flex items-center flex-1 min-w-0 max-w-5xl relative ml-2 mr-auto">
            <button 
              onClick={() => scroll('left')} 
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex-shrink-0 mr-1"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div 
              ref={navContainerRef} 
              className="flex items-center space-x-1 overflow-x-auto scrollbar-none scroll-smooth py-2" 
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} 
              onScroll={closeDropdowns}
            >
              {/* Dashboard */}
              {hasAccess(['admin', 'ppic', 'production', 'mt']) && (
                <Link 
                  to="/dashboard-shiage" 
                  onClick={closeDropdowns} 
                  className={getNavBtnClass(location.pathname === '/dashboard-shiage')}
                >
                  <BarChart2 size={18} />
                  <span>Dashboard</span>
                </Link>
              )}

              {/* Scheduling */}
              {hasAccess(['admin', 'ppic', 'production']) && (
                <Link 
                  to="/scheduling" 
                  onClick={closeDropdowns} 
                  className={getNavBtnClass(location.pathname === '/scheduling')}
                >
                  <Calendar size={18} />
                  <span>Scheduling</span>
                </Link>
              )}

              {/* DROPDOWN PARTS */}
              {hasAccess(['admin', 'ppic', 'production', 'mt']) && (
                <div 
                  ref={partsBtnRef} 
                  className="relative flex-shrink-0" 
                  onMouseEnter={handlePartsMouseEnter} 
                  onMouseLeave={handlePartsMouseLeave}
                >
                  <button className={getNavBtnClass(isPartsActive)}>
                    <Layers size={18} />
                    <span>Parts</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 opacity-60 ${isPartsOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isPartsOpen && (
                    <div 
                      className="fixed w-52 z-[99999] pt-1 -mt-1" 
                      style={{ left: `${dropdownPos.left}px`, top: `${dropdownPos.top}px` }}
                      onMouseEnter={handlePartsMouseEnter} 
                      onMouseLeave={handlePartsMouseLeave}
                    >
                      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1.5 flex flex-col">
                        <Link 
                          to="/parts-inbound" 
                          onClick={closeDropdowns} 
                          className={getDropdownItemClass(location.pathname === '/parts-inbound')}
                        >
                          <ScanLine size={16} />
                          <span>Inbound</span>
                        </Link>
                        
                        <Link 
                          to="/parts-outbound" 
                          onClick={closeDropdowns} 
                          className={getDropdownItemClass(location.pathname === '/parts-outbound')}
                        >
                          <ArrowUpFromLine size={16} />
                          <span>Outbound</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DROPDOWN CUTTING (DENGAN AKSES OPERATOR & CUTTING) */}
              {hasAccess(['admin', 'ppic', 'production', 'mt', 'operator', 'cutting']) && (
                <div 
                  ref={cuttingBtnRef} 
                  className="relative flex-shrink-0" 
                  onMouseEnter={handleCuttingMouseEnter} 
                  onMouseLeave={handleCuttingMouseLeave}
                >
                  <button className={getNavBtnClass(isCuttingActive)}>
                    <DemaxCuttingIcon size={18} />
                    <span>Cutting</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 opacity-60 ${isCuttingOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCuttingOpen && (
                    <div 
                      className="fixed w-52 z-[99999] pt-1 -mt-1" 
                      style={{ left: `${dropdownPos.left}px`, top: `${dropdownPos.top}px` }}
                      onMouseEnter={handleCuttingMouseEnter} 
                      onMouseLeave={handleCuttingMouseLeave}
                    >
                      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1.5 flex flex-col">
                        <Link 
                          to="/cutting-input" 
                          onClick={closeDropdowns} 
                          className={getDropdownItemClass(location.pathname === '/cutting-input')}
                        >
                          <ArrowDownToLine size={16} />
                          <span>Cutting Input</span>
                        </Link>
                        
                        <Link 
                          to="/cutting-result" 
                          onClick={closeDropdowns} 
                          className={getDropdownItemClass(location.pathname === '/cutting-result')}
                        >
                          <ScanLine size={16} />
                          <span>Cutting Result</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DROPDOWN REPORTS */}
              {hasAccess(['admin', 'ppic', 'production', 'delivery']) && (
                <div 
                  ref={reportsBtnRef} 
                  className="relative flex-shrink-0" 
                  onMouseEnter={handleReportsMouseEnter} 
                  onMouseLeave={handleReportsMouseLeave}
                >
                  <button className={getNavBtnClass(location.pathname.startsWith('/reports'))}>
                    <FileText size={18} />
                    <span>Reports</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 opacity-60 ${isReportsOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isReportsOpen && (
                    <div 
                      className="fixed w-56 z-[99999] pt-1 -mt-1" 
                      style={{ left: `${dropdownPos.left}px`, top: `${dropdownPos.top}px` }}
                    >
                      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1.5">
                        
                        {/* Production Sub-menu */}
                        {hasAccess(['admin', 'ppic', 'production']) && (
                          <div className="relative" onMouseEnter={() => setActiveSubCategory('production')}>
                            <div className={getSubCategoryClass(activeSubCategory === 'production' || location.pathname.startsWith('/reports'))}>
                              <span className="flex items-center gap-2.5"><Factory size={16} /> Production</span>
                              <ChevronRight size={14} className="opacity-50" />
                            </div>
                            {activeSubCategory === 'production' && (
                              <div className="absolute left-full top-0 -ml-2 pl-2 w-56 z-[99999]">
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1.5">
                                  <Link to="/reports/order-in" onClick={closeDropdowns} className={getDropdownItemClass(location.pathname === '/reports/order-in')}><span>Order In Perline</span></Link>
                                  <Link to="/reports/production-progress" onClick={closeDropdowns} className={getDropdownItemClass(location.pathname === '/reports/production-progress')}><span>Production Progress</span></Link>
                                  <Link to="/reports/progress-perline" onClick={closeDropdowns} className={getDropdownItemClass(location.pathname === '/reports/progress-perline')}><span>Prod Ress Perline</span></Link>
                                  <Link to="/reports/assembling-result" onClick={closeDropdowns} className={getDropdownItemClass(location.pathname === '/reports/assembling-result')}><span>Assembling Result</span></Link>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Profil Sub-menu */}
                        {hasAccess(['admin', 'ppic']) && (
                          <div className="relative" onMouseEnter={() => setActiveSubCategory('profile')}>
                            <div className={getSubCategoryClass(activeSubCategory === 'profile' || location.pathname === '/reports/fab-special-process' || location.pathname === '/reports/fab-remain-picking')}>
                              <span className="flex items-center gap-2.5"><Box size={16} /> Profil</span>
                              <ChevronRight size={14} className="opacity-50" />
                            </div>
                            {activeSubCategory === 'profile' && (
                              <div className="absolute left-full top-0 -ml-2 pl-2 w-64 z-[99999]">
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1.5">
                                  <Link to="/reports/fab-special-process" onClick={closeDropdowns} className={getDropdownItemClass(location.pathname === '/reports/fab-special-process')}><span>Fabrikasi Spesial Process</span></Link>
                                  <Link to="/reports/fab-remain-picking" onClick={closeDropdowns} className={getDropdownItemClass(location.pathname === '/reports/fab-remain-picking')}><span>Fab Remain Picking Profil</span></Link>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Parts Sub-menu */}
                        {hasAccess(['admin', 'ppic']) && (
                          <div className="relative" onMouseEnter={() => setActiveSubCategory('parts')}>
                            <div className={getSubCategoryClass(activeSubCategory === 'parts' || location.pathname === '/reports/backlog-part')}>
                              <span className="flex items-center gap-2.5"><Layers size={16} /> Parts</span>
                              <ChevronRight size={14} className="opacity-50" />
                            </div>
                            {activeSubCategory === 'parts' && (
                              <div className="absolute left-full top-0 -ml-2 pl-2 w-56 z-[99999]">
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1.5 mx-1">
                                  <Link to="/reports/backlog-part" onClick={closeDropdowns} className={`block w-full text-left px-4 py-2 text-sm rounded-lg transition-colors ${location.pathname === '/reports/backlog-part' ? 'bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'}`}>Backlog Part</Link>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Delivery Sub-menu */}
                        {hasAccess(['admin', 'ppic', 'delivery']) && (
                          <div className="relative" onMouseEnter={() => setActiveSubCategory('delivery')}>
                            <div className={getSubCategoryClass(activeSubCategory === 'delivery' || location.pathname === '/reports/delivery')}>
                              <span className="flex items-center gap-2.5"><Truck size={16} /> Delivery</span>
                              <ChevronRight size={14} className="opacity-50" />
                            </div>
                            {activeSubCategory === 'delivery' && (
                              <div className="absolute left-full top-0 -ml-2 pl-2 w-56 z-[99999]">
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1.5">
                                  <Link to="/reports/delivery" onClick={closeDropdowns} className={getDropdownItemClass(location.pathname === '/reports/delivery')}><span>Delivery Data Report</span></Link>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="h-4 w-[1px] bg-gray-200 dark:bg-gray-700 mx-2 flex-shrink-0" />

              {/* DROPDOWN BREAKDOWN */}
              {hasAccess(['admin', 'ppic', 'production', 'mt']) && (
                <div 
                  ref={breakdownBtnRef} 
                  className="relative flex-shrink-0" 
                  onMouseEnter={handleBreakdownMouseEnter} 
                  onMouseLeave={handleBreakdownMouseLeave}
                >
                  <button className={getNavBtnClass(isBreakdownActive)}>
                    <FileSpreadsheet size={18} />
                    <span>Breakdown</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 opacity-60 ${isBreakdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isBreakdownOpen && (
                    <div 
                      className="fixed w-60 z-[99999] pt-1 -mt-1" 
                      style={{ left: `${dropdownPos.left}px`, top: `${dropdownPos.top}px` }}
                    >
                      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1.5 flex flex-col">
                        {hasAccess(['admin', 'ppic', 'mt']) && (
                          <Link to="/orders" onClick={closeDropdowns} className={getDropdownItemClass(location.pathname.startsWith('/orders'))}>
                            <ClipboardList size={16} />
                            <span>BD Generator</span>
                          </Link>
                        )}
                        
                        {hasAccess(['admin', 'ppic', 'mt']) && (
                          <Link to="/breakdown-master-update" onClick={closeDropdowns} className={getDropdownItemClass(location.pathname === '/breakdown-master-update')}>
                            <Settings size={16} />
                            <span>Breakdown Master Update</span>
                          </Link>
                        )}

                        {hasAccess(['admin', 'ppic', 'production', 'mt']) && (
                          <div className="relative" onMouseEnter={() => setActiveSubCategory('breakdown-testing')}>
                            <div className={getSubCategoryClass(activeSubCategory === 'breakdown-testing' || location.pathname.startsWith('/breakdown-'))}>
                              <span className="flex items-center gap-2.5">
                                <FileSpreadsheet size={16} /> 
                                Breakdown Testing
                              </span>
                              <ChevronRight size={14} className="opacity-50" />
                            </div>
                            {activeSubCategory === 'breakdown-testing' && (
                              <div className="absolute left-full top-0 -ml-2 pl-2 w-56 z-[99999]">
                                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl py-1.5">
                                  <Link to="/breakdown-bc" onClick={closeDropdowns} className={getDropdownItemClass(location.pathname === '/breakdown-bc')}>
                                    <FileSpreadsheet size={16} />
                                    <span>BD Testing BC</span>
                                  </Link>
                                  <Link to="/breakdown-shiage" onClick={closeDropdowns} className={getDropdownItemClass(location.pathname === '/breakdown-shiage')}>
                                    <CheckSquare size={16} />
                                    <span>BD Testing Shiage</span>
                                  </Link>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Final Inspection */}
              {hasAccess(['admin', 'ppic', 'mt']) && (
                <Link
                  to="/inspection"
                  onClick={closeDropdowns}
                  className={getNavBtnClass(location.pathname === '/inspection')}
                >
                  <CheckSquare size={18} />
                  <span>Inspection</span>
                </Link>
              )}
            </div>

            <button 
              onClick={() => scroll('right')} 
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex-shrink-0 ml-1"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* SISI KANAN */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-auto pr-1">
            <button 
              onClick={toggleTheme} 
              title={isDarkMode ? "Light Mode" : "Dark Mode"} 
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isDarkMode ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            
            <NotificationBell />

            {user && hasAccess(['admin']) && (
              <Link 
                to="/settings" 
                onClick={closeDropdowns} 
                className={`p-2 rounded-lg transition-colors ${location.pathname === '/settings' ? 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/50' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                <Settings size={19} />
              </Link>
            )}

            {user ? (
              <div className="flex items-center gap-2 sm:gap-3 pl-2 border-l border-gray-200 dark:border-gray-700">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">{user.name}</div>
                  <div className="flex items-center justify-end gap-1 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase">
                    {userRole === 'admin' && <ShieldCheck size={12} className="text-blue-600 dark:text-blue-400" />}
                    <span>{user.role}</span>
                  </div>
                </div>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-sm ring-2 ring-white dark:ring-gray-900">
                  {user.name ? user.name.charAt(0).toUpperCase() : <User size={16} />}
                </div>
                <button 
                  onClick={onLogout} 
                  title="Logout"
                  className="p-1.5 sm:p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={onLoginClick} 
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-medium shadow-sm transition-all"
              >
                <LogIn size={16} />
                <span>Login</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* DRAWER MENU PORTAL (MOBILE & TABLET) */}
      {isMobileMenuOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999999] lg:hidden">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div className="fixed top-0 bottom-0 left-0 w-[280px] sm:w-[320px] h-screen bg-white dark:bg-gray-900 shadow-2xl p-5 flex flex-col justify-between overflow-y-auto z-[10000000]">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-600 text-white">
                    <img src="/favicon.svg" alt="Logo" className="w-5 h-5 object-contain" />
                  </div>
                  <div>
                    <span className="font-extrabold text-gray-900 dark:text-white text-base block leading-tight">
                      SAIYA<span className="text-blue-600 dark:text-blue-400">MFG</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Menu Navigasi</span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="py-4 space-y-1.5">
                {/* Dashboard */}
                {hasAccess(['admin', 'ppic', 'production', 'mt']) && (
                  <Link
                    to="/dashboard-shiage"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium ${
                      location.pathname === '/dashboard-shiage' 
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <BarChart2 size={18} />
                    <span>Dashboard</span>
                  </Link>
                )}

                {/* Scheduling */}
                {hasAccess(['admin', 'ppic', 'production']) && (
                  <Link
                    to="/scheduling"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium ${
                      location.pathname === '/scheduling' 
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Calendar size={18} />
                    <span>Scheduling</span>
                  </Link>
                )}

                {/* Parts Accordion */}
                {hasAccess(['admin', 'ppic', 'production', 'mt']) && (
                  <div>
                    <button
                      onClick={() => toggleMobileSection('parts')}
                      className={`flex items-center justify-between w-full px-3.5 py-3 rounded-xl text-sm font-medium ${
                        isPartsActive 
                          ? 'bg-blue-50/70 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 font-semibold' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Layers size={18} />
                        Parts
                      </span>
                      <ChevronDown size={16} className={`transition-transform duration-200 ${mobileOpenSection === 'parts' ? 'rotate-180' : ''}`} />
                    </button>

                    {mobileOpenSection === 'parts' && (
                      <div className="pl-9 pr-2 py-1.5 space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl mt-1">
                        <Link
                          to="/parts-inbound"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-2 py-2.5 px-3 text-xs font-medium rounded-lg ${
                            location.pathname === '/parts-inbound' ? 'text-blue-600 font-bold bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          <ScanLine size={15} /> Inbound (Parts Ctrl)
                        </Link>
                        <Link
                          to="/parts-outbound"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-2 py-2.5 px-3 text-xs font-medium rounded-lg ${
                            location.pathname === '/parts-outbound' ? 'text-blue-600 font-bold bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          <ArrowUpFromLine size={15} /> Outbound
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* CUTTING ACCORDION (MOBILE & TABLET - DENGAN AKSES OPERATOR & CUTTING) */}
                {hasAccess(['admin', 'ppic', 'production', 'mt', 'operator', 'cutting']) && (
                  <div>
                    <button
                      onClick={() => toggleMobileSection('cutting')}
                      className={`flex items-center justify-between w-full px-3.5 py-3 rounded-xl text-sm font-medium ${
                        isCuttingActive 
                          ? 'bg-blue-50/70 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 font-semibold' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <DemaxCuttingIcon size={18} />
                        Cutting
                      </span>
                      <ChevronDown size={16} className={`transition-transform duration-200 ${mobileOpenSection === 'cutting' ? 'rotate-180' : ''}`} />
                    </button>

                    {mobileOpenSection === 'cutting' && (
                      <div className="pl-9 pr-2 py-1.5 space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl mt-1">
                        <Link
                          to="/cutting-input"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-2 py-2.5 px-3 text-xs font-medium rounded-lg ${
                            location.pathname === '/cutting-input' ? 'text-blue-600 font-bold bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          <ArrowDownToLine size={15} /> Cutting Input
                        </Link>
                        <Link
                          to="/cutting-result"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-2 py-2.5 px-3 text-xs font-medium rounded-lg ${
                            location.pathname === '/cutting-result' ? 'text-blue-600 font-bold bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          <ScanLine size={15} /> Cutting Result
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Reports Accordion */}
                {hasAccess(['admin', 'ppic', 'production', 'delivery']) && (
                  <div>
                    <button
                      onClick={() => toggleMobileSection('reports')}
                      className={`flex items-center justify-between w-full px-3.5 py-3 rounded-xl text-sm font-medium ${
                        location.pathname.startsWith('/reports') 
                          ? 'bg-blue-50/70 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 font-semibold' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <FileText size={18} />
                        Reports
                      </span>
                      <ChevronDown size={16} className={`transition-transform duration-200 ${mobileOpenSection === 'reports' ? 'rotate-180' : ''}`} />
                    </button>

                    {mobileOpenSection === 'reports' && (
                      <div className="pl-9 pr-2 py-2 space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl mt-1 text-xs">
                        <span className="block px-2 pt-1 font-bold text-[10px] uppercase text-gray-400">Production</span>
                        <Link to="/reports/order-in" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 px-2.5 text-gray-600 dark:text-gray-300">Order In Perline</Link>
                        <Link to="/reports/production-progress" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 px-2.5 text-gray-600 dark:text-gray-300">Production Progress</Link>
                        <Link to="/reports/progress-perline" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 px-2.5 text-gray-600 dark:text-gray-300">Prod Ress Perline</Link>
                        <Link to="/reports/assembling-result" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 px-2.5 text-gray-600 dark:text-gray-300">Assembling Result</Link>
                        
                        <span className="block px-2 pt-2 font-bold text-[10px] uppercase text-gray-400">Profile & Parts</span>
                        <Link to="/reports/fab-special-process" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 px-2.5 text-gray-600 dark:text-gray-300">Fab Special Process</Link>
                        <Link to="/reports/backlog-part" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 px-2.5 text-gray-600 dark:text-gray-300">Backlog Part</Link>
                        <Link to="/reports/delivery" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 px-2.5 text-gray-600 dark:text-gray-300">Delivery Data Report</Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Breakdown Accordion */}
                {hasAccess(['admin', 'ppic', 'production', 'mt']) && (
                  <div>
                    <button
                      onClick={() => toggleMobileSection('breakdown')}
                      className={`flex items-center justify-between w-full px-3.5 py-3 rounded-xl text-sm font-medium ${
                        isBreakdownActive 
                          ? 'bg-blue-50/70 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 font-semibold' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <FileSpreadsheet size={18} />
                        Breakdown
                      </span>
                      <ChevronDown size={16} className={`transition-transform duration-200 ${mobileOpenSection === 'breakdown' ? 'rotate-180' : ''}`} />
                    </button>

                    {mobileOpenSection === 'breakdown' && (
                      <div className="pl-9 pr-2 py-2 space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl mt-1 text-xs">
                        <Link to="/orders" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 px-2.5 text-gray-600 dark:text-gray-300">BD Generator</Link>
                        <Link to="/breakdown-master-update" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 px-2.5 text-gray-600 dark:text-gray-300">Master Update</Link>
                        <Link to="/breakdown-bc" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 px-2.5 text-gray-600 dark:text-gray-300">BD Testing BC</Link>
                        <Link to="/breakdown-shiage" onClick={() => setIsMobileMenuOpen(false)} className="block py-2 px-2.5 text-gray-600 dark:text-gray-300">BD Testing Shiage</Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Inspection */}
                {hasAccess(['admin', 'ppic', 'mt']) && (
                  <Link
                    to="/inspection"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium ${
                      location.pathname === '/inspection' 
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <CheckSquare size={18} />
                    <span>Inspection</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Profil User */}
            {user && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{user.name}</p>
                  <p className="text-xs text-gray-400 uppercase font-semibold">{user.role}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </nav>
  );
}