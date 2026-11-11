import { useState } from 'react';
import { Layers, Loader2, Download, Search, Filter } from 'lucide-react';
import axios from 'axios';

export default function Reports() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); 

  // State untuk form input
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAdvanceSearch, setIsAdvanceSearch] = useState(false);
  const [projectNo, setProjectNo] = useState('');
  const [itemNo, setItemNo] = useState('');

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
      const response = await axios.get('/api/reports/export');
      
      if (response.data.status === 'success') {
        const rawData = response.data.data || [];

        const filtered = rawData.filter(item => {
          let isMatch = true;

          // 1. Filter Rentang Tanggal
          if (startDate || endDate) {
            if (!item.Order_Date) {
              isMatch = false; 
            } else {
              const itemDate = new Date(item.Order_Date);
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
              const dbOrderNo = (item.Order_No || '').toLowerCase();
              const dbProjectName = (item.Project_Name || '').toLowerCase();
              const dbProject = (item.Project || '').toLowerCase();
              
              if (!dbOrderNo.includes(searchProj) && !dbProjectName.includes(searchProj) && !dbProject.includes(searchProj)) {
                isMatch = false;
              }
            }

            if (itemNo.trim() !== '') {
              const searchItem = itemNo.toLowerCase();
              const dbItemCode = (item.Item_Code || '').toLowerCase();
              const dbProductCode = (item.Product_Code || '').toLowerCase();

              if (!dbItemCode.includes(searchItem) && !dbProductCode.includes(searchItem)) {
                isMatch = false;
              }
            }
          }

          return isMatch;
        });

        setReportData(filtered);
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
    csvRows.push(headers.join(',')); 

    for (const row of reportData) {
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
    a.setAttribute('download', `Order_in_${new Date().getTime()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      
      {/* HEADER PAGE */}
      <div className="flex items-center gap-3 border-b border-blue-200 pb-4">
        <div className="p-3 bg-blue-600 text-white rounded-lg shadow-sm">
          <Layers size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Order In Perline</h1>
        
        </div>
      </div>

      {/* FILTER SECTION (Modern Blue & White Card) */}
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
                  className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="font-semibold text-blue-400 text-sm">To</span>
                <input 
                  type="date" 
                  className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
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
                {isAdvanceSearch ? 'Gunakan filter spesifik di bawah ini.' : 'Centang untuk mencari berdasarkan Project No atau Item No.'}
              </div>
            </div>

            {/* Project No & Item No (Conditional) */}
            {isAdvanceSearch && (
              <>
                <div className="flex items-center border-b border-blue-50 bg-white">
                  <div className="w-48 bg-blue-50/50 text-blue-800 font-semibold px-4 py-3 text-sm border-r border-blue-100">
                    Project No
                  </div>
                  <div className="flex-1 px-4 py-2">
                    <input 
                      type="text" 
                      className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all w-64 bg-white placeholder-blue-300"
                      value={projectNo}
                      onChange={(e) => setProjectNo(e.target.value)}
                      placeholder="Masukkan nama/no project..."
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
                      className="border border-blue-200 text-blue-900 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all w-64 bg-white placeholder-blue-300"
                      value={itemNo}
                      onChange={(e) => setItemNo(e.target.value)}
                      placeholder="Masukkan kode item..."
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tombol Search */}
          <div className="mt-5">
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-70"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Search size={18} />
              )}
              {loading ? 'Mencari Data...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* RESULT SECTION */}
      <div>
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
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold">Order Date</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold">Order No</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold">Project Name</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold">Destination</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold">Item Code</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold text-center">Qty</th>
                  <th className="px-6 py-3.5 text-xs uppercase tracking-wider font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center text-blue-600 bg-white">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                      Memuat data produksi...
                    </td>
                  </tr>
                ) : !hasSearched ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center text-blue-500 bg-white">
                      <Search className="w-10 h-10 mx-auto mb-3 text-blue-200" />
                      Silakan tentukan parameter lalu klik <b className="text-blue-700">Search</b>.
                    </td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center text-blue-500 bg-white">
                      <Layers className="w-10 h-10 mx-auto mb-3 text-blue-200" />
                      Tidak ada data yang sesuai dengan pencarian Anda.
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, index) => (
                    <tr key={index} className="hover:bg-blue-50/60 transition-colors bg-white group">
                      <td className="px-6 py-3 text-gray-700">{formatDate(row.Order_Date)}</td>
                      <td className="px-6 py-3 font-mono font-medium text-blue-700">{row.Order_No || '-'}</td>
                      <td className="px-6 py-3 text-gray-900 font-medium group-hover:text-blue-900">{row.Project_Name || '-'}</td>
                      <td className="px-6 py-3 text-gray-600">{row.destinaton_name || '-'}</td>
                      <td className="px-6 py-3 font-mono text-gray-600">{row.Item_Code || '-'}</td>
                      <td className="px-6 py-3 text-center font-semibold text-gray-900">{row.Quantity || '0'}</td>
                      <td className="px-6 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide border ${
                          row.Item_Status === 'CLOSED' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                          row.Item_Status === 'OPEN' ? 'bg-green-50 text-green-700 border-green-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {row.Item_Status || 'UNKNOWN'}
                        </span>
                      </td>
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