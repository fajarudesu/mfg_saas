import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Download, Layers, Filter, CheckCircle2, AlertCircle } from 'lucide-react';
import { getBacklogParts, downloadBacklogPartsExcel } from '../api';

export default function BacklogPartReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filter States
  const [showAdvanceFilter, setShowAdvanceFilter] = useState(false);
  const [search, setSearch] = useState('');
  const [projectNo, setProjectNo] = useState('');
  const [unfulfilledOnly, setUnfulfilledOnly] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getBacklogParts({
        search,
        projectNo,
        unfulfilledOnly,
        limit: 100, // Dibatasi 100 row saat refresh / load
        offset: 0
      });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load backlog parts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const handleDownload = () => {
    downloadBacklogPartsExcel(search, projectNo, unfulfilledOnly);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="text-blue-600" size={24} />
            Backlog Parts Report
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Menampilkan data part backlog (Default: Hanya yang Belum Terpenuhi / Limit 100 Row).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* TOMBOL ADVANCE FILTER TOGGLE */}
          <button
            onClick={() => setShowAdvanceFilter(!showAdvanceFilter)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors shadow-sm ${
              showAdvanceFilter ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter size={16} />
            Advance Filter
          </button>

          {/* TOMBOL DOWNLOAD FULL DATA */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            <Download size={16} />
            Download Excel (All Data)
          </button>

          {/* REFRESH */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 border border-gray-300 bg-white hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 shadow-sm transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-blue-600" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ADVANCE FILTER INTERFACE (TERSEMBUNYI / MUNCUL SAAT DIKLIK) */}
      {showAdvanceFilter && (
        <form onSubmit={handleFilterSubmit} className="bg-white p-5 rounded-xl border border-blue-200 shadow-md space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <Filter size={16} className="text-blue-600" /> Filter Parameter
            </h3>
            <span className="text-xs text-gray-400">Klik 'Apply Filter' untuk memperbarui tabel</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Search Keyword</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="No MR, Item Code, Part Name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Project No Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Project No</label>
              <input
                type="text"
                placeholder="Contoh: PRJ-2026-001"
                value={projectNo}
                onChange={(e) => setProjectNo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Checkbox Unfulfilled Only */}
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={unfulfilledOnly}
                  onChange={(e) => setUnfulfilledOnly(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                Tampilkan Hanya yang Belum Terpenuhi (Req &gt; Move)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setProjectNo('');
                setUnfulfilledOnly(true);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Reset Filter
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-sm"
            >
              Apply Filter
            </button>
          </div>
        </form>
      )}

      {/* INFORMASI TOTAL ROWS */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <div>
          Menampilkan <span className="font-bold text-gray-800">{data.length}</span> dari <span className="font-bold text-gray-800">{total}</span> total backlog part.
        </div>
        {unfulfilledOnly && (
          <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200 font-medium">
            Status: Filter Belum Terpenuhi (Req &gt; Move) Active
          </span>
        )}
      </div>

      {/* TABEL DATA */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">MR No.</th>
                <th className="px-4 py-3">Project No</th>
                <th className="px-4 py-3">Item Code / Part</th>
                <th className="px-4 py-3">Item Description</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3 text-center">F/S</th>
                <th className="px-4 py-3 text-right">Req Qty</th>
                <th className="px-4 py-3 text-right">Actual Move</th>
                <th className="px-4 py-3 text-right font-bold text-blue-700">Avail. to Take</th>
                <th className="px-4 py-3">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-sans">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    <RefreshCw className="animate-spin mx-auto mb-2 text-blue-600" size={24} />
                    Memuat data backlog parts...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    <CheckCircle2 className="mx-auto mb-2 text-green-500" size={32} />
                    Semua part telah terpenuhi atau data tidak ditemukan.
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-blue-600">{row.mr_no}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{row.project_no}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-900 font-bold">{row.item_code}</td>
                    <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate" title={row.item_name || row.description}>
                      {row.item_name || row.description}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 font-medium">{row.color || '-'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.fs_type === 'S' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                        {row.fs_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700">{row.requirement_qty?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-700">{row.actual_movement?.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-700 bg-blue-50/50">
                      {row.qty_available_to_take?.toLocaleString()} {row.uom}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate" title={row.remark || ''}>
                      {row.remark || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}