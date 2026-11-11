import React, { useState, useRef, useEffect } from 'react';
import { 
  ScanLine, 
  Trash2, 
  Save, 
  Package, 
  Check, 
  Edit3, 
  Play, 
  Building2, 
  MapPin, 
  Calendar 
} from 'lucide-react';

export default function PartsInbound() {
  const [barcode, setBarcode] = useState('');
  const [scannedParts, setScannedParts] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const parseBarcodeData = (rawText) => {
    const cleanText = rawText.trim();
    const segments = cleanText.split(/\s+/);

    let prNo = '-';
    let color = '-';
    let partNo = '-';
    let qty = 1;
    let supplier = 'one';
    let inputDate = new Date().toISOString().split('T')[0];

    if (segments.length > 0) {
      const seg0 = segments[0];
      const qtyMatch = seg0.match(/000(\d{2,4})0000/);
      if (qtyMatch && qtyMatch[1]) {
        qty = parseInt(qtyMatch[1], 10) || 1;
      }
    }

    if (segments.length > 1) {
      prNo = segments[1];
    }

    if (segments.length > 2) {
      const partSegment = segments[2];
      color = partSegment.substring(0, 2);
      partNo = partSegment.substring(2);
    }

    if (segments.length > 3) {
      const dateStr = segments[3];
      if (dateStr.length === 8) {
        inputDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      }
    }

    return {
      id: Date.now() + Math.random(),
      rawCode: cleanText,
      partNo,
      color,
      prNo,
      qty,
      supplier,
      location: 'WH-MAIN',
      bin: 'A-01',
      inputDate,
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
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const toggleEditRow = (id) => {
    setScannedParts((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isEditing: !item.isEditing } : item
      )
    );
  };

  const removePart = (id) => {
    setScannedParts((prev) => prev.filter((item) => item.id !== id));
  };

  const handleProcessAll = () => {
    if (scannedParts.length === 0) return;
    const payload = scannedParts.map(({ isEditing, ...rest }) => rest);
    console.log('Memproses data parts inbound:', payload);
    alert(`Berjaya memproses ${payload.length} item parts ke pangkalan data!`);
    setScannedParts([]);
    if (inputRef.current) inputRef.current.focus();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ScanLine className="text-blue-600 dark:text-blue-400" size={28} />
            Inbound Parts Control
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            
          </p>
        </div>

        {scannedParts.length > 0 && (
          <button 
            onClick={handleProcessAll}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl shadow-md font-medium transition-all"
          >
            <Play size={18} />
            <span>Process All ({scannedParts.length})</span>
          </button>
        )}
      </div>

      <div className="my-6 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
        <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-2 uppercase tracking-wider">
          Scan Code Parts Inbound
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleScan}
            placeholder="Arahkan Scaner ke sini..."
            className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100 text-sm font-mono shadow-inner"
            autoComplete="off"
          />
          <ScanLine className="absolute left-3.5 top-3.5 text-gray-400" size={20} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
              Senarai Parts Inbound
            </h2>
          </div>
          <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full">
            Jumlah Kuantiti: {scannedParts.reduce((acc, p) => acc + (Number(p.qty) || 0), 0)}
          </span>
        </div>

        <div className="overflow-x-auto">
          {scannedParts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <ScanLine size={48} className="mb-3 opacity-20" />
              <p className="text-sm">Tiada data kod bar yang diimbas setakat ini.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50/30 dark:bg-gray-800/30">
                  <th className="py-3 px-4">Part No</th>
                  <th className="py-3 px-3">Color</th>
                  <th className="py-3 px-4">No PR</th>
                  <th className="py-3 px-3 w-24">Qty</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3 w-32">Location</th>
                  <th className="py-3 px-3 w-28">Bin</th>
                  <th className="py-3 px-4">Input Date</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {scannedParts.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {item.partNo}
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {item.color}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-gray-700 dark:text-gray-300 text-xs">
                      {item.prNo}
                    </td>

                    <td className="py-3 px-3">
                      {item.isEditing ? (
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleFieldChange(item.id, 'qty', parseInt(e.target.value, 10) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-blue-400 dark:border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none font-bold"
                          min="1"
                        />
                      ) : (
                        <span className="font-bold text-gray-900 dark:text-gray-100">
                          {item.qty}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-xs text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1.5">
                        <Building2 size={13} className="text-gray-400" />
                        {item.supplier}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {item.isEditing ? (
                        <input
                          type="text"
                          value={item.location}
                          onChange={(e) => handleFieldChange(item.id, 'location', e.target.value)}
                          className="w-28 px-2 py-1 text-xs border border-blue-400 dark:border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none uppercase"
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                          <MapPin size={11} />
                          {item.location}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {item.isEditing ? (
                        <input
                          type="text"
                          value={item.bin}
                          onChange={(e) => handleFieldChange(item.id, 'bin', e.target.value)}
                          className="w-24 px-2 py-1 text-xs border border-blue-400 dark:border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none uppercase"
                        />
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono">
                          {item.bin}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={13} className="text-gray-400" />
                        {item.inputDate}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => toggleEditRow(item.id)}
                          className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                            item.isEditing
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                          title={item.isEditing ? 'Simpan Baris' : 'Edit Baris'}
                        >
                          {item.isEditing ? <Check size={15} /> : <Edit3 size={15} />}
                        </button>

                        <button
                          onClick={() => removePart(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Padam Baris"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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