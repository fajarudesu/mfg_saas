import React, { useState, useRef, useEffect } from 'react';
import { 
  Package, 
  Play, 
  ScanLine, 
  History, 
  RotateCw, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Lock, 
  Unlock,
  Scale,
  Keyboard
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

// Ekstraksi Lot Cerdas: mendukung barcode gabungan profil + lot serta panjang standar 26 karakter
const extractLotNo = (rawBarcode) => {
  const clean = (rawBarcode || '').trim().toUpperCase();
  if (!clean) return '';

  // 1. Jika barcode mengandung spasi (contoh: "A01API0P5L4L4 261019A089001")
  const tokens = clean.split(/\s+/);
  if (tokens.length > 1) {
    return tokens[tokens.length - 1];
  }

  // 2. Jika 26 karakter tanpa spasi
  if (clean.length === 26) {
    return clean.substring(13, 23);
  }

  // 3. Fallback pencocokan pola lot
  const match = clean.match(/[0-9]{6}[A-Z][0-9]+/);
  if (match) {
    return match[0];
  }

  return clean;
};

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('saiyamfg_current_user')) || { nik: 'UNKNOWN' };
  } catch (err) {
    return { nik: 'UNKNOWN' };
  }
};

// Hitung bobot per baris secara akurat & memisahkan bobot Plan murni dengan bobot Good
const calculateRowWeights = (item) => {
  const cutSize = Number(item.cut_size) || 0;
  const planQty = Number(item.plan_qty) || 1;
  const goodQty = Number(item.good_qty) || 0;

  const barLen = parseFloat(item.bar_length) || 5900;
  const barQty = parseInt(item.bar_qty, 10) || 0;
  let unitWgt = Number(item.bar_unit_wgt) || 0;

  // Rasio bobot per milimeter profil
  let unitPerMm = 0;
  if (unitWgt > 0 && barLen > 0) {
    unitPerMm = unitWgt / barLen;
  } else if (Number(item.plan_weight) > 0 && cutSize > 0 && planQty > 0) {
    unitPerMm = Number(item.plan_weight) / (planQty * cutSize);
    unitWgt = +(unitPerMm * barLen).toFixed(3);
  }

  // 1. Bobot Rencana Murni (Untuk seluruh Plan Qty, misal 46 pcs)
  let planWeight = 0.0;
  if (unitPerMm > 0 && cutSize > 0 && planQty > 0) {
    planWeight = +(planQty * cutSize * unitPerMm).toFixed(3);
  } else {
    planWeight = Number(item.plan_weight) || 0.0;
  }

  // 2. Bobot Bar Out
  const barWgt = barLen > 0 && barQty > 0 ? +(barQty * unitWgt).toFixed(3) : 0.0;

  // 3. Bobot Good (Hanya untuk Good Qty yang dipotong aktual)
  const goodLen = parseFloat(item.good_length) || cutSize;
  let goodWgt = 0.0;
  if (item.good_weight !== undefined && item.good_weight !== null && item.good_weight !== '' && Number(item.good_weight) > 0) {
    goodWgt = parseFloat(item.good_weight);
  } else if (unitPerMm > 0 && goodLen > 0 && goodQty > 0) {
    goodWgt = +(goodLen * goodQty * unitPerMm).toFixed(3);
  }

  // 4. Bobot Defect
  const defLen = parseFloat(item.defect_length) || cutSize;
  const defQty = parseInt(item.defect_qty, 10) || 0;
  const defWgt = (item.defect_weight !== undefined && item.defect_weight !== null && item.defect_weight !== '' && Number(item.defect_weight) > 0)
    ? parseFloat(item.defect_weight)
    : (unitPerMm > 0 && defLen > 0 && defQty > 0 ? +(defLen * defQty * unitPerMm).toFixed(3) : 0.0);

  // 5. Bobot Waste = Bar Out - (Good + Defect)
  const wasteWgt = barWgt > 0 ? +(Math.max(0, barWgt - (goodWgt + defWgt))).toFixed(3) : 0.0;
  const remainQty = planQty - goodQty;

  return {
    plan_weight: planWeight,
    bar_unit_wgt: unitWgt,
    bar_weight: barWgt,
    good_weight: goodWgt,
    defect_weight: defWgt,
    waste_weight: wasteWgt,
    remain_qty: remainQty,
    input_qty: goodQty,
    cutting_weight: planWeight
  };
};

export default function CuttingInput() {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [manualLotInput, setManualLotInput] = useState('');
  const [scannedItems, setScannedItems] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('scan');
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [isForceUnlocked, setIsForceUnlocked] = useState(false);

  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'scan' && inputRef.current) {
      inputRef.current.focus();
    } else if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const user = getCurrentUser();
    try {
      const res = await axios.get(`/api/cutting/input-history?limit=100&operator_nik=${user.nik}`);
      if (res.data?.data) {
        setHistoryList(res.data.data);
      }
    } catch (err) {
      console.error('Gagal mengambil history input:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Logika pencarian data lot dari Postgres (data aktual) atau DB2 (data baru)
  const executeLotLookup = async (targetLotRaw) => {
    const lotNo = extractLotNo(targetLotRaw);
    if (!lotNo) {
      setFeedbackMsg({ type: 'error', text: 'Nomor Lot tidak boleh kosong!' });
      return;
    }

    const isAlreadyScanned = scannedItems.some(
      (item) => (item.lot_no || '').toUpperCase() === lotNo.toUpperCase()
    );

    if (isAlreadyScanned) {
      setFeedbackMsg({ type: 'info', text: `Lot No '${lotNo}' sudah aktif di tabel pemotongan.` });
      setBarcodeInput('');
      setManualLotInput('');
      return;
    }

    setIsSearching(true);
    setFeedbackMsg(null);
    setIsForceUnlocked(false);

    try {
      const res = await axios.get(`/api/cutting/lookup-lot/${encodeURIComponent(lotNo)}`);
      
      if (!res.data || res.data.status === 'not_found' || !res.data.data || res.data.data.length === 0) {
        setFeedbackMsg({ type: 'error', text: `Lot No '${lotNo}' tidak ditemukan di Database.` });
        return;
      }

      const isFromActualDB = res.data.source === 'actual_db';
      const isLotFullyCompleted = Boolean(res.data.is_completed);

      const mappedItems = res.data.data.map((row) => {
        const planQty = Number(row.plan_qty) || 0;
        const cutSize = Number(row.cut_size) || 0;
        const goodQty = (row.good_qty !== undefined && row.good_qty !== null && row.good_qty !== '')
          ? Number(row.good_qty) : Number(row.input_qty) || 0;
        const barQty = Number(row.bar_qty) || 0;
        const barLength = row.bar_length ? String(row.bar_length) : '5900';
        const remainQty = planQty - goodQty;
        const barUnitWgt = Number(row.bar_unit_wgt) || 0.0;

        // Bobot Plan 46 pcs murni dihitung dari plan_qty * cut_size * unitPerMm
        const barLenFloat = parseFloat(barLength) || 5900;
        const unitPerMm = (barUnitWgt > 0 && barLenFloat > 0) ? (barUnitWgt / barLenFloat) : 0;
        const rowPlanWeight = unitPerMm > 0 
          ? +(planQty * cutSize * unitPerMm).toFixed(3)
          : (Number(row.plan_weight) || Number(row.cutting_weight) || 0.0);

        const isRowLocked = !isForceUnlocked && (
          isFromActualDB && barQty > 0 && remainQty <= 0 && goodQty >= planQty
        );

        let initialItem = {
          id: `${row.lot_no}-${row.item_no}-${row.profile_no}-${row.line}-${cutSize}-${Math.random()}`,
          project_no: row.project_no || '-',
          lot_no: row.lot_no || '-',
          item_no: row.item_no || '-',
          color: row.color || '-',
          thick: row.thick || '-',
          profile_no: row.profile_no || '-',
          line: row.line || 'M0',
          cut_size: cutSize,
          plan_qty: planQty,

          bar_length: barLength,
          bar_qty: barQty,
          bar_weight: Number(row.bar_weight) || 0.0,

          good_length: Number(row.good_length) > 0 ? Number(row.good_length) : cutSize,
          good_qty: goodQty,
          good_weight: Number(row.good_weight) || 0.0,
          plan_weight: rowPlanWeight,

          defect_length: Number(row.defect_length) > 0 ? Number(row.defect_length) : cutSize,
          defect_qty: Number(row.defect_qty) || 0,
          defect_weight: Number(row.defect_weight) || 0.0,

          waste_weight: Number(row.waste_weight) || 0.0,
          cutting_times: Number(row.cutting_times) || 1,
          remark: row.remark || '',

          input_qty: goodQty,
          remain_qty: remainQty,
          cutting_weight: rowPlanWeight,
          length_variants: row.length_variants || [],
          bar_unit_wgt: barUnitWgt,
          effctv_siz: Number(row.effctv_siz) || 0.0,
          updated_at: row.updated_at || '',
          is_locked: isRowLocked
        };

        const autoWeights = calculateRowWeights(initialItem);
        return { ...initialItem, ...autoWeights };
      });

      setScannedItems((prev) => {
        const filteredPrev = prev.filter(p => (p.lot_no || '').toUpperCase() !== lotNo.toUpperCase());
        const combined = [...mappedItems, ...filteredPrev];
        return combined.sort((a, b) => {
          const lineCompare = (a.line || '').localeCompare(b.line || '');
          if (lineCompare !== 0) return lineCompare;
          return (a.profile_no || '').localeCompare(b.profile_no || '');
        });
      });

      setBarcodeInput('');
      setManualLotInput('');
      
      if (isLotFullyCompleted) {
        setFeedbackMsg({ type: 'info', text: `Lot '${lotNo}' telah selesai dipotong (COMPLETE). Klik 'Buka Kunci' jika ingin revisi.` });
      } else if (isFromActualDB) {
        setFeedbackMsg({ type: 'info', text: `[DATA AKTUAL] Lot '${lotNo}' dimuat dari PostgreSQL. Lanjutkan sisa pemotongan yang belum selesai.` });
      } else {
        setFeedbackMsg({ type: 'success', text: `[DATA BARU] Memuat ${mappedItems.length} baris pemotongan dari DB2.` });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.detail || err.message });
    } finally {
      setIsSearching(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleScanKeyDown = (e) => {
    if (e.key === 'Enter' && barcodeInput.trim() !== '') {
      e.preventDefault();
      executeLotLookup(barcodeInput);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualLotInput.trim() !== '') {
      executeLotLookup(manualLotInput);
    }
  };

  const handleItemChange = (id, field, value) => {
    setScannedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (item.is_locked && !isForceUnlocked) return item;

          let updated = { ...item, [field]: value };

          if (field === 'bar_length') {
            const lenNum = parseFloat(value) || 0;
            const matched = (item.length_variants || []).find((v) => Math.abs(Number(v.length) - lenNum) < 1);
            if (matched) {
              updated.bar_unit_wgt = Number(matched.unit_weight);
            }
            updated.effctv_siz = lenNum;
          }

          const calculated = calculateRowWeights(updated);
          return { ...updated, ...calculated };
        }
        return item;
      })
    );
  };

  const handleClearAll = () => {
    if (window.confirm('Kosongkan antrean scan?')) {
      setScannedItems([]);
      setFeedbackMsg(null);
      setIsForceUnlocked(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const handleProcessBatch = async () => {
    if (scannedItems.length === 0 || isSubmitting) return;

    const itemsToSave = scannedItems.filter(item => !item.is_locked || isForceUnlocked);
    if (itemsToSave.length === 0) {
      alert('Semua baris dalam keadaan terkunci. Gunakan tombol "Buka Kunci untuk Edit" jika ingin melakukan revisi.');
      return;
    }

    for (let i = 0; i < itemsToSave.length; i++) {
      const it = itemsToSave[i];
      const hasGood = Number(it.good_qty) > 0;
      const hasBar = Number(it.bar_qty) > 0 && it.bar_length !== '';
      const defQty = Number(it.defect_qty) || 0;
      const defLen = Number(it.defect_length) || 0;

      if (hasGood && !hasBar) {
        alert(`[MANDATORY BAR OUT] Baris No ${i + 1} (Profil: ${it.profile_no}): Bar Out wajib diisi jika Good Qty > 0!`);
        return;
      }
      if (defQty > 0 && defLen <= 0) {
        alert(`[MANDATORY DEFECT] Baris No ${i + 1} (Profil: ${it.profile_no}): Defect Qty terisi (${defQty} pcs), Panjang Defect (mm) wajib diisi!`);
        return;
      }
    }

    setIsSubmitting(true);
    const user = getCurrentUser();

    const payload = itemsToSave.map((item) => ({
      PROJECT_NO: item.project_no,
      LOT_NO: item.lot_no,
      ITEM_NO: item.item_no,
      COLOR: item.color,
      THICK: item.thick,
      PROFILE_NO: item.profile_no,
      LINE: item.line,
      CUT_SIZE: item.cut_size,
      PLAN_QTY: item.plan_qty,
      INPUT_QTY: item.good_qty,
      REMAIN_QTY: item.remain_qty,
      CUTTING_WEIGHT: item.plan_weight, // Mengirim bobot plan 46 pcs murni
      OPERATOR_NIK: user.nik,
      BAR_LENGTH: item.bar_length || 0,
      BAR_QTY: item.bar_qty,
      BAR_WEIGHT: item.bar_weight,
      GOOD_LENGTH: item.good_length,
      GOOD_QTY: item.good_qty,
      GOOD_WEIGHT: item.good_weight,
      DEFECT_LENGTH: item.defect_length,
      DEFECT_QTY: item.defect_qty,
      DEFECT_WEIGHT: item.defect_weight,
      WASTE_WEIGHT: item.waste_weight,
      CUTTING_TIMES: item.cutting_times,
      REMARK: item.remark,
      BAR_UNIT_WGT: item.bar_unit_wgt,
      EFFCTV_SIZ: item.effctv_siz
    }));

    try {
      const res = await axios.post('/api/cutting/input-batch', { items: payload });
      alert(`Sukses! ${res.data.message}`);
      setScannedItems([]);
      setFeedbackMsg(null);
      setIsForceUnlocked(false);
      fetchHistory();
    } catch (err) {
      alert('Gagal simpan: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  // AKUMULASI TOTAL QTY
  const totalPlanQty = scannedItems.reduce((acc, curr) => acc + (Number(curr.plan_qty) || 0), 0);
  const totalGoodQty = scannedItems.reduce((acc, curr) => acc + (Number(curr.good_qty) || 0), 0);
  const totalDefectQty = scannedItems.reduce((acc, curr) => acc + (Number(curr.defect_qty) || 0), 0);
  const totalRemainQty = scannedItems.reduce((acc, curr) => acc + (Number(curr.remain_qty) || 0), 0);

  // AKUMULASI TOTAL KG
  // 1. Total Plan Kg murni menjumlahkan bobot seluruh Plan Qty (46 Pcs)
  const totalPlanWeight = scannedItems.reduce((acc, curr) => acc + (parseFloat(curr.plan_weight) || 0), 0);
  // 2. Total Good Kg murni menjumlahkan kolom merah (Good Weight aktual)
  const totalGoodWeight = scannedItems.reduce((acc, curr) => acc + (parseFloat(curr.good_weight) || 0), 0);
  const totalDefectWeight = scannedItems.reduce((acc, curr) => acc + (parseFloat(curr.defect_weight) || 0), 0);
  const totalWasteWeight = scannedItems.reduce((acc, curr) => acc + (parseFloat(curr.waste_weight) || 0), 0);

  const isAllComplete = scannedItems.length > 0 && 
    scannedItems.every((item) => Number(item.bar_qty) > 0 && item.bar_length !== '' && item.remain_qty <= 0);

  const hasEditableItems = isForceUnlocked || scannedItems.some((item) => !item.is_locked);

  const filteredHistory = historyList.filter((item) => {
    const q = searchFilter.toLowerCase();
    return (
      (item.lot_no || '').toLowerCase().includes(q) ||
      (item.item_no || '').toLowerCase().includes(q) ||
      (item.project_no || '').toLowerCase().includes(q) ||
      (item.profile_no || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col sm:flex-row justify-between pb-4 gap-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <DemaxCuttingIcon size={26} className="text-blue-600 dark:text-blue-400" />
            Cutting Input Aktual
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            Form Pemotongan: Input Bar Out, Actual Cutting Good/Defect, dan Akumulasi Berat Otomatis
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('scan')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'scan' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ScanLine size={15} className="inline mr-1" /> Scan Antrean ({scannedItems.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'history' ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <History size={15} className="inline mr-1" /> Riwayat Sesi Aktif
          </button>
        </div>
      </div>

      {activeTab === 'scan' && (
        <div className="space-y-4">
          {/* Dual Input Area: Scanner & Input Manual */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Input Barcode Scanner */}
            <div className="md:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <label className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2 block uppercase tracking-wider">
                1. Scan Barcode Lot No (Scanner)
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleScanKeyDown}
                  disabled={isSearching}
                  placeholder="Scan barcode (contoh: A01API0P5L4L4 261019A089001)..."
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl outline-none text-sm font-mono shadow-inner text-gray-800 dark:text-gray-100 disabled:opacity-60"
                  autoComplete="off"
                />
                <ScanLine className="absolute left-3.5 top-3 text-gray-400" size={18} />
              </div>
            </div>

            {/* 2. Input Manual Lot No */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
              <label className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <Keyboard size={15} /> 2. Input Manual Lot No
              </label>
              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={manualLotInput}
                  onChange={(e) => setManualLotInput(e.target.value)}
                  disabled={isSearching}
                  placeholder="Ketik LOT (misal: 261019A089)..."
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-blue-200 dark:border-blue-900 rounded-xl outline-none text-xs font-mono text-gray-800 dark:text-gray-100"
                />
                <button
                  type="submit"
                  disabled={isSearching || !manualLotInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all disabled:opacity-50"
                >
                  <Search size={14} /> Cari
                </button>
              </form>
            </div>
          </div>

          {/* Feedback Notifikasi */}
          {feedbackMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center justify-between font-medium border ${
                feedbackMsg.type === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
                  : feedbackMsg.type === 'info' ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedbackMsg.type === 'error' ? <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                  : feedbackMsg.type === 'info' ? <AlertCircle size={16} className="flex-shrink-0" />
                  : <CheckCircle2 size={16} className="flex-shrink-0" />
                }
                <span>{feedbackMsg.text}</span>
              </div>
              {!hasEditableItems && (
                <button
                  type="button"
                  onClick={() => setIsForceUnlocked(true)}
                  className="ml-3 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold flex items-center gap-1 text-[11px] transition-all shadow-sm"
                >
                  <Unlock size={12} /> Buka Kunci untuk Edit
                </button>
              )}
            </div>
          )}

          {/* Mini Cards (Akumulasi QTY & KG Lengkap) */}
          {scannedItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 font-mono">
              <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                <span className="text-[10px] text-gray-500 uppercase block font-sans">Total Plan</span>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{totalPlanQty} Pcs</span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-bold block mt-0.5">{totalPlanWeight.toFixed(3)} Kg</span>
              </div>
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 shadow-sm">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase block font-sans font-bold">Total Good</span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{totalGoodQty} Pcs</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-black block mt-0.5">{totalGoodWeight.toFixed(3)} Kg</span>
              </div>
              <div className="bg-rose-50/60 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-200 dark:border-rose-900 shadow-sm">
                <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase block font-sans font-bold">Total Defect</span>
                <span className="text-sm font-bold text-rose-700 dark:text-rose-300">{totalDefectQty} Pcs</span>
                <span className="text-xs text-rose-600 dark:text-rose-400 font-black block mt-0.5">{totalDefectWeight.toFixed(3)} Kg</span>
              </div>
              <div className="bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-900 shadow-sm">
                <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase block font-sans font-bold">Total Sisa</span>
                <span className={`text-sm font-bold ${totalRemainQty <= 0 ? 'text-emerald-600' : 'text-amber-700'}`}>{totalRemainQty} Pcs</span>
                <span className="text-[10px] text-gray-400 font-sans block mt-0.5">Sisa Potong</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800/80 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <span className="text-[10px] text-gray-500 uppercase block font-sans">Total Waste</span>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{totalWasteWeight.toFixed(3)} Kg</span>
                <span className="text-[10px] text-gray-400 font-sans block mt-0.5">Scrap / Buangan</span>
              </div>
              <div className={`p-3 rounded-xl border shadow-sm flex flex-col justify-center ${
                isAllComplete ? 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
              }`}>
                <span className="text-[10px] uppercase font-bold tracking-wider font-sans">Status Lot</span>
                <span className="text-xs font-black flex items-center gap-1 mt-0.5">
                  {isAllComplete ? <Lock size={13} /> : <Scale size={13} />}
                  {isAllComplete ? 'COMPLETE (LOCKED)' : 'PARTIAL (PROSES)'}
                </span>
              </div>
            </div>
          )}

          {/* Tabel Lembar Kerja Pemotongan */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap justify-between items-center gap-3 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2">
                <Package size={18} className="text-blue-600 dark:text-blue-400" />
                Lembar Kerja Pemotongan ({scannedItems.length} Baris)
              </h2>

              {scannedItems.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                    Total Good: <b className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">{totalGoodWeight.toFixed(3)} Kg</b>
                  </span>

                  {!hasEditableItems ? (
                    <button
                      onClick={() => setIsForceUnlocked(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow transition-all"
                    >
                      <Unlock size={14} />
                      <span>Buka Kunci untuk Edit</span>
                    </button>
                  ) : null}

                  <button onClick={handleClearAll} disabled={isSubmitting} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Kosongkan Antrean">
                    <Trash2 size={16} />
                  </button>

                  <button
                    onClick={handleProcessBatch}
                    disabled={isSubmitting || !hasEditableItems}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl shadow text-xs font-semibold transition-all ${
                      !hasEditableItems ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <Play size={14} />
                    <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Aktual'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1550px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-[11px] font-bold text-center select-none uppercase tracking-wider">
                    <th rowSpan={2} className="py-2.5 px-2 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 min-w-[40px]">No</th>
                    <th rowSpan={2} className="py-2.5 px-3 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Lot No</th>
                    <th rowSpan={2} className="py-2.5 px-2 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 min-w-[65px]">Item No</th>
                    <th rowSpan={2} className="py-2.5 px-2 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Line</th>
                    <th rowSpan={2} className="py-2.5 px-3 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Profile No</th>
                    <th rowSpan={2} className="py-2.5 px-2 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Color</th>
                    <th rowSpan={2} className="py-2.5 px-3 bg-gray-100 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Plan Size</th>
                    <th rowSpan={2} className="py-2.5 px-2 bg-blue-100 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 border-r border-gray-200 dark:border-gray-700">Plan Qty</th>

                    <th colSpan={3} className="py-1.5 px-2 bg-teal-200 text-teal-950 dark:bg-teal-900/60 border-r border-teal-300 dark:border-teal-800">
                      BAR OUT 
                    </th>
                    <th colSpan={3} className="py-1.5 px-2 bg-emerald-200 text-emerald-950 dark:bg-emerald-900/60 border-r border-emerald-300 dark:border-emerald-800">
                      PRODUCTION CUTTING (GOOD)
                    </th>
                    <th colSpan={3} className="py-1.5 px-2 bg-rose-600 text-white font-extrabold border-r border-rose-700">
                      PRODUCTION CUTTING (DEFECT)
                    </th>

                    <th rowSpan={2} className="py-2.5 px-2 bg-teal-200 text-teal-950 dark:bg-teal-900/60 border-r border-gray-200 dark:border-gray-700">WASTE (Kg)</th>
                    <th rowSpan={2} className="py-2.5 px-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700">TIMES</th>
                    <th rowSpan={2} className="py-2.5 px-3 bg-teal-200 text-teal-950 dark:bg-teal-900/60 border-r border-gray-200 dark:border-gray-700 min-w-[120px]">REMARK</th>
                    <th rowSpan={2} className="py-2.5 px-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">REMAIN</th>
                  </tr>

                  <tr className="border-b border-gray-200 dark:border-gray-700 text-[10px] text-center uppercase tracking-wider">
                    <th className="py-1 px-1.5 bg-teal-100 text-teal-900 dark:bg-teal-950/40 border-r border-gray-200 dark:border-gray-700">Length (mm) *</th>
                    <th className="py-1 px-1.5 bg-teal-100 text-teal-900 dark:bg-teal-950/40 border-r border-gray-200 dark:border-gray-700">Qty (Bar) *</th>
                    <th className="py-1 px-1.5 bg-gray-200 text-gray-700 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-700">Weight (Kg)</th>
                    <th className="py-1 px-1.5 bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 border-r border-gray-200 dark:border-gray-700">Length (mm)</th>
                    <th className="py-1 px-1.5 bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 border-r border-gray-200 dark:border-gray-700">Qty (Pcs)</th>
                    <th className="py-1 px-1.5 bg-emerald-200 text-emerald-950 font-black border-r border-gray-200 dark:border-gray-700">Weight (Kg)</th>
                    <th className="py-1 px-1.5 bg-rose-100 text-rose-950 dark:bg-rose-950/40 border-r border-gray-200 dark:border-gray-700">Length (mm)</th>
                    <th className="py-1 px-1.5 bg-rose-100 text-rose-950 dark:bg-rose-950/40 border-r border-gray-200 dark:border-gray-700">Qty (Pcs)</th>
                    <th className="py-1 px-1.5 bg-red-600 text-white font-black border-r border-gray-200 dark:border-gray-700">Weight (Kg)</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs font-mono">
                  {scannedItems.length === 0 ? (
                    <tr>
                      <td colSpan="20" className="text-center py-12 text-gray-400 dark:text-gray-500 font-sans">
                        Belum ada data Lot yang di-scan atau di-input manual.
                      </td>
                    </tr>
                  ) : (
                    scannedItems.map((item, idx) => {
                      const isLockedRow = item.is_locked && !isForceUnlocked;
                      const isRowComplete = item.remain_qty <= 0 && item.bar_qty > 0 && item.bar_length !== '';
                      const isBarOutMissing = Number(item.good_qty) > 0 && (!item.bar_length || Number(item.bar_qty) <= 0);

                      return (
                        <tr key={item.id} className={`transition-colors ${
                          isLockedRow ? 'bg-gray-100/60 dark:bg-gray-800/40 opacity-70'
                            : isRowComplete ? 'bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-100/30'
                            : isBarOutMissing ? 'bg-amber-50/40 dark:bg-amber-950/20'
                            : 'bg-white dark:bg-gray-800 hover:bg-blue-50/20'
                        }`}>
                          <td className="py-2 px-2 text-center text-gray-500 font-bold border-r border-gray-100 dark:border-gray-700">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-blue-600 dark:text-blue-400 border-r border-gray-100 dark:border-gray-700">{item.lot_no}</td>
                          <td className="py-2 px-2 text-center font-bold text-gray-700 dark:text-gray-300 border-r border-gray-100 dark:border-gray-700">{item.item_no || '-'}</td>
                          <td className="py-2 px-2 text-center text-gray-700 dark:text-gray-300 font-semibold border-r border-gray-100 dark:border-gray-700">{item.line}</td>
                          <td className="py-2 px-3 font-bold text-gray-900 dark:text-white border-r border-gray-100 dark:border-gray-700">{item.profile_no}</td>
                          <td className="py-2 px-2 text-center text-amber-600 font-bold border-r border-gray-100 dark:border-gray-700">{item.color}</td>
                          <td className="py-2 px-3 text-right text-gray-800 dark:text-gray-200 border-r border-gray-100 dark:border-gray-700">{item.cut_size.toFixed(1)}</td>
                          <td className="py-2 px-2 text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-950/20 border-r border-gray-100 dark:border-gray-700">{item.plan_qty}</td>

                          {/* BAR OUT LENGTH (Pilih Varian / Ketik Angka Bebas) */}
                          <td className={`p-1 border-r border-gray-100 dark:border-gray-700 ${isBarOutMissing ? 'bg-amber-100/60' : 'bg-teal-50/20 dark:bg-teal-950/10'}`}>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                disabled={isLockedRow}
                                value={item.bar_length || ''}
                                placeholder="mm"
                                onChange={(e) => handleItemChange(item.id, 'bar_length', e.target.value)}
                                className={`w-16 text-right px-1 py-1 text-xs border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-gray-200 dark:disabled:bg-gray-900 ${
                                  isBarOutMissing ? 'border-amber-500 ring-1 ring-amber-400' : 'border-teal-300 dark:border-teal-600'
                                }`}
                              />
                              {item.length_variants && item.length_variants.length > 0 && (
                                <select
                                  disabled={isLockedRow}
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) handleItemChange(item.id, 'bar_length', e.target.value);
                                  }}
                                  className="w-5 px-0 py-1 text-xs border border-teal-200 dark:border-teal-700 rounded bg-teal-50 dark:bg-teal-900 text-teal-800 dark:text-teal-200"
                                  title="Pilih varian standar"
                                >
                                  <option value="">▼</option>
                                  {item.length_variants.map((v, vIdx) => (
                                    <option key={vIdx} value={v.length}>{v.length}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </td>
                          <td className={`p-1 border-r border-gray-100 dark:border-gray-700 ${isBarOutMissing ? 'bg-amber-100/60' : 'bg-teal-50/20 dark:bg-teal-950/10'}`}>
                            <input
                              type="number"
                              min="0"
                              disabled={isLockedRow || !item.bar_length}
                              value={item.bar_qty || ''}
                              placeholder="0"
                              onChange={(e) => handleItemChange(item.id, 'bar_qty', e.target.value)}
                              className={`w-12 text-right px-1.5 py-1 text-xs border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-bold focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-gray-200 dark:disabled:bg-gray-900 ${
                                isBarOutMissing ? 'border-amber-500 ring-1 ring-amber-400' : 'border-gray-200 dark:border-gray-600'
                              }`}
                            />
                          </td>
                          <td className="py-2 px-2 text-right bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 font-bold border-r border-gray-100 dark:border-gray-700">
                            {Number(item.bar_weight || 0).toFixed(3)}
                          </td>

                          {/* GOOD CUTTING (Panjang default = Cut Size, Qty, dan Bobot Timbangan/Otomatis) */}
                          <td className="p-1 border-r border-gray-100 dark:border-gray-700 bg-emerald-50/20 dark:bg-emerald-950/10">
                            <input
                              type="number"
                              disabled={isLockedRow}
                              value={item.good_length ?? item.cut_size}
                              onChange={(e) => handleItemChange(item.id, 'good_length', e.target.value)}
                              className="w-16 text-right px-1.5 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-200 dark:disabled:bg-gray-900"
                            />
                          </td>
                          <td className="p-1 border-r border-gray-100 dark:border-gray-700 bg-emerald-50/20 dark:bg-emerald-950/10">
                            <input
                              type="number"
                              min="0"
                              disabled={isLockedRow}
                              value={item.good_qty ?? ''}
                              onChange={(e) => handleItemChange(item.id, 'good_qty', e.target.value)}
                              className="w-14 text-right px-1.5 py-1 text-xs border border-emerald-300 dark:border-emerald-600 rounded bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 font-extrabold focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-200 dark:disabled:bg-gray-900"
                            />
                          </td>
                          <td className="p-1 border-r border-gray-100 dark:border-gray-700 bg-emerald-50/30 dark:bg-emerald-950/20">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              disabled={isLockedRow}
                              placeholder="0.000"
                              value={item.good_weight ?? ''}
                              onChange={(e) => handleItemChange(item.id, 'good_weight', e.target.value)}
                              className="w-20 text-right px-1.5 py-1 text-xs border border-emerald-400 dark:border-emerald-600 rounded bg-white dark:bg-gray-700 text-emerald-800 dark:text-emerald-300 font-black focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-200 dark:disabled:bg-gray-900"
                            />
                          </td>

                          {/* DEFECT CUTTING */}
                          <td className="p-1 border-r border-gray-100 dark:border-gray-700 bg-rose-50/20 dark:bg-rose-950/10">
                            <input
                              type="number"
                              min="0"
                              disabled={isLockedRow}
                              value={item.defect_length ?? item.cut_size}
                              placeholder="0"
                              onChange={(e) => handleItemChange(item.id, 'defect_length', e.target.value)}
                              className={`w-16 text-right px-1.5 py-1 text-xs border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:bg-gray-200 dark:disabled:bg-gray-900 ${
                                Number(item.defect_qty) > 0 && !item.defect_length ? 'border-red-500 ring-1 ring-red-400' : 'border-gray-200 dark:border-gray-600'
                              }`}
                            />
                          </td>
                          <td className="p-1 border-r border-gray-100 dark:border-gray-700 bg-rose-50/20 dark:bg-rose-950/10">
                            <input
                              type="number"
                              min="0"
                              disabled={isLockedRow}
                              value={item.defect_qty || ''}
                              placeholder="0"
                              onChange={(e) => handleItemChange(item.id, 'defect_qty', e.target.value)}
                              className={`w-12 text-right px-1.5 py-1 text-xs border rounded bg-white dark:bg-gray-700 text-rose-700 dark:text-rose-300 font-extrabold focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:bg-gray-200 dark:disabled:bg-gray-900 ${
                                Number(item.defect_length) > 0 && !item.defect_qty ? 'border-red-500 ring-1 ring-red-400' : 'border-rose-300 dark:border-rose-600'
                              }`}
                            />
                          </td>
                          <td className="py-2 px-2 text-right bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-bold border-r border-gray-100 dark:border-gray-700">
                            {Number(item.defect_weight || 0).toFixed(3)}
                          </td>

                          {/* WASTE & LAIN-LAIN */}
                          <td className="py-2 px-2 text-right bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200 font-bold border-r border-gray-100 dark:border-gray-700">
                            {Number(item.waste_weight || 0).toFixed(3)}
                          </td>
                          <td className="p-1 border-r border-gray-100 dark:border-gray-700">
                            <input
                              type="number"
                              min="1"
                              disabled={isLockedRow}
                              value={item.cutting_times ?? 1}
                              onChange={(e) => handleItemChange(item.id, 'cutting_times', e.target.value)}
                              className="w-10 text-center px-1 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-900"
                            />
                          </td>
                          <td className="p-1 border-r border-gray-100 dark:border-gray-700">
                            <input
                              type="text"
                              disabled={isLockedRow}
                              placeholder="Keterangan..."
                              value={item.remark ?? ''}
                              onChange={(e) => handleItemChange(item.id, 'remark', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 disabled:bg-gray-200 dark:disabled:bg-gray-900"
                            />
                          </td>
                          <td className="py-2 px-2 text-center font-bold">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                                isLockedRow ? 'bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                  : isRowComplete ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {item.remain_qty <= 0 ? (
                                <span className="flex items-center gap-1 justify-center">{isLockedRow && <Lock size={10} />}{item.remain_qty} (OK)</span>
                              ) : (item.remain_qty)}
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
      )}

      {/* TAB 2: RIWAYAT INPUT */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <div className="flex justify-between items-center gap-3">
            <div className="relative w-80">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Cari Lot, Item, Project, Profile..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl outline-none text-gray-800 dark:text-gray-100"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
            </div>
            <button onClick={fetchHistory} disabled={loadingHistory} className="px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 flex items-center gap-1.5 transition-colors">
              <RotateCw size={14} className={loadingHistory ? 'animate-spin' : ''} />
              <span>Refresh Riwayat Sesi</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1300px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-[11px] font-bold text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/50 uppercase tracking-wider">
                  <th className="py-3 px-2 text-center">NO</th>
                  <th className="py-3 px-4">LOT NO</th>
                  <th className="py-3 px-3">ITEM NO</th>
                  <th className="py-3 px-3">PROJECT</th>
                  <th className="py-3 px-4">PROFILE</th>
                  <th className="py-3 px-2">LINE</th>
                  <th className="py-3 px-3 text-right">CUT SIZE</th>
                  <th className="py-3 px-2 text-center">PLAN</th>
                  <th className="py-3 px-2 text-center">INPUT</th>
                  <th className="py-3 px-2 text-center">REMAIN</th>
                  <th className="py-3 px-3 text-right">GOOD (Kg)</th>
                  <th className="py-3 px-3 text-right">DEFECT (Kg)</th>
                  <th className="py-3 px-3 text-right">WASTE (Kg)</th>
                  <th className="py-3 px-4">REMARK</th>
                  <th className="py-3 px-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs font-mono">
                {filteredHistory.length === 0 ? (
                  <tr><td colSpan="15" className="text-center py-10 text-gray-400 font-sans">Tidak ada riwayat input untuk sesi aktif ini.</td></tr>
                ) : (
                  filteredHistory.map((row, idx) => {
                    const isRowCompleted = Number(row.remain_qty) <= 0;
                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-3 px-2 text-center text-gray-400 font-bold">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-blue-600 dark:text-blue-400">{row.lot_no}</td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 font-bold">{row.item_no || '-'}</td>
                        <td className="py-3 px-3 text-gray-800 dark:text-gray-200">{row.project_no}</td>
                        <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">{row.profile_no}</td>
                        <td className="py-3 px-2 text-gray-600 dark:text-gray-300">{row.line}</td>
                        <td className="py-3 px-3 text-right">{row.cut_size}</td>
                        <td className="py-3 px-2 text-center text-gray-400">{row.plan_qty}</td>
                        <td className="py-3 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">{row.input_qty}</td>
                        <td className="py-3 px-2 text-center font-bold text-orange-500">{row.remain_qty}</td>
                        <td className="py-3 px-3 text-right text-emerald-600 font-bold">{row.good_weight || row.cutting_weight}</td>
                        <td className="py-3 px-3 text-right text-rose-600">{row.defect_weight || 0}</td>
                        <td className="py-3 px-3 text-right text-gray-500">{row.waste_weight || 0}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400 font-sans text-[11px]">{row.remark || '-'}</td>
                        <td className="py-3 px-4 font-sans">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${isRowCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {isRowCompleted ? 'COMPLETE' : 'PARTIAL'}
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
      )}
    </div>
  );
}