import React, { useState } from 'react';
import axios from 'axios';
import { Search, Save, RefreshCw, Plus, Trash2 } from 'lucide-react';

export default function BreakdownMasterUpdate() {
  const [bomId, setBomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('formula');
  
  // State 5 Tabel
  const [tablesData, setTablesData] = useState({
    mfg_mst: [],
    mfg_dtl: [],
    part_mst: [],
    part_dtl: [],
    formula: []
  });

  // Pelacak tabel mana saja yang dimodifikasi oleh user
  const [modifiedTabs, setModifiedTabs] = useState(new Set());

  // Search Data
  const handleSearch = async () => {
    if (!bomId.trim()) {
      alert("Masukkan BOM ID terlebih dahulu!");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`/api/breakdown-master-update/data/${bomId.trim()}`);
      setTablesData({
        mfg_mst: res.data.mfg_mst || [],
        mfg_dtl: res.data.mfg_dtl || [],
        part_mst: res.data.part_mst || [],
        part_dtl: res.data.part_dtl || [],
        formula: res.data.formula || []
      });
      setModifiedTabs(new Set()); // Reset status perubahan
    } catch (err) {
      alert("Gagal mengambil data: " + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Save Changes
  const handleSave = async () => {
    if (!bomId.trim()) return;

    if (modifiedTabs.size === 0) {
      alert("Tidak ada perubahan data yang perlu disimpan.");
      return;
    }

    setSaving(true);
    try {
      const modifiedArray = Array.from(modifiedTabs);
      const res = await axios.post(`/api/breakdown-master-update/save/${bomId.trim()}`, {
        ...tablesData,
        modified_tables: modifiedArray,
        user_name: "Fajar"
      });

      alert(res.data.message);
      setModifiedTabs(new Set()); // Reset status perubahan setelah berhasil disimpan
    } catch (err) {
      alert("Gagal menyimpan data: " + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Cell Edit Handler (Menandai tabel aktif sedang dimodifikasi)
  const handleCellChange = (tabKey, rowIndex, fieldKey, value) => {
    const updated = [...tablesData[tabKey]];
    updated[rowIndex][fieldKey] = value;
    setTablesData({ ...tablesData, [tabKey]: updated });
    
    // Tandai tabel ini memiliki perubahan
    setModifiedTabs(prev => new Set(prev).add(tabKey));
  };

  // Add Row
  const handleAddRow = (tabKey) => {
    const currentList = tablesData[tabKey];
    const template = currentList.length > 0 ? { ...currentList[0] } : { BOM_ID: bomId };
    Object.keys(template).forEach(k => {
      if (k !== 'BOM_ID') template[k] = '';
    });
    setTablesData({ ...tablesData, [tabKey]: [...currentList, template] });
    setModifiedTabs(prev => new Set(prev).add(tabKey));
  };

  // Delete Row
  const handleDeleteRow = (tabKey, index) => {
    const updated = tablesData[tabKey].filter((_, i) => i !== index);
    setTablesData({ ...tablesData, [tabKey]: updated });
    setModifiedTabs(prev => new Set(prev).add(tabKey));
  };

  const tabs = [
    { key: 'formula', label: '1. Master Formula' },
    { key: 'mfg_mst', label: '2. Mfg Master' },
    { key: 'mfg_dtl', label: '3. Mfg Detail' },
    { key: 'part_mst', label: '4. Part Master' },
    { key: 'part_dtl', label: '5. Part Detail' }
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Breakdown Master Update</h1>
          <p className="text-sm text-gray-500">Editor manual 5 tabel database Shiage berbasis BOM ID</p>
        </div>
      </div>

      {/* Toolbar Pencarian */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Masukkan BOM ID / Item No (contoh: 99991)..."
            value={bomId}
            onChange={(e) => setBomId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
          />
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
        >
          {loading ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />}
          Load BOM
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !bomId || modifiedTabs.size === 0}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
          Save Changes ({modifiedTabs.size})
        </button>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-200 mb-4 bg-white rounded-t-xl px-2 pt-2">
        {tabs.map(tab => {
          const isModified = modifiedTabs.has(tab.key);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 font-semibold text-sm rounded-t-lg transition-colors flex items-center gap-2 ${
                activeTab === tab.key 
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
              {isModified && (
                <span className="w-2 h-2 rounded-full bg-orange-500" title="Ada perubahan belum disimpan" />
              )}
              <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                {tablesData[tab.key]?.length || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Spreadsheet Grid Table */}
      <div className="bg-white rounded-b-xl border border-gray-200 shadow-sm overflow-hidden p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase">
            Editing Table: {activeTab.toUpperCase()} {modifiedTabs.has(activeTab) && <span className="text-orange-600 font-bold">(Edited)</span>}
          </span>
          <button
            onClick={() => handleAddRow(activeTab)}
            className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded font-medium text-gray-700"
          >
            <Plus size={14} /> Add Row
          </button>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          {tablesData[activeTab]?.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Tidak ada data untuk ditayangkan. Silakan masukkan BOM ID dan klik Load BOM.</div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10 font-bold border-b border-gray-300">
                <tr>
                  <th className="p-2 border border-gray-300 w-10 text-center">#</th>
                  {Object.keys(tablesData[activeTab][0] || {}).map(col => (
                    <th key={col} className="p-2 border border-gray-300 whitespace-nowrap bg-gray-100">{col}</th>
                  ))}
                  <th className="p-2 border border-gray-300 w-10 text-center">Act</th>
                </tr>
              </thead>
              <tbody>
                {tablesData[activeTab].map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-2 border border-gray-200 text-center text-gray-400">{rIdx + 1}</td>
                    {Object.keys(row).map(col => (
                      <td key={col} className="p-1 border border-gray-200">
                        <input
                          type="text"
                          value={row[col] ?? ''}
                          onChange={(e) => handleCellChange(activeTab, rIdx, col, e.target.value)}
                          className="w-full px-1.5 py-1 text-xs bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none rounded font-mono"
                        />
                      </td>
                    ))}
                    <td className="p-1 border border-gray-200 text-center">
                      <button 
                        onClick={() => handleDeleteRow(activeTab, rIdx)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}