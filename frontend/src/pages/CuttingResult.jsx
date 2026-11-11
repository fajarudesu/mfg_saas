import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Calendar, 
  RotateCcw, 
  Download, 
  Layers, 
  Filter, 
  CheckCircle2, 
  AlertCircle,
  Package,
  Scale
} from 'lucide-react';
import axios from 'axios';

const DemaxCuttingIcon = ({ size = 22, className = "" }) => (
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
    <circle cx="12" cy="9" r="6" />
    <circle cx="12" cy="9" r="1.5" />
    <path d="M12 2v2M12 14v2M5 9H3M19 9h2M7.05 4.05l1.41 1.41M15.54 12.54l1.41 1.41M7.05 13.95l1.41-1.41M15.54 5.46l1.41-1.41" />
    <path d="M3 18h18M5 18v3M19 18v3M8 18l1.5-4h5l1.5 4" />
  </svg>
);

export default function CuttingResult() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Parameter Filter
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    lot_no: '',
    project_no: ''
  });

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleReset = () => {
    setFilters({
      date_from: '',
      date_to: '',
      lot_no: '',
      project_no: ''
    });
    fetchResults({ date_from: '', date_to: '', lot_no: '', project_no: '' });
  };

  const fetchResults = async (customFilters = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (customFilters.date_from) params.append('date_from', customFilters.date_from);
      if (customFilters.date_to) params.append('date_to', customFilters.date_to);
      if (customFilters.lot_no) params.append('lot_no', customFilters.lot_no);
      if (customFilters.project_no) params.append('project_no', customFilters.project_no);

      const res = await axios.get(`/api/cutting/results?${params.toString()}`);
      if (res.data?.data) {
        setResults(res.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data cutting result:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);
      if (filters.lot_no) params.append('lot_no', filters.lot_no);
      if (filters.project_no) params.append('project_no', filters.project_no);

      const response = await axios.get(`/api/cutting/export-result?${params.toString()}`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cutting_Result_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert('Gagal mendownload data hasil pemotongan: ' + (err.message || 'Error Server'));
    } finally {
      setDownloading(false);
    }
  };

  // Ringkasan Mini KPI
  const totalBaris = results.length;
  const totalGoodPcs = results.reduce((acc, curr) => acc + (Number(curr.good_qty) || 0), 0);
  const totalDefectPcs = results.reduce((acc, curr) => acc + (Number(curr.defect_qty) || 0), 0);
  const totalGoodWgt = results.reduce((acc, curr) => acc + (Number(curr.good_weight) || 0), 0);
  const totalWasteWgt = results.reduce((acc, curr) => acc + (Number(curr.waste_weight) || 0), 0);
  const totalComplete = results.filter((r) => r.status === 'COMPLETE').length;

  return (
    <div className="w-full space-y-5 text-gray-800 dark:text-gray-100 transition-colors duration-200">
      {/* Header Utama */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 gap-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <DemaxCuttingIcon size={26} className="text-blue-600 dark:text-blue-400" />
            Cutting Result
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            Monitoring hasil aktual pemotongan profil
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading || results.length === 0}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all ${
            results.length === 0 || downloading
              ? 'bg-gray-300 text-gray-500 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95'
          }`}
        >
          <Download size={16} className={downloading ? 'animate-bounce' : ''} />
          <span>{downloading ? 'Mengekspor...' : 'Download Result (Excel/CSV)'}</span>
        </button>
      </div>

      {/* Panel Filter Parameter */}
      <div className="bg-white dark:bg-gray-800/90 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700/60 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
          <Filter size={15} className="text-blue-600 dark:text-blue-400" />
          <span>Parameter Pencarian & Filter Data</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Complete Date From */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Calendar size={13} /> Complete Date From
            </label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Complete Date To */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Calendar size={13} /> Complete Date To
            </label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Lot No */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Package size={13} /> Lot No
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Contoh: 260805A092..."
                value={filters.lot_no}
                onChange={(e) => handleFilterChange('lot_no', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchResults()}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 outline-none font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            </div>
          </div>

          {/* Project No */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Layers size={13} /> Project No
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Cari Project No..."
                value={filters.project_no}
                onChange={(e) => handleFilterChange('project_no', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchResults()}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-gray-800 dark:text-gray-100 outline-none font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Action Button Filter */}
        <div className="flex justify-end items-center gap-2 pt-2">
          <button
            onClick={handleReset}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-600 dark:text-gray-300 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          <button
            onClick={() => fetchResults()}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Search size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Memuat Data...' : 'Terapkan Filter'}</span>
          </button>
        </div>
      </div>

      {/* Mini KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono">
        <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <span className="text-[10px] text-gray-500 uppercase block font-sans">Total Baris</span>
          <span className="text-base font-bold text-gray-800 dark:text-gray-100">{totalBaris} Item</span>
        </div>
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 shadow-sm">
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase block font-sans font-bold">Total Good</span>
          <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">{totalGoodPcs} Pcs</span>
        </div>
        <div className="bg-rose-50/60 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-200 dark:border-rose-900 shadow-sm">
          <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase block font-sans font-bold">Total Defect</span>
          <span className="text-base font-bold text-rose-700 dark:text-rose-300">{totalDefectPcs} Pcs</span>
        </div>
        <div className="bg-blue-50/60 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-200 dark:border-blue-900 shadow-sm">
          <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase block font-sans font-bold">Good Weight</span>
          <span className="text-base font-bold text-blue-700 dark:text-blue-300">{totalGoodWgt.toFixed(3)} Kg</span>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/80 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <span className="text-[10px] text-gray-500 uppercase block font-sans">Total Waste</span>
          <span className="text-base font-bold text-gray-700 dark:text-gray-300">{totalWasteWgt.toFixed(3)} Kg</span>
        </div>
        <div className="bg-emerald-100/70 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 shadow-sm">
          <span className="text-[10px] text-emerald-900 dark:text-emerald-300 uppercase block font-sans font-bold">Complete Baris</span>
          <span className="text-base font-bold text-emerald-900 dark:text-emerald-300">{totalComplete} / {totalBaris}</span>
        </div>
      </div>

      {/* Tabel Result */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-blue-600 dark:text-blue-400" />
            Daftar Pemotongan Aktual ({results.length} Rekod)
          </h2>
          {results.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
              Terakhir Diperbarui: <b>{results[0]?.updated_at?.slice(0, 19) || '-'}</b>
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1500px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-[11px] font-bold text-center select-none uppercase tracking-wider bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300">
                <th className="py-3 px-2 border-r border-gray-200 dark:border-gray-700 min-w-[40px]">No</th>
                <th className="py-3 px-3 border-r border-gray-200 dark:border-gray-700">Tanggal Selesai</th>
                <th className="py-3 px-3 border-r border-gray-200 dark:border-gray-700">Lot No</th>
                <th className="py-3 px-3 border-r border-gray-200 dark:border-gray-700">Project</th>
                <th className="py-3 px-2 border-r border-gray-200 dark:border-gray-700">Item</th>
                <th className="py-3 px-2 border-r border-gray-200 dark:border-gray-700">Line</th>
                <th className="py-3 px-3 border-r border-gray-200 dark:border-gray-700">Profile</th>
                <th className="py-3 px-2 border-r border-gray-200 dark:border-gray-700">Color</th>
                <th className="py-3 px-2 text-right border-r border-gray-200 dark:border-gray-700">Cut Size</th>
                <th className="py-3 px-2 text-center border-r border-gray-200 dark:border-gray-700 bg-blue-50/50 dark:bg-blue-950/20">Plan</th>
                <th className="py-3 px-2 text-center border-r border-gray-200 dark:border-gray-700 bg-emerald-50/50 dark:bg-emerald-950/20">Good (Pcs)</th>
                <th className="py-3 px-2 text-right border-r border-gray-200 dark:border-gray-700 bg-emerald-50/50 dark:bg-emerald-950/20">Good (Kg)</th>
                <th className="py-3 px-2 text-center border-r border-gray-200 dark:border-gray-700 bg-teal-50/50 dark:bg-teal-950/20">Bar (L/Qty)</th>
                <th className="py-3 px-2 text-right border-r border-gray-200 dark:border-gray-700 bg-teal-50/50 dark:bg-teal-950/20">Bar (Kg)</th>
                <th className="py-3 px-2 text-center border-r border-gray-200 dark:border-gray-700 bg-rose-50/50 dark:bg-rose-950/20">Defect</th>
                <th className="py-3 px-2 text-right border-r border-gray-200 dark:border-gray-700 bg-rose-50/50 dark:bg-rose-950/20">Defect (Kg)</th>
                <th className="py-3 px-2 text-right border-r border-gray-200 dark:border-gray-700">Waste (Kg)</th>
                <th className="py-3 px-2 text-center border-r border-gray-200 dark:border-gray-700">NIK</th>
                <th className="py-3 px-3 border-r border-gray-200 dark:border-gray-700">Remark</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs font-mono">
              {loading ? (
                <tr>
                  <td colSpan="20" className="text-center py-12 text-gray-400 font-sans">
                    Memuat data hasil pemotongan...
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan="20" className="text-center py-12 text-gray-400 font-sans">
                    Tidak ada hasil pemotongan yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                results.map((row, idx) => {
                  const isDone = row.status === 'COMPLETE';
                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors ${
                        isDone ? 'bg-white dark:bg-gray-800' : 'bg-amber-50/20 dark:bg-amber-950/10'
                      }`}
                    >
                      <td className="py-2.5 px-2 text-center text-gray-400 font-bold border-r border-gray-100 dark:border-gray-700">{idx + 1}</td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300 border-r border-gray-100 dark:border-gray-700 whitespace-nowrap">{row.updated_at?.slice(0, 16) || '-'}</td>
                      <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400 border-r border-gray-100 dark:border-gray-700">{row.lot_no}</td>
                      <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 border-r border-gray-100 dark:border-gray-700">{row.project_no}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-gray-700 dark:text-gray-300 border-r border-gray-100 dark:border-gray-700">{row.item_no}</td>
                      <td className="py-2.5 px-2 text-center text-gray-600 dark:text-gray-300 border-r border-gray-100 dark:border-gray-700">{row.line}</td>
                      <td className="py-2.5 px-3 font-bold text-gray-900 dark:text-white border-r border-gray-100 dark:border-gray-700">{row.profile_no}</td>
                      <td className="py-2.5 px-2 text-center text-amber-600 font-bold border-r border-gray-100 dark:border-gray-700">{row.color}</td>
                      <td className="py-2.5 px-2 text-right border-r border-gray-100 dark:border-gray-700">{row.cut_size?.toFixed(1)}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-blue-700 dark:text-blue-300 border-r border-gray-100 dark:border-gray-700">{row.plan_qty}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400 border-r border-gray-100 dark:border-gray-700">{row.good_qty}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-emerald-600 dark:text-emerald-400 border-r border-gray-100 dark:border-gray-700">{row.good_weight?.toFixed(3)}</td>
                      <td className="py-2.5 px-2 text-center border-r border-gray-100 dark:border-gray-700">
                        {row.bar_length > 0 ? `${row.bar_length} / ${row.bar_qty}` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right border-r border-gray-100 dark:border-gray-700">{row.bar_weight?.toFixed(3)}</td>
                      <td className="py-2.5 px-2 text-center text-rose-600 font-bold border-r border-gray-100 dark:border-gray-700">
                        {row.defect_qty > 0 ? `${row.defect_length}mm (${row.defect_qty})` : '0'}
                      </td>
                      <td className="py-2.5 px-2 text-right text-rose-600 font-bold border-r border-gray-100 dark:border-gray-700">{row.defect_weight?.toFixed(3)}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-gray-600 dark:text-gray-300 border-r border-gray-100 dark:border-gray-700">{row.waste_weight?.toFixed(3)}</td>
                      <td className="py-2.5 px-2 text-center text-gray-500 font-sans text-[11px] border-r border-gray-100 dark:border-gray-700">{row.operator_nik}</td>
                      <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 font-sans text-[11px] border-r border-gray-100 dark:border-gray-700 truncate max-w-[130px]">{row.remark || '-'}</td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isDone 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {isDone ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                          {row.status}
                        </span>
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
  );
}