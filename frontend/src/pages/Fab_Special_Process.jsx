import { useState } from 'react';
import { UserCheck, Loader2, Download, Search, Filter, Calculator } from 'lucide-react';
import axios from 'axios';

export default function ReportsFabrikasiSpesial() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // State Filter Input
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAdvanceSearch, setIsAdvanceSearch] = useState(false);
  const [projectNo, setProjectNo] = useState('');
  const [itemNo, setItemNo] = useState('');
  const [fabNo, setFabNo] = useState(''); // State baru untuk filter Fab No

  // State Totals
  const [totals, setTotals] = useState({
    totalQty: 0,
    totalTotQty: 0
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
      const response = await axios.get('/api/reports/fabrikasi-spesial');
      
      if (response.data.status === 'success') {
        const rawData = response.data.data || [];

        const filtered = rawData.filter(item => {
          let isMatch = true;

          // 1. Filter Tanggal berdasarkan Breakdown_Upload_Date
          const targetDate = item.Breakdown_Upload_Date;
          if (startDate || endDate) {
            if (!targetDate) {
              isMatch = false; 
            } else {
              const itemDate = new Date(targetDate);
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
            if (projectNo.trim() !== '') {
              const searchProj = projectNo.toLowerCase();
              const dbProj = (item.Project || item.Order_No || '').toLowerCase();
              if (!dbProj.includes(searchProj)) isMatch = false;
            }

            if (itemNo.trim() !== '') {
              const searchItem = itemNo.toLowerCase();
              const dbItem = (item.Item_no || '').toLowerCase();
              if (!dbItem.includes(searchItem)) isMatch = false;
            }
            // Pengecekan baru untuk Fab No
            if (fabNo.trim() !== '') {
                const searchFab = fabNo.toLowerCase();
                const dbFab = (item.Fabrication_No || '').toLowerCase();
                if (!dbFab.includes(searchFab)) isMatch = false;
              }

            }
              return isMatch;
              });

        // Hitung total kalkulasi
        let tQty = 0;
        let tTotQty = 0;

        filtered.forEach(row => {
          tQty += Number(row.Quantity) || 0;
          tTotQty += Number(row.tot_qty) || 0;
        });
        // Potong hasil pencarian maksimal 500 data saja
    const limitedData = filtered.slice(0, 50);
        setTotals({ totalQty: tQty, totalTotQty: tTotQty });
        setReportData(limitedData);
      } else {
        alert("Gagal mengambil data laporan dari server.");
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
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Fab_Spesial_Process_${new Date().getTime()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      {/* HEADER PAGE */}
      <div className="flex items-center gap-3 border-b border-blue-200 pb-4">
        <div className="p-3 bg-blue-600 text-white rounded-lg shadow-sm">
          <UserCheck size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Fabrikasi Spesial Process Report</h1>
          <p className="text-sm text-gray-500">Rekapitulasi Fabrikasi Special Process (fab_special_prosess)</p>
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
            <div className="flex items-center border-b border-blue-50 bg-white">
              <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
                Upload Date
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
                {isAdvanceSearch ? 'Gunakan filter spesifik di bawah ini.' : 'Centang untuk pencarian Project / Order No atau Item No.'}
              </div>
            </div>

            {isAdvanceSearch && (
              <>
                <div className="flex items-center border-b border-blue-50 bg-white">
                  <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
                    Project / Order No
                  </div>
                  <div className="flex-1 px-4 py-2">
                    <input 
                      type="text" 
                      className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm w-64 bg-white"
                      value={projectNo}
                      onChange={(e) => setProjectNo(e.target.value)}
                      placeholder="Masukkan project/order no..."
                    />
                  </div>
                </div>

                <div className="flex items-center bg-white">
                  <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
                    Item No
                  </div>
                  <div className="flex-1 px-4 py-2">
                    <input 
                      type="text" 
                      className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm w-64 bg-white"
                      value={itemNo}
                      onChange={(e) => setItemNo(e.target.value)}
                      placeholder="Masukkan Item No..."
                    />
                  </div>
                </div>
                {/* Baris Input Baru untuk Fab No */}
    <div className="flex items-center bg-white">
      <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
        Fab No
      </div>
      <div className="flex-1 px-4 py-2">
        <input 
          type="text" 
          className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm w-64 bg-white"
          value={fabNo}
          onChange={(e) => setFabNo(e.target.value)}
          placeholder="Masukkan Fab No..."
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

      {/* SUMMARY & RESULTS */}
      <div>
        {hasSearched && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                <Calculator size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Quantity</p>
                <p className="text-xl font-bold text-blue-900">{totals.totalQty.toLocaleString('id-ID')}</p>
              </div>
            </div>
            <div className="bg-white border border-blue-100 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg text-green-600">
                <Calculator size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Overall Qty (tot_qty)</p>
                <p className="text-xl font-bold text-green-700">{totals.totalTotQty.toLocaleString('id-ID')}</p>
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

        {/* TABEL DATA HASIL VIEW */}
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto relative custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-blue-600 text-white font-semibold sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">Upload Date</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">Order No</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">Item No</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">Elevation</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">Unit Code</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider">Fab No</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider text-right">Cutting Size</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider text-right">Qty</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider text-right">Total Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {loading ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-16 text-center text-blue-600 bg-white">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                      Memuat data Fabrikasi Spesial...
                    </td>
                  </tr>
                ) : !hasSearched ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-16 text-center text-blue-500 bg-white">
                      <Search className="w-10 h-10 mx-auto mb-3 text-blue-200" />
                      Silakan tentukan parameter lalu klik <b className="text-blue-700">Search</b>.
                    </td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-16 text-center text-blue-500 bg-white">
                      <UserCheck className="w-10 h-10 mx-auto mb-3 text-blue-200" />
                      Tidak ada data yang sesuai dengan pencarian Anda.
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, index) => (
                    <tr key={index} className="hover:bg-blue-50/60 transition-colors bg-white group">
                      <td className="px-6 py-3 text-gray-700">{formatDate(row.Breakdown_Upload_Date)}</td>
                      <td className="px-6 py-3 font-mono font-medium text-blue-700">{row.Order_No || '-'}</td>
                      <td className="px-6 py-3 text-gray-900 font-medium">{row.Project || '-'}</td>
                      <td className="px-6 py-3 font-mono text-gray-600">{row.Item_no || '-'}</td>
                      <td className="px-6 py-3 text-gray-600">{row.Elevation_Code || '-'}</td>
                      <td className="px-6 py-3 text-gray-600">{row.Unit_Code || '-'}</td>
                      <td className="px-6 py-3 font-mono text-blue-600">{row.Fabrication_No || '-'}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{row.cutting_size || '0'}</td>
                      <td className="px-6 py-3 text-right font-semibold text-gray-900">{row.Quantity || '0'}</td>
                      <td className="px-6 py-3 text-right font-semibold text-green-600">{row.tot_qty || '0'}</td>
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