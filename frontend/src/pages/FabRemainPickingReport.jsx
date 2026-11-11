import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Layers, RefreshCw, Search, Download, Hash, CheckCircle2, AlertCircle } from 'lucide-react';

export default function FabRemainPickingReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  // Panggilan API persis seperti report lainnya
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/reports/fab-remain-picking');
      if (response.data && response.data.status === 'success') {
        setData(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching fab remain picking report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // List unique Project No untuk Pilihan Dropdown Filter
  const projectOptions = useMemo(() => {
    const projects = data.map((item) => item.Project_No).filter(Boolean);
    return Array.from(new Set(projects)).sort();
  }, [data]);

  // Filter Data Berdasarkan Search & Project No
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const q = search.toLowerCase();
      const matchesSearch =
        (item.No && String(item.No).toLowerCase().includes(q)) ||
        (item.Item_Code && String(item.Item_Code).toLowerCase().includes(q)) ||
        (item.Description && String(item.Description).toLowerCase().includes(q));

      const matchesProject = projectFilter
        ? String(item.Project_No) === String(projectFilter)
        : true;

      return matchesSearch && matchesProject;
    });
  }, [data, search, projectFilter]);

  // Hitung Total Qty untuk Summary Cards
  const summaryTotals = useMemo(() => {
    return filteredData.reduce(
      (acc, row) => {
        const req = Number(row.Requirement_Qty) || 0;
        const act = Number(row.Actual_Transfer) || 0;
        acc.totalReq += req;
        acc.totalAct += act;
        acc.totalRemain += req - act;
        return acc;
      },
      { totalReq: 0, totalAct: 0, totalRemain: 0 }
    );
  }, [filteredData]);

  // Batasi Tampilan UI Maksimal 100 Row
  const displayedData = useMemo(() => {
    return filteredData.slice(0, 100);
  }, [filteredData]);

  // Fungsi Export ke CSV
  const handleDownloadCSV = () => {
    if (filteredData.length === 0) return;

    const headers = [
      'No MR',
      'AO Series',
      'Project No',
      'Product Type',
      'Item Code',
      'Description',
      'Prod Line',
      'Location Code',
      'Bin Code',
      'Requirement Qty',
      'Actual Transfer',
      'Sisa Qty',
    ];

    const rows = filteredData.map((row) => [
      `"${row.No || ''}"`,
      `"${row.AO_Series || ''}"`,
      `"${row.Project_No || ''}"`,
      `"${row.Product_Type_Name || ''}"`,
      `"${row.Item_Code || ''}"`,
      `"${(row.Description || '').replace(/"/g, '""')}"`,
      `"${row.Prod_Line_After_BD || ''}"`,
      `"${row.Location_Code || ''}"`,
      `"${row.Bin_Code || ''}"`,
      row.Requirement_Qty || 0,
      row.Actual_Transfer || 0,
      (Number(row.Requirement_Qty) || 0) - (Number(row.Actual_Transfer) || 0),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Fab_Remain_Picking_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Layers className="text-blue-600" size={24} />
            Fab Remain Picking Profile
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Laporan sisa requirement picking fabrikasi yang belum ditransfer penuh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Filter Project No */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
          >
            <option value="">Semua Project No</option>
            {projectOptions.map((proj, idx) => (
              <option key={idx} value={proj}>
                {proj}
              </option>
            ))}
          </select>

          {/* Search Bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Cari No MR, Item, Description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Download CSV */}
          <button
            onClick={handleDownloadCSV}
            disabled={filteredData.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <Download size={16} />
            Export CSV
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS QTY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Requirement Qty
            </p>
            <p className="text-2xl font-extrabold text-blue-600 mt-1">
              {summaryTotals.totalReq.toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Hash size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Actual Transfer
            </p>
            <p className="text-2xl font-extrabold text-green-600 mt-1">
              {summaryTotals.totalAct.toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total Sisa Qty
            </p>
            <p className="text-2xl font-extrabold text-red-600 mt-1">
              {summaryTotals.totalRemain.toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
            <AlertCircle size={20} />
          </div>
        </div>
      </div>

      {/* TABLE DATA */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex justify-between items-center">
          <span className="text-xs text-gray-500 font-medium">
            Menampilkan <span className="font-bold text-gray-800">{displayedData.length}</span> dari{' '}
            <span className="font-bold text-gray-800">{filteredData.length}</span> data 
          </span>
        </div>

        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 shadow-sm uppercase tracking-wider">
              <tr>
                <th className="p-3 border-b">No MR</th>
                <th className="p-3 border-b">Project No</th>
                <th className="p-3 border-b">Product Type</th>
                <th className="p-3 border-b">Item Code</th>
                <th className="p-3 border-b">Description</th>
                <th className="p-3 border-b">Prod Line</th>
                <th className="p-3 border-b">Loc / Bin</th>
                <th className="p-3 border-b text-right">Req Qty</th>
                <th className="p-3 border-b text-right">Actual Transfer</th>
                <th className="p-3 border-b text-right">Sisa Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center py-8 text-gray-400">
                    Memuat data report...
                  </td>
                </tr>
              ) : displayedData.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-8 text-gray-400">
                    Tidak ada data remain picking.
                  </td>
                </tr>
              ) : (
                displayedData.map((row, idx) => {
                  const reqQty = Number(row.Requirement_Qty) || 0;
                  const actTransfer = Number(row.Actual_Transfer) || 0;
                  const remainQty = reqQty - actTransfer;

                  return (
                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                      <td className="p-3 font-medium text-blue-600">{row.No || '-'}</td>
                      <td className="p-3 font-semibold">{row.Project_No || '-'}</td>
                      <td className="p-3">{row.Product_Type_Name || '-'}</td>
                      <td className="p-3 font-semibold">{row.Item_Code || '-'}</td>
                      <td className="p-3 max-w-xs truncate" title={row.Description}>
                        {row.Description || '-'}
                      </td>
                      <td className="p-3">{row.Prod_Line_After_BD || '-'}</td>
                      <td className="p-3">{`${row.Location_Code || '-'} / ${row.Bin_Code || '-'}`}</td>
                      <td className="p-3 text-right font-medium">{reqQty.toLocaleString()}</td>
                      <td className="p-3 text-right text-green-600 font-medium">{actTransfer.toLocaleString()}</td>
                      <td className="p-3 text-right text-red-600 font-bold">{remainQty.toLocaleString()}</td>
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