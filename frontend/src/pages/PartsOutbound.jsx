import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUpFromLine, 
  Trash2, 
  Package, 
  Check, 
  Edit3, 
  Play, 
  Building2, 
  MapPin, 
  Calendar,
  FileCheck2,
  ScanLine,
  History,
  RotateCw,
  Search,
  UserCheck
} from 'lucide-react';
import axios from 'axios';

export default function PartsOutbound() {
  const [barcode, setBarcode] = useState('');
  const [scannedParts, setScannedParts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'history'

  // State Riwayat
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const inputRef = useRef(null);

  // Ambil data riwayat dari backend
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await axios.get('/api/parts/outbound-history?limit=100');
      if (res.data && res.data.data) {
        setHistoryList(res.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil history outbound:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'scan' && inputRef.current) {
      inputRef.current.focus();
    } else if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const parseBarcodeData = (rawText) => {
    const cleanText = rawText.trim();
    const segments = cleanText.split(/\s+/);

    let poNo = '-';
    let color = '-';
    let partNo = '-';
    let qty = 1;
    let customer = 'L1';
    let outboundDate = new Date().toISOString().split('T')[0];

    if (segments.length > 0) {
      const seg0 = segments[0];
      const qtyMatch = seg0.match(/000(\d{2,4})0000/);
      if (qtyMatch && qtyMatch[1]) {
        qty = parseInt(qtyMatch[1], 10) || 1;
      }
    }

    if (segments.length > 1) {
      poNo = segments[1];
    }

    if (segments.length > 2) {
      const partSegment = segments[2];
      color = partSegment.substring(0, 2);
      partNo = partSegment.substring(2);
    }

    if (segments.length > 3) {
      const dateStr = segments[3];
      if (dateStr.length === 8) {
        outboundDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      }
    }

    return {
      id: Date.now() + Math.random(),
      rawCode: cleanText,
      partNo,
      color,
      poNo,
      qty,
      customer,
      location: 'WD02',
      bin: '01',
      outboundDate,
      isEditing: false
    };
  };

  const handleScan = (e) => {
    if (e.key === 'Enter' && barcode.trim() !== '') {
      e.preventDefault();
      const parsedData = parseBarcodeData(barcode);
      setScannedParts((prev) => [parsedData, ...prev]);
      setBarcode('');
    }
  };

  const handleFieldChange = (id, field, value) => {
    setScannedParts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const toggleEditRow = (id) => {
    setScannedParts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isEditing: !item.isEditing } : item))
    );
  };

  const removePart = (id) => {
    setScannedParts((prev) => prev.filter((item) => item.id !== id));
  };

  const handleProcessAll = async () => {
    if (scannedParts.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTimestamp = now.toISOString().replace('T', ' ').replace('Z', '');

    const savedUser = localStorage.getItem('saiyamfg_current_user');
    const userObj = savedUser ? JSON.parse(savedUser) : null;
    const userNik = userObj?.nik || '220506';

    const payload = scannedParts.map((item) => ({
      PRDT_PLNT_CD: 'API0P5',
      LST_INPT_DT: currentDate,
      ISS_DTL_NO: item.poNo || '',
      ISS_DT: item.outboundDate || currentDate,
      STOR_ISS_OUT_CD: '31',
      INPT_PROC_CD: '70',
      PAT_CLR_CD: item.color || '',
      ITM_NO: item.partNo || '',
      ITM_NO_SPEC: '',
      RACK_AREA_CD: item.location ? item.location.substring(0, 2) : 'WD',
      RACK_CD: item.location ? item.location.substring(2) : '02',
      RAC_LOCAT_CD: item.bin || '01',
      OT_STC_QTY: Number(item.qty) || 1,
      ISS_TO_CD: item.customer || 'L1',
      PRJ_PRFIX: '',
      PART_SHP_ID: '0',
      ISS_MEMO: `Outbound PO ${item.poNo || ''}`,
      INPT_ID: userNik,
      IVNT_UD_DV: '2',
      Z_RGST_DT: currentTimestamp,
      Z_RGSTER_CD: userNik,
      Z_UD_DT: currentTimestamp,
      Z_UD_PSN_CD: userNik
    }));

    try {
      const res = await axios.post('/api/parts/outbound-batch', { items: payload });
      alert(`Sukses! ${res.data.message || 'Data berhasil diproses ke database!'}`);
      setScannedParts([]);
      // Otomatis refresh riwayat
      fetchHistory();
      if (inputRef.current) inputRef.current.focus();
    } catch (err) {
      console.error('Error saat simpan data outbound:', err);
      alert('Gagal simpan ke database: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter pencarian data riwayat
  const filteredHistory = historyList.filter((item) => {
    const q = searchFilter.toLowerCase();
    return (
      (item.po_no || '').toLowerCase().includes(q) ||
      (item.part_no || '').toLowerCase().includes(q) ||
      (item.destination || '').toLowerCase().includes(q) ||
      (item.operator_nik || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full space-y-5">
      {/* Header Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowUpFromLine className="text-amber-600 dark:text-amber-400" size={26} />
            Outbound Parts Control
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1">
            Validasi pengeluaran barang dan pemantauan riwayat transaksi.
          </p>
        </div>

        {/* Tab Switcher: Scan vs Riwayat */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'scan'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ScanLine size={15} />
            <span>Scan Antrean ({scannedParts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-white dark:bg-gray-700 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <History size={15} />
            <span>Riwayat Outbound</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: TAB SCAN ANTREAN */}
      {activeTab === 'scan' && (
        <div className="space-y-5">
          {/* Input Scanner Barcode */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wider">
              Scan Barcode Outbound
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleScan}
                placeholder="Arahkan scanner ke sini..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-100 text-sm font-mono shadow-inner"
                autoComplete="off"
              />
              <ScanLine className="absolute left-3.5 top-3.5 text-gray-400" size={20} />
            </div>
          </div>

          {/* Antrean Data */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-amber-600 dark:text-amber-400" />
                <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                  Antrean Parts Siap Keluar
                </h2>
              </div>
              {scannedParts.length > 0 && (
                <button 
                  onClick={handleProcessAll}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white px-4 py-1.5 rounded-xl shadow font-medium transition-all text-xs"
                >
                  <Play size={14} />
                  <span>{isSubmitting ? 'Memproses...' : `Process Outbound (${scannedParts.length})`}</span>
                </button>
              )}
            </div>

            {scannedParts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                <ArrowUpFromLine size={48} className="mb-3 opacity-20" />
                <p className="text-sm">Belum ada barcode outbound yang di-scan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50/30 dark:bg-gray-800/30">
                      <th className="py-3 px-4">Part No</th>
                      <th className="py-3 px-3">Color</th>
                      <th className="py-3 px-4">PO NO</th>
                      <th className="py-3 px-3 w-24">Qty Out</th>
                      <th className="py-3 px-3">Destination</th>
                      <th className="py-3 px-3 w-28">Location</th>
                      <th className="py-3 px-3 w-24">Bin</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                    {scannedParts.map((item) => (
                      <tr key={item.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-900/10">
                        <td className="py-3 px-4 font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {item.partNo}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {item.color}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-800 dark:text-gray-200 text-xs font-semibold">
                          {item.poNo}
                        </td>
                        <td className="py-3 px-3">
                          {item.isEditing ? (
                            <input
                              type="number"
                              value={item.qty}
                              onChange={(e) => handleFieldChange(item.id, 'qty', parseInt(e.target.value, 10) || 0)}
                              className="w-16 px-1.5 py-1 text-sm border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              min="1"
                            />
                          ) : (
                            <span className="font-bold">{item.qty}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {item.isEditing ? (
                            <input
                              type="text"
                              value={item.customer}
                              onChange={(e) => handleFieldChange(item.id, 'customer', e.target.value)}
                              className="w-24 px-1.5 py-1 text-xs border rounded bg-white dark:bg-gray-700"
                            />
                          ) : (
                            item.customer
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs font-mono">{item.location}</td>
                        <td className="py-3 px-3 text-xs font-mono">{item.bin}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => toggleEditRow(item.id)}
                              className="p-1.5 text-gray-500 hover:text-amber-600 rounded"
                            >
                              {item.isEditing ? <Check size={15} /> : <Edit3 size={15} />}
                            </button>
                            <button
                              onClick={() => removePart(item.id)}
                              className="p-1.5 text-red-500 rounded"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: TAB RIWAYAT TRANSAKSI OUTBOUND */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden space-y-4 p-4 sm:p-5">
          {/* Baris Pencarian & Refresh */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Cari PO, Part No, Destination..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-gray-800 dark:text-gray-100"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
            </div>

            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors self-end sm:self-auto"
            >
              <RotateCw size={14} className={loadingHistory ? 'animate-spin' : ''} />
              <span>Refresh Data</span>
            </button>
          </div>

          {/* Tabel Riwayat */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="py-3 px-4">PO NO</th>
                  <th className="py-3 px-4">Part No</th>
                  <th className="py-3 px-3">Color</th>
                  <th className="py-3 px-3">Qty Out</th>
                  <th className="py-3 px-3">Destination</th>
                  <th className="py-3 px-3">Lokasi / Bin</th>
                  <th className="py-3 px-4">Waktu Transaksi</th>
                  <th className="py-3 px-3">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs">
                {loadingHistory ? (
                  <tr>
                    <td colSpan="8" className="text-center py-10 text-gray-400">
                      Memuat riwayat transaksi...
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-10 text-gray-400">
                      Tidak ada data riwayat yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <FileCheck2 size={14} className="text-amber-500" />
                        {row.po_no || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-amber-600 dark:text-amber-400">
                        {row.part_no}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {row.color}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-900 dark:text-gray-100">
                        {row.qty}
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-700 dark:text-gray-300">
                        {row.destination}
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-500 dark:text-gray-400">
                        {row.location}-{row.bin}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                        {row.created_at}
                      </td>
                      <td className="py-3 px-3 text-gray-500 dark:text-gray-400 font-mono">
                        {row.operator_nik}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}