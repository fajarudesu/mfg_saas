import { useState } from 'react';
import { Truck, Loader2, Download, Search, Filter, Calculator } from 'lucide-react';
import axios from 'axios';

export default function ReportsDelivery() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // State untuk form input utama
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // State untuk form Advance Search
  const [isAdvanceSearch, setIsAdvanceSearch] = useState(false);
  const [projectNo, setProjectNo] = useState('');
  const [doNo, setDoNo] = useState('');
  const [orderStartDate, setOrderStartDate] = useState(''); // State Baru: Order Start Date
  const [orderEndDate, setOrderEndDate] = useState('');     // State Baru: Order End Date

  // State untuk menyimpan kalkulasi total
  const [totals, setTotals] = useState({
    orderQty: 0,
    deliveryQty: 0,
    deliveryWeight: 0
  });

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    
    try {
      const response = await axios.get('/api/reports/delivery');
      
      if (response.data.status === 'success') {
        const rawData = response.data.data || [];
        console.log("DATA MENTAH DARI BACKEND:", response.data.data);

        const filtered = rawData.filter(item => {
          let isMatch = true;

          // 1. Filter Rentang Tanggal (Berdasarkan Delivery Order Date)
          if (startDate || endDate) {
            if (!item["Delivery Order Date"]) {
              isMatch = false; 
            } else {
              const itemDate = new Date(item["Delivery Order Date"]);
              itemDate.setHours(0, 0, 0, 0);
              
              if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (itemDate < start) isMatch = false;
              }
              
              if (endDate) {
                const end = new Date(endDate);
                end.setHours(0, 0, 0, 0); 
                if (itemDate > end) isMatch = false;
              }
            }
          }

          // 2. Filter Advance Search
          if (isAdvanceSearch) {
            // Filter Project No
            if (projectNo.trim() !== '') {
              const searchProj = projectNo.toLowerCase();
              const dbProjectNo = (item["Project No"] || '').toLowerCase();
              const dbProjectName = (item["Project Name"] || '').toLowerCase();
              
              if (!dbProjectNo.includes(searchProj) && !dbProjectName.includes(searchProj)) {
                isMatch = false;
              }
            }

            // Filter DO Number
            if (doNo.trim() !== '') {
              const searchDo = doNo.toLowerCase();
              const dbDoNo = (item["DO Number"] || '').toLowerCase();

              if (!dbDoNo.includes(searchDo)) {
                isMatch = false;
              }
            }

            // Filter Order Date (BARU)
            if (orderStartDate || orderEndDate) {
              if (!item["Order Date"]) {
                isMatch = false; 
              } else {
                const oDate = new Date(item["Order Date"]);
                oDate.setHours(0, 0, 0, 0);
                
                if (orderStartDate) {
                  const oStart = new Date(orderStartDate);
                  oStart.setHours(0, 0, 0, 0);
                  if (oDate < oStart) isMatch = false;
                }
                
                if (orderEndDate) {
                  const oEnd = new Date(orderEndDate);
                  oEnd.setHours(0, 0, 0, 0); 
                  if (oDate > oEnd) isMatch = false;
                }
              }
            }
          }

          return isMatch;
        });

        // KALKULASI TOTAL
        let tOrder = 0;
        let tDelivery = 0;
        let tWeight = 0;

        filtered.forEach(row => {
          tOrder += Number(row["Order Qty"]) || 0;
          tDelivery += Number(row["Delivery Qty"]) || 0;
          tWeight += Number(row["Delivery Weight"]) || 0;
        });

        setTotals({
          orderQty: tOrder,
          deliveryQty: tDelivery,
          deliveryWeight: tWeight
        });

        setReportData(filtered);
      } else {
        alert("Gagal mengambil data laporan delivery dari server.");
      }
    } catch (err) {
      console.error("Gagal terhubung ke database:", err);
      alert("Koneksi ke server gagal. Pastikan backend menyala.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    const headers = Object.keys(reportData[0]);
    const csvRows = [];
    csvRows.push(headers.map(h => `"${h}"`).join(',')); 

    for (const row of reportData) {
      const values = headers.map(header => {
        let val = row[header];
        if (val === null || val === undefined) val = '';
        val = String(val);
        val = `"${val.replace(/"/g, '""')}"`; 
        return val;
      });
      csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Delivery_Report_${new Date().getTime()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      
      {/* HEADER PAGE */}
      <div className="flex items-center gap-3 border-b border-blue-200 pb-4">
        <div className="p-3 bg-blue-600 text-white rounded-lg shadow-sm">
          <Truck size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Delivery Report Data</h1>
          <p className="text-sm text-gray-500">Rekapitulasi pengiriman berdasarkan DO dan Project</p>
        </div>
      </div>

      {/* FILTER SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden">
        <div className="bg-blue-50 px-6 py-3 border-b border-blue-100 flex items-center gap-2">
          <Filter size={18} className="text-blue-700" />
          <h2 className="font-semibold text-blue-900 text-sm">Parameter Pencarian</h2>
        </div>
        
        <div className="p-6">
          <div className="w-full max-w-3xl flex flex-col border border-blue-100 rounded-lg overflow-hidden">
            
            {/* DO Date */}
            <div className="flex items-center border-b border-blue-50 bg-white">
              <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
                Delivery Date
              </div>
              <div className="flex items-center gap-3 px-4 py-2 flex-1">
                <input 
                  type="date" 
                  className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="font-semibold text-blue-400 text-sm">To</span>
                <input 
                  type="date" 
                  className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Advance Search Checkbox */}
            <div className="flex items-center border-b border-blue-50 bg-white">
              <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="advance"
                    className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500 cursor-pointer"
                    checked={isAdvanceSearch}
                    onChange={(e) => setIsAdvanceSearch(e.target.checked)}
                  />
                  <label htmlFor="advance" className="cursor-pointer">Advance Search</label>
                </div>
              </div>
              <div className="flex-1 px-4 py-3 text-sm text-blue-400 italic">
                {isAdvanceSearch ? 'Gunakan filter spesifik di bawah ini.' : 'Centang untuk pencarian spesifik (Project, DO, Order Date).'}
              </div>
            </div>

            {/* Advance Inputs */}
            {isAdvanceSearch && (
              <>
                <div className="flex items-center border-b border-blue-50 bg-white">
                  <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
                    Project No
                  </div>
                  <div className="flex-1 px-4 py-2">
                    <input 
                      type="text" 
                      className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm w-64 bg-white"
                      value={projectNo}
                      onChange={(e) => setProjectNo(e.target.value)}
                      placeholder="Masukkan project no..."
                    />
                  </div>
                </div>

                <div className="flex items-center border-b border-blue-50 bg-white">
                  <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
                    DO Number
                  </div>
                  <div className="flex-1 px-4 py-2">
                    <input 
                      type="text" 
                      className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm w-64 bg-white"
                      value={doNo}
                      onChange={(e) => setDoNo(e.target.value)}
                      placeholder="Masukkan DO Number..."
                    />
                  </div>
                </div>

                {/* Tambahan Filter Order Date */}
                <div className="flex items-center bg-white">
                  <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
                    Order Date
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 flex-1">
                    <input 
                      type="date" 
                      className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={orderStartDate}
                      onChange={(e) => setOrderStartDate(e.target.value)}
                    />
                    <span className="font-semibold text-blue-400 text-sm">To</span>
                    <input 
                      type="date" 
                      className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      value={orderEndDate}
                      onChange={(e) => setOrderEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mt-5">
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm disabled:opacity-70 transition-all"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              {loading ? 'Mencari Data...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* RESULT & SUMMARY SECTION */}
      <div>
        
        {/* SUMMARY CARDS */}
        {hasSearched && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                <Calculator size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Order Qty</p>
                <p className="text-xl font-bold text-blue-900">{totals.orderQty.toLocaleString('id-ID')}</p>
              </div>
            </div>
            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg text-green-600">
                <Truck size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Delivery Qty</p>
                <p className="text-xl font-bold text-green-700">{totals.deliveryQty.toLocaleString('id-ID')}</p>
              </div>
            </div>
            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-orange-50 rounded-lg text-orange-600">
                <span className="font-bold text-lg">Kg</span>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Weight (Kg)</p>
                <p className="text-xl font-bold text-orange-700">{totals.deliveryWeight.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="font-semibold text-blue-900 flex items-center gap-2">
            Data Results 
            <span className="bg-blue-100 text-blue-700 py-0.5 px-2.5 rounded-full text-xs">
              {reportData.length} records
            </span>
          </h2>
          <button 
            onClick={handleExportCSV}
            disabled={reportData.length === 0}
            className="flex items-center gap-2 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>

        {/* TABEL DATA */}
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto relative custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-blue-600 text-white font-semibold sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">DO Date</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">Order Date</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">DO Number</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">Project No</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">Order No</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider text-right">Order Qty</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider text-right">DO Qty</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider text-right">DO Weight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center text-blue-600 bg-white">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                      Memuat data delivery...
                    </td>
                  </tr>
                ) : !hasSearched ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center text-blue-500 bg-white">
                      <Search className="w-10 h-10 mx-auto mb-3 text-blue-200" />
                      Silakan tentukan parameter lalu klik <b className="text-blue-700">Search</b>.
                    </td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center text-blue-500 bg-white">
                      <Truck className="w-10 h-10 mx-auto mb-3 text-blue-200" />
                      Tidak ada data yang sesuai dengan pencarian Anda.
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, index) => (
                    <tr key={index} className="hover:bg-blue-50/60 transition-colors bg-white group">
                      <td className="px-6 py-3 text-gray-700">{formatDate(row["Delivery Order Date"])}</td>
                      <td className="px-6 py-3 text-gray-700">{formatDate(row["Order Date"])}</td>
                      <td className="px-6 py-3 font-mono font-medium text-blue-700">{row["DO Number"] || '-'}</td>
                      <td className="px-6 py-3 text-gray-900 font-medium">{row["Project No"] || '-'}</td>
                      <td className="px-6 py-3 text-gray-600">{row["Order No"] || '-'}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{row["Order Qty"] || '0'}</td>
                      <td className="px-6 py-3 text-right font-semibold text-gray-900">{row["Delivery Qty"] || '0'}</td>
                      <td className="px-6 py-3 text-right font-semibold text-orange-600">{row["Delivery Weight"] || '0'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}