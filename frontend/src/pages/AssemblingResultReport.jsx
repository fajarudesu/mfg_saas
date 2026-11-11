import { useState } from 'react';
import { Layers, Loader2, Download, Search, Filter, Calculator, Scale } from 'lucide-react';
import axios from 'axios';

export default function AssemblingResultReport() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); 

  // State Parameter Search
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAdvanceSearch, setIsAdvanceSearch] = useState(false);
  const [projectNo, setProjectNo] = useState('');
  const [itemNo, setItemNo] = useState('');

  // 1. SEARCH UNTUK UI (DIBATASI MAXIMUM 100 ROW)
  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (isAdvanceSearch && projectNo) params.append('project_no', projectNo);
      if (isAdvanceSearch && itemNo) params.append('item_no', itemNo);
      params.append('limit', 100);

      const response = await axios.get(`/api/reports/assembling-result?${params.toString()}`);
      
      if (response.data.status === 'success') {
        setReportData(response.data.data || []);
      } else {
        alert("Gagal mengambil data laporan: " + response.data.message);
      }
    } catch (err) {
      console.error("Gagal terhubung ke database:", err);
      alert("Koneksi ke server gagal. Pastikan backend menyala.");
    } finally {
      setLoading(false);
    }
  };

  // 2. EXPORT CSV SESUAI FILTER (FULL DATA)
  const handleExportCSV = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (isAdvanceSearch && projectNo) params.append('project_no', projectNo);
      if (isAdvanceSearch && itemNo) params.append('item_no', itemNo);
      params.append('limit', 0); // limit 0 = Ambil seluruh data

      const response = await axios.get(`/api/reports/assembling-result?${params.toString()}`);
      
      if (response.data.status === 'success') {
        const fullData = response.data.data || [];
        if (fullData.length === 0) {
          alert("Tidak ada data untuk diunduh.");
          return;
        }

        const headers = Object.keys(fullData[0]);
        const csvRows = [headers.join(',')];

        for (const row of fullData) {
          const values = headers.map(header => {
            let val = row[header];
            if (val === null || val === undefined) val = '';
            val = String(val);
            if (val.includes(',')) val = `"${val}"`;
            return val;
          });
          csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `Assembling_Result_${new Date().getTime()}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error("Gagal export CSV:", err);
      alert("Gagal mengunduh file CSV.");
    } finally {
      setDownloading(false);
    }
  };

  // SUMMARY METRICS
  const totalQuantity = reportData.reduce((acc, curr) => acc + Number(curr.Quantity || 0), 0);
  const totalWeightKg = reportData.reduce((acc, curr) => acc + Number(curr.total_weight || 0), 0);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      
      {/* HEADER PAGE */}
      <div className="flex items-center gap-3 border-b border-blue-200 pb-4">
        <div className="p-3 bg-blue-600 text-white rounded-lg shadow-sm">
          <Layers size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Assembling Result Report</h1>
          <p className="text-blue-600/70 text-sm font-medium">Laporan hasil perakitan (assembling) produk secara terinci</p>
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
            
            {/* Order Date */}
            <div className="flex items-center border-b border-blue-50 bg-white">
              <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
                Order Date
              </div>
              <div className="flex items-center gap-3 px-4 py-2 flex-1">
                <input 
                  type="date" 
                  className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="font-semibold text-blue-400 text-sm">To</span>
                <input 
                  type="date" 
                  className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
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
                {isAdvanceSearch ? 'Gunakan filter spesifik di bawah ini.' : 'Centang untuk mencari berdasarkan Project atau Item No.'}
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
                      className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all w-64 bg-white placeholder-blue-300"
                      value={projectNo}
                      onChange={(e) => setProjectNo(e.target.value)}
                      placeholder="Order No / Project Name..."
                    />
                  </div>
                </div>

                <div className="flex items-center bg-white">
                  <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
                    Item No / Unit Code
                  </div>
                  <div className="flex-1 px-4 py-2">
                    <input 
                      type="text" 
                      className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all w-64 bg-white placeholder-blue-300"
                      value={itemNo}
                      onChange={(e) => setItemNo(e.target.value)}
                      placeholder="Item No / Unit Code / Lot..."
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
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-70"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              {loading ? 'Mencari Data...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY METRICS */}
      {hasSearched && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <Calculator size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Quantity</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{totalQuantity.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-50 rounded-xl text-orange-600 font-bold text-lg">
              <Scale size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Weight (Kg)</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {totalWeightKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* RESULT TABLE */}
      <div>
        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="font-semibold text-blue-900 flex items-center gap-2">
            Data Results 
            <span className="bg-blue-100 text-blue-700 py-0.5 px-2.5 rounded-full text-xs">
              {reportData.length} records (Max 100 UI)
            </span>
          </h2>
          <button 
            onClick={handleExportCSV}
            disabled={downloading || !hasSearched}
            className="flex items-center gap-2 bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {downloading ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto relative custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-blue-600 text-white font-semibold sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold max-w-[180px]">Project Name</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold">Order No</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold">Item No</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold">Unit Code</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold">Lot No</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold">Color</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold">Line</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold text-center">Group</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold text-center">Qty</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold text-right">Total Weight (Kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {loading ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-16 text-center text-blue-600 bg-white">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                      Memuat data assembling result...
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
                      <Layers className="w-10 h-10 mx-auto mb-3 text-blue-200" />
                      Tidak ada data yang sesuai dengan pencarian Anda.
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, index) => {
                    const weight = Number(row.total_weight || 0);

                    return (
                      <tr key={index} className="hover:bg-blue-50/60 transition-colors bg-white group">
                        <td 
                          className="px-6 py-3 text-gray-900 font-semibold max-w-[180px] truncate group-hover:text-blue-900" 
                          title={row.Project_Name || '-'}
                        >
                          {row.Project_Name || '-'}
                        </td>
                        <td className="px-6 py-3 font-mono font-medium text-blue-600">{row.Order_No || '-'}</td>
                        <td className="px-6 py-3 font-bold text-gray-800">{row.Item_No || '-'}</td>
                        <td className="px-6 py-3 font-mono text-gray-700">{row.Unit_Code || '-'}</td>
                        <td className="px-6 py-3 text-gray-600">{row.Lot_No || '-'}</td>
                        <td className="px-6 py-3 text-gray-600">{row.Color || '-'}</td>
                        <td className="px-6 py-3 text-gray-700 font-medium">{row.line || '-'}</td>
                        <td className="px-6 py-3 text-center text-gray-600">{row.Group || '-'}</td>
                        <td className="px-6 py-3 text-center font-bold text-blue-600">{row.Quantity || '0'}</td>
                        <td className="px-6 py-3 text-right font-mono font-bold text-orange-600">
                          {weight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}