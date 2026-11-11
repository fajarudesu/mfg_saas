import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Beaker, UploadCloud, Loader2, Search, FileSpreadsheet, 
  Settings, Wrench, ChevronLeft, Save, Plus, Filter, 
  CheckCircle2, AlertTriangle, Database, Download
} from 'lucide-react';

export default function BreakdownTesting() {
  const [viewMode, setViewMode] = useState('grid');
  const [savedLists, setSavedLists] = useState([]);
  const [currentData, setCurrentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyMismatches, setShowOnlyMismatches] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('breakdown_testing_data');
    if (saved) {
      try {
        setSavedLists(JSON.parse(saved));
      } catch (e) {
        console.error("Gagal membaca LocalStorage", e);
      }
    }
  }, []);

  const saveToLocalStorage = (newData) => {
    const updatedLists = [newData, ...savedLists];
    setSavedLists(updatedLists);
    localStorage.setItem('breakdown_testing_data', JSON.stringify(updatedLists));
    alert("Data berhasil disimpan!");
    setViewMode('grid');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/breakdown/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.status === 'success') {
        const rawData = response.data.data;
        const sheetName = response.data.sheet_name || 'Unknown';
        const elevationCode = response.data.elevation_code || '-';
        const stdW = response.data.standard_list_w || '';
        const stdH = response.data.standard_list_h || '';
        const combinedStdList = [stdW, stdH].filter(Boolean).join(' / ') || 'None';

        setCurrentData({
          id: Date.now().toString(),
          fileName: file.name,
          projectName: file.name.replace('.xlsx', '').split('_').pop() || 'Unknown Project',
          series: `${sheetName} • ${elevationCode}`,
          size: '1000 × 1200',
          stdList: combinedStdList,
          status: 'Generated',
          timestamp: new Date().toISOString(),
          data: rawData,
          isNew: true
        });

        setViewMode('detail');
        setShowOnlyMismatches(false);
      } else {
        alert("Gagal memproses file: " + response.data.message);
      }
    } catch (err) {
      console.error("Gagal mengupload file:", err);
      alert("Gagal terhubung ke server. Pastikan backend menyala.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleOpenDetail = (list) => {
    setCurrentData({ ...list, isNew: false });
    setShowOnlyMismatches(false);
    setViewMode('detail');
  };

  const handleExportExcel = async () => {
    try {
      const response = await axios.post('/api/breakdown/export', {
        project_name: currentData.projectName,
        file_name: currentData.fileName,
        data: currentData.data
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Comparison_${currentData.projectName}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export failed", err);
      alert("Gagal mendownload file Excel.");
    }
  };

  if (viewMode === 'grid') {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 space-y-8 transition-colors duration-200">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Compare Breakdown Lists</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Compare standard lists VS BC Auto Breakdown.</p>
          </div>

          <div>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden" 
              id="file-upload-bc"
            />
            <label 
              htmlFor="file-upload-bc"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-70 text-sm"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              {loading ? 'Processing...' : 'New Order'}
            </label>
          </div>
        </div>

        {savedLists.length === 0 && !loading && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-16 flex flex-col items-center justify-center text-center">
            <FileSpreadsheet size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-300 mb-2">No Breakdown Lists Found</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              Click the <b className="dark:text-gray-300">New Order</b> button above to upload an Excel file and save your first breakdown list.
            </p>
          </div>
        )}

        {savedLists.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedLists.map((list) => (
              <div 
                key={list.id}
                onClick={() => handleOpenDetail(list)}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-4 mb-5">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">{list.projectName}</h3>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">{list.series}</p>
                  </div>
                </div>
                <div className="bg-gray-50/80 dark:bg-gray-900/50 rounded-xl p-4 grid grid-cols-2 gap-4 mb-5 border border-transparent dark:border-gray-700/50">
                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Size (W×H)</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{list.size}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Std List</div>
                    <div className="text-sm font-bold text-blue-700 dark:text-blue-400">{list.stdList}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (viewMode === 'detail' && currentData) {
    const rawData = currentData.data || [];
    const totalItems = rawData.length;
    const matchCount = rawData.filter(i => i.status_compare !== 'MISMATCH' && !i.discrepancies?.includes('NOT_IN_DB')).length;
    const mismatchCount = rawData.filter(i => i.status_compare === 'MISMATCH').length;
    const dbNullCount = rawData.filter(i => i.discrepancies?.includes('NOT_IN_DB')).length;

    const filteredData = rawData.filter(item => {
      let textMatch = true;
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const desc = String(item.Description || '').toLowerCase();
        const fabNo = String(item.Fabrication_No || '').toLowerCase();
        const partNo = String(item.Part_No || '').toLowerCase();
        textMatch = desc.includes(query) || fabNo.includes(query) || partNo.includes(query);
      }
      let mismatchMatch = true;
      if (showOnlyMismatches) {
        mismatchMatch = item.status_compare === 'MISMATCH' || item.discrepancies?.includes('NOT_IN_DB');
      }
      return textMatch && mismatchMatch;
    });

    const mfgList = filteredData.filter(item => item.Category === 'MFG' && (item.Group === 'OUTER' || item.Group === 'INNER'));
    const partList = filteredData.filter(item => item.Category === 'PART');

    const DiffCell = ({ excelValue, dbValue, isDiff }) => {
      if (!isDiff) return <span>{excelValue || '-'}</span>;
      return (
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="line-through text-red-400 dark:text-red-300 text-[11px] font-medium leading-none">
            {excelValue || '-'}
          </span>
          <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm flex items-center gap-1 border border-red-200 dark:border-red-800">
            <Database size={10} /> {dbValue || 'null'}
          </span>
        </div>
      );
    };

    return (
      <div className="max-w-7xl mx-auto py-8 px-4 space-y-6 transition-colors duration-200">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setViewMode('grid')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Project: {currentData.projectName}
                {currentData.isNew && <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs px-2 py-0.5 rounded-full font-medium shadow-sm border border-orange-200 dark:border-orange-800/50">Unsaved</span>}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-0.5">File: {currentData.fileName}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowOnlyMismatches(!showOnlyMismatches)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                showOnlyMismatches 
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800' 
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
              }`}
            >
              <Filter size={16} /> 
              {showOnlyMismatches ? 'Showing Mismatches' : 'Filter Mismatches'}
            </button>

            <div className="flex items-center bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 w-full md:w-56">
              <Search size={16} className="text-gray-400 dark:text-gray-500 mr-2" />
              <input 
                type="text"
                placeholder="Search items..."
                className="bg-transparent border-none outline-none text-sm w-full text-gray-900 dark:text-gray-100"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {currentData.isNew && (
              <button 
                onClick={() => saveToLocalStorage(currentData)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm shadow-sm"
              >
                <Save size={16} /> Save Data
              </button>
            )}
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm shadow-sm"
            >
              <Download size={16} /> Export Excel
            </button>
          </div>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total Items</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalItems}</p>
            </div>
            <FileSpreadsheet className="text-gray-300 dark:text-gray-600" size={32} />
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-green-200 dark:border-green-900/50 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-green-600 dark:text-green-500 uppercase">Match in DB</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{matchCount}</p>
            </div>
            <CheckCircle2 className="text-green-200 dark:text-green-900" size={32} />
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-red-200 dark:border-red-900/50 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-red-600 dark:text-red-500 uppercase">Mismatches</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{mismatchCount}</p>
            </div>
            <AlertTriangle className="text-red-200 dark:text-red-900" size={32} />
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-300 dark:border-gray-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Not In DB (Null)</p>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{dbNullCount}</p>
            </div>
            <Database className="text-gray-300 dark:text-gray-600" size={32} />
          </div>
        </div>

        {/* MFG LIST TABLE */}
        <div className="space-y-3">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Settings className="text-blue-600 dark:text-blue-500" size={18} />
            Manufacturing List <span className="text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{mfgList.length} rows</span>
          </h3>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-blue-100 dark:border-blue-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[450px] custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-blue-600 dark:bg-blue-800 text-white sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-blue-700">Order No</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-blue-700">Item No</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase border-b border-blue-700">Description</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-blue-700">Group</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-blue-700">Unit Code</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase border-b border-blue-700">Fabrication No</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-blue-700">Process Code</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-blue-700">Length</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-blue-700">Color</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-blue-700">Qty</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase border-b border-blue-700">Remark</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase border-b border-blue-700">Remark 2</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-blue-700">Weight/M</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-blue-700">Weight/KG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {mfgList.length === 0 ? (
                    <tr><td colSpan="14" className="text-center py-8 text-gray-500 dark:text-gray-400 italic">No matching data found.</td></tr>
                  ) : mfgList.map((row, index) => {
                    const isMismatch = row.status_compare === 'MISMATCH';
                    const isNotInDB = row.discrepancies?.includes('NOT_IN_DB');
                    
                    const isLengthDiff = row.discrepancies?.includes('Length');
                    const isQtyDiff = row.discrepancies?.includes('Qty');
                    const isProcessCodeDiff = row.discrepancies?.includes('Process_Code');
                    const isColorDiff = row.discrepancies?.includes('Colour');
                    const isRemarkDiff = row.discrepancies?.includes('Remark');
                    const isWeightMDiff = row.discrepancies?.includes('Weight_M');
                    const isWeightKgDiff = row.discrepancies?.includes('Weight_kg');

                    return (
                      <tr key={index} className={isMismatch || isNotInDB ? "bg-red-50/70 hover:bg-red-100/80 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-colors" : "hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors"}>
                        <td className="px-5 py-3 text-center font-mono text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 font-semibold align-middle border-r border-gray-100 dark:border-gray-800">{row.Order_No || '-'}</td>
                        <td className="px-5 py-3 text-center font-mono text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 font-semibold align-middle border-r border-gray-100 dark:border-gray-800">{row.Item_No || '-'}</td>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-200 flex items-center gap-2">
                          {isNotInDB ? (
                            <span className="px-2 py-1 text-[10px] font-bold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded shadow-sm border border-gray-300 dark:border-gray-600">DB NULL</span>
                          ) : isMismatch ? (
                            <span className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded shadow-sm border border-red-200 dark:border-red-800">⚠️ MISMATCH</span>
                          ) : (
                            <span className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded shadow-sm border border-green-200 dark:border-green-800">✓ MATCH</span>
                          )}
                          {row.Description}
                        </td>
                        <td className="px-5 py-3 text-center text-gray-700 dark:text-gray-300 font-medium align-middle">{row.Group || '-'}</td>
                        <td className="px-5 py-3 text-center text-gray-600 dark:text-gray-400 align-middle">{row.Unit_Code || '-'}</td>
                        <td className="px-5 py-3 font-mono text-gray-600 dark:text-gray-400">{row.Fabrication_No}</td>
                        <td className={`px-5 py-3 text-center align-middle font-semibold ${isProcessCodeDiff ? 'bg-red-100/50 dark:bg-red-900/30' : 'text-indigo-600 dark:text-indigo-400'}`}>
                          <DiffCell excelValue={row.Process_Code} dbValue={row.db_reference?.process_code} isDiff={isProcessCodeDiff} />
                        </td>
                        <td className={`px-5 py-3 text-center align-middle ${isLengthDiff ? 'bg-red-100/50 dark:bg-red-900/30' : 'text-gray-700 dark:text-gray-300'}`}>
                           <DiffCell excelValue={row.Length} dbValue={row.db_reference?.length} isDiff={isLengthDiff} />
                        </td>
                        <td className={`px-5 py-3 text-center align-middle ${isColorDiff ? 'bg-red-100/50 dark:bg-red-900/30' : 'text-gray-600 dark:text-gray-400'}`}>
                           <DiffCell excelValue={row.Colour || row.Color} dbValue={row.db_reference?.color} isDiff={isColorDiff} />
                        </td>
                        <td className={`px-5 py-3 text-center align-middle font-bold ${isQtyDiff ? 'bg-red-100/50 dark:bg-red-900/30' : 'text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20'}`}>
                            <DiffCell excelValue={row.Qty} dbValue={row.db_reference?.qty} isDiff={isQtyDiff} />
                        </td>
                        <td className={`px-5 py-3 text-xs align-middle ${isRemarkDiff ? 'bg-red-100/50 dark:bg-red-900/30 whitespace-normal' : 'text-gray-500 dark:text-gray-400 truncate max-w-[150px]'}`}>
                           <DiffCell excelValue={row.Remark} dbValue={row.db_reference?.remark} isDiff={isRemarkDiff} />
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 align-middle truncate max-w-[150px]">{row.Remark_2 || '-'}</td>
                        <td className={`px-5 py-3 text-center align-middle ${isWeightMDiff ? 'bg-red-100/50 dark:bg-red-900/30' : 'text-gray-500 dark:text-gray-400'}`}>
                           <DiffCell excelValue={row.Weight_M} dbValue={row.db_reference?.weight_m} isDiff={isWeightMDiff} />
                        </td>
                        <td className={`px-5 py-3 text-center font-medium align-middle ${isWeightKgDiff ? 'bg-red-100/50 dark:bg-red-900/30' : 'text-gray-800 dark:text-gray-300'}`}>
                           <DiffCell excelValue={row.Weight_kg} dbValue={row.db_reference?.weight_kg} isDiff={isWeightKgDiff} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* PARTS LIST TABLE */}
        <div className="space-y-3">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Wrench className="text-amber-600 dark:text-amber-500" size={18} />
            Parts List <span className="text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{partList.length} rows</span>
          </h3>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-amber-100 dark:border-amber-900/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[450px] custom-scrollbar">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-amber-500 dark:bg-amber-700 text-white sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3 text-xs font-semibold uppercase border-b border-amber-600 dark:border-amber-800">Description</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-amber-600 dark:border-amber-800">Group</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-amber-600 dark:border-amber-800">Unit Code</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase border-b border-amber-600 dark:border-amber-800">Part No</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-amber-600 dark:border-amber-800">Length</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-amber-600 dark:border-amber-800">Colour</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-amber-600 dark:border-amber-800">Qty Unit</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase text-center border-b border-amber-600 dark:border-amber-800">Qty</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase border-b border-amber-600 dark:border-amber-800">Remark 1</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase border-b border-amber-600 dark:border-amber-800">Remark 2</th>
                    <th className="px-5 py-3 text-xs font-semibold uppercase font-bold text-center border-b border-amber-600 dark:border-amber-800">F/S</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {partList.length === 0 ? (
                    <tr><td colSpan="11" className="text-center py-8 text-gray-500 dark:text-gray-400 italic">No matching data found.</td></tr>
                  ) : partList.map((row, index) => {
                    const isMismatch = row.status_compare === 'MISMATCH';
                    const isNotInDB = row.discrepancies?.includes('NOT_IN_DB');
                    
                    const isGroupDiff = row.discrepancies?.includes('Group');
                    const isUnitCodeDiff = row.discrepancies?.includes('Unit_Code');
                    const isQtyDiff = row.discrepancies?.includes('Qty');
                    const isColourDiff = row.discrepancies?.includes('Colour');
                    const isRemarkDiff = row.discrepancies?.includes('Remark');
                    const isRemark2Diff = row.discrepancies?.includes('Remark_2');
                    const isFSDiff = row.discrepancies?.includes('FS');

                    return (
                      <tr key={index} className={isMismatch || isNotInDB ? "bg-red-50/70 hover:bg-red-100/60 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-colors" : "hover:bg-amber-50/30 dark:hover:bg-amber-900/10 transition-colors"}>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-200 flex items-center gap-2">
                          {isNotInDB ? (
                            <span className="px-2 py-1 text-[10px] font-bold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded shadow-sm border border-gray-300 dark:border-gray-600">DB NULL</span>
                          ) : isMismatch ? (
                            <span className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded shadow-sm border border-red-200 dark:border-red-800">⚠️ MISMATCH</span>
                          ) : (
                            <span className="px-2 py-1 text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded shadow-sm border border-green-200 dark:border-green-800">✓ MATCH</span>
                          )}
                          {row.Description}
                        </td>
                        <td className={`px-5 py-3 text-center align-middle font-medium ${isGroupDiff ? 'bg-red-100/50 dark:bg-red-900/30' : 'text-gray-700 dark:text-gray-300'}`}>
                           <DiffCell excelValue={row.Group} dbValue={row.db_reference?.group} isDiff={isGroupDiff} />
                        </td>
                        <td className={`px-5 py-3 text-center align-middle ${isUnitCodeDiff ? 'bg-red-100/50 dark:bg-red-900/30' : 'text-gray-600 dark:text-gray-400'}`}>
                           <DiffCell excelValue={row.Unit_Code} dbValue={row.db_reference?.unit_code} isDiff={isUnitCodeDiff} />
                        </td>
                        <td className="px-5 py-3 font-mono text-gray-600 dark:text-gray-400">{row.Part_No}</td>
                        <td className="px-5 py-3 text-center text-gray-700 dark:text-gray-300">{row.Length || '-'}</td>
                        <td className={`px-5 py-3 text-center align-middle ${isColourDiff ? 'bg-red-100/50 dark:bg-red-900/30' : 'text-gray-700 dark:text-gray-300'}`}>
                          <DiffCell excelValue={row.Colour} dbValue={row.db_reference?.colour} isDiff={isColourDiff} />
                        </td>
                        <td className="px-5 py-3 text-center text-gray-600 dark:text-gray-400 align-middle">{row.Qty_Unit || '-'}</td>
                        <td className={`px-5 py-3 text-center align-middle font-bold ${isQtyDiff ? 'bg-red-100/50 dark:bg-red-900/30' : 'text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20'}`}>
                        <DiffCell excelValue={row.Qty} dbValue={row.db_reference?.qty} isDiff={isQtyDiff} />
                        </td>
                        <td className={`px-5 py-3 text-xs align-middle ${isRemarkDiff ? 'bg-red-100/50 dark:bg-red-900/30 whitespace-normal' : 'text-gray-500 dark:text-gray-400 truncate max-w-[150px]'}`}>
                           <DiffCell excelValue={row.Remark} dbValue={row.db_reference?.remark} isDiff={isRemarkDiff} />
                        </td>
                        <td className={`px-5 py-3 text-xs align-middle ${isRemark2Diff ? 'bg-red-100/50 dark:bg-red-900/30 whitespace-normal' : 'text-gray-500 dark:text-gray-400 truncate max-w-[150px]'}`}>
                           <DiffCell excelValue={row.Remark_2} dbValue={row.db_reference?.remark_2} isDiff={isRemark2Diff} />
                        </td>
                        <td className={`px-5 py-3 text-center font-bold align-middle ${isFSDiff ? 'bg-red-100/50 dark:bg-red-900/30' : 'text-gray-900 dark:text-gray-100'}`}>
                           <DiffCell excelValue={row.FS} dbValue={row.db_reference?.fs} isDiff={isFSDiff} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}