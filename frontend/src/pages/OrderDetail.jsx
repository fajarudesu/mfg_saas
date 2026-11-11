import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Play, Download, Settings, Box, Layers, Loader2, UploadCloud } from 'lucide-react';
import { getOrder, updateOrder, generateOrder, checkMasterBomExists } from '../api';
import axios from 'axios'; 
import { useParams, useNavigate } from 'react-router-dom';

export default function OrderDetail({ orderId, onBack }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadingMaster, setUploadingMaster] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const data = await getOrder(orderId);
      setOrder(data);
      setFormData({
        width: (data.width && data.width > 0) ? data.width : 1000,
        height: (data.height && data.height > 0) ? data.height : 2000,
        qty: data.qty || 1,
        color: data.color || 'YK1N',
        glass_thickness: data.glass_thickness || 5,
        project_name: data.project_name || '',
        sheet_name: data.sheet_name || '',
        series: data.series || '',
        unit_code_outer: data.unit_code_outer || '',
        unit_code_inner: data.unit_code_inner || '',
        item_no: data.item_no || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrder(orderId, formData);
      await loadOrder();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadMaster = async () => {
    setUploadingMaster(true);
    try {
      await updateOrder(orderId, formData);

      const bomId = (formData.item_no || formData.project_name || orderId).toString().trim();

      const [checkMst, checkDtl, checkPartMst, checkPartDtl, checkFormula] = await Promise.all([
        checkMasterBomExists(bomId).catch(() => ({ exists: false, count: 0 })),
        axios.get(`/api/manufacturing-mstdtl-bom/check/${bomId}`).then(res => res.data).catch(() => ({ exists: false, count: 0 })),
        axios.get(`/api/partlist-mst-bom/check/${bomId}`).then(res => res.data).catch(() => ({ exists: false, count: 0 })),
        axios.get(`/api/partlist-mstdtl-bom/check/${bomId}`).then(res => res.data).catch(() => ({ exists: false, count: 0 })),
        axios.get(`/api/master-formula/check/${bomId}`).then(res => res.data).catch(() => ({ exists: false, count: 0 }))
      ]);

      const hasExistingData = (checkMst && checkMst.exists) || (checkDtl && checkDtl.exists) || (checkPartMst && checkPartMst.exists) || (checkPartDtl && checkPartDtl.exists) || (checkFormula && checkFormula.exists);
      const totalRows = (checkMst?.count || 0) + (checkDtl?.count || 0) + (checkPartMst?.count || 0) + (checkPartDtl?.count || 0) + (checkFormula?.count || 0);

      if (hasExistingData) {
        const isConfirmed = window.confirm(
          `Data dengan BOM ID "${bomId}" sudah ada di database SQL Server (${totalRows} baris total).\n\nApakah Anda yakin ingin memperbarui/mengganti (overwrite) data ini?`
        );

        if (!isConfirmed) {
          setUploadingMaster(false);
          return;
        }
      }

      const parsedData = order?.parsed_data || {};
      const outerListNo = parsedData.outer?.list_no || 'U9S-61026';
      const innerListNo = parsedData.inner?.list_no || 'MI0001';

      const outerMaterials = (parsedData.outer?.materials || []).map(item => ({
        Description: item.description, FabricationNo: item.fab_no || item.part_no, QtyUnit: item.qty || 1,
        Qty: item.cut_formula || item.qty || '', Cls_IOM: 'OUTER', BOM_SUB_ID: outerListNo
      }));

      const innerMaterials = (parsedData.inner?.materials || []).map(item => ({
        Description: item.description, FabricationNo: item.fab_no || item.part_no, QtyUnit: item.qty || 1,
        Qty: item.cut_formula || item.qty || '', Cls_IOM: 'INNER', BOM_SUB_ID: innerListNo
      }));

      const detailMaterials = [...outerMaterials, ...innerMaterials];

      const outerParts = (parsedData.outer?.parts || []).map(item => ({
        Description: item.description, PartNo: item.part_no || item.fab_no, QtyUnit: item.cut_formula || item.qty || 1,
        Colour: item.color || 'YW', Remark: item.remark1 || item.remarks || '', FS: item.at_site || '',
        Cls_IOM: 'OUTER', BOM_SUB_ID: outerListNo
      }));

      const innerParts = (parsedData.inner?.parts || []).map(item => ({
        Description: item.description, PartNo: item.part_no || item.fab_no, QtyUnit: item.cut_formula || item.qty || 1,
        Colour: item.color || 'YW', Remark: item.remark1 || item.remarks || '', FS: item.at_site || '',
        Cls_IOM: 'INNER', BOM_SUB_ID: innerListNo
      }));

      const detailParts = [...outerParts, ...innerParts];

      const [resMst] = await Promise.all([
        axios.post(`/api/manufacturing-mst-bom/upload/${orderId}`, { unit_code_outer: formData.unit_code_outer, unit_code_inner: formData.unit_code_inner, outer_list_no: outerListNo, inner_list_no: innerListNo }, { params: { item_no: formData.item_no } }),
        axios.post(`/api/manufacturing-mstdtl-bom/upload/${orderId}`, { items: detailMaterials, unit_code_outer: formData.unit_code_outer, unit_code_inner: formData.unit_code_inner }, { params: { item_no: formData.item_no } }),
        axios.post(`/api/partlist-mst-bom/upload/${orderId}`, { unit_code_outer: formData.unit_code_outer, unit_code_inner: formData.unit_code_inner, outer_list_no: outerListNo, inner_list_no: innerListNo }, { params: { item_no: formData.item_no } }),
        axios.post(`/api/partlist-mstdtl-bom/upload/${orderId}`, { items: detailParts, unit_code_outer: formData.unit_code_outer, unit_code_inner: formData.unit_code_inner }, { params: { item_no: formData.item_no } }),
        axios.post(`/api/master-formula/upload/${orderId}`, { materials: detailMaterials, parts: detailParts, user_by: "Fajar" }, { params: { item_no: formData.item_no } })
      ]);

      let msg = `Berhasil meng-upload data ke 5 Tabel Shiage (BOM_ID: ${bomId})!`;
      const warnings = resMst?.data?.warnings || [];
      if (warnings.length > 0) {
        msg += `\n\n⚠️ PERHATIAN:\n` + warnings.join('\n') + `\n(Kolom ProductionLineAfterBreakDown & BunnouID diisi NULL)`;
      }

      alert(msg);
    } catch (err) {
      console.error("Upload error detail:", err);
      alert("Gagal upload Shiage Master/Formula BOM: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploadingMaster(false);
    }
  };

  const handleGenerate = async () => {
    const widthVal = Number(formData.width);
    const heightVal = Number(formData.height);

    if (!widthVal || widthVal <= 0 || !heightVal || heightVal <= 0) {
      alert("Width and Height must be greater than 0");
      return;
    }

    setGenerating(true);
    try {
      await updateOrder(orderId, formData);
      await generateOrder(orderId);
      await loadOrder();
      alert("Manufacturing List berhasil digenerate!");
    } catch (err) {
      console.error(err);
      alert("Failed to generate: " + (err.response?.data?.detail || err.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    window.location.href = `/api/orders/${orderId}/download`;
  };

  if (loading || !order) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  const { parsed_data: parsed } = order;

  // Reusable input class
  const inputClass = "w-full px-3 py-2 border border-surface-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900/50 text-surface-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium";

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 pb-20 transition-colors duration-200">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-surface-500 dark:text-gray-400 hover:text-surface-900 dark:hover:text-white font-medium transition-colors mb-6 group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        Back to Orders
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-surface-900 dark:text-white">
            {order.project_name || 'Unnamed Order'}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-surface-500 dark:text-gray-400">
            <span className="flex items-center gap-1"><Box size={14} /> ID: #{order.id}</span>
            <span>•</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border
              ${order.status === 'generated' 
                ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50' 
                : 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/50'}`}>
              {order.status === 'generated' ? 'Generated' : 'Draft'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-surface-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-surface-700 dark:text-gray-200 rounded-lg hover:bg-surface-50 dark:hover:bg-gray-700 font-medium transition-colors shadow-sm"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Draft
          </button>
          
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
          >
            {generating ? <Loader2 size={18} className="animate-spin" /> : <Play fill="currentColor" size={14} />}
            Generate List
          </button>

          {order.has_output && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm"
            >
              <Download size={18} />
              Download .xlsx
            </button>
          )}

          <button
            onClick={handleUploadMaster}
            disabled={uploadingMaster}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            {uploadingMaster ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            Upload to Shiage
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Editable Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-surface-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
            <div className="bg-surface-50 dark:bg-gray-900/50 px-5 py-4 border-b border-surface-200 dark:border-gray-700 flex items-center gap-2">
              <Settings className="text-surface-500 dark:text-gray-400" size={18} />
              <h2 className="font-semibold text-surface-900 dark:text-white">Order Parameters</h2>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-surface-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Excel Sheet Name
                </label>
                <input
                  type="text"
                  placeholder="Contoh: MFG_SHEET_1"
                  value={formData.sheet_name || ''}
                  onChange={e => setFormData({...formData, sheet_name: e.target.value})}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Width (W)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.width ?? ''}
                      onChange={e => setFormData({...formData, width: e.target.value === '' ? '' : parseInt(e.target.value) || 0})}
                      className={`${inputClass} pr-8`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-gray-500 text-sm">mm</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Height (H)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.height ?? ''}
                      onChange={e => setFormData({...formData, height: e.target.value === '' ? '' : parseInt(e.target.value) || 0})}
                      className={`${inputClass} pr-8`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-gray-500 text-sm">mm</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Quantity</label>
                  <input
                    type="number"
                    value={formData.qty || 1}
                    onChange={e => setFormData({...formData, qty: parseInt(e.target.value) || 1})}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Glass Thick</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.glass_thickness || 5}
                      onChange={e => setFormData({...formData, glass_thickness: parseInt(e.target.value) || 5})}
                      className={`${inputClass} pr-8`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-gray-500 text-sm">mm</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Color Finish</label>
                <input
                  type="text"
                  value={formData.color || ''}
                  onChange={e => setFormData({...formData, color: e.target.value})}
                  className={inputClass}
                />
              </div>

              <hr className="border-surface-200 dark:border-gray-700" />

              <div>
                <label className="block text-xs font-semibold text-surface-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Series</label>
                <input
                  type="text"
                  value={formData.series || ''}
                  onChange={e => setFormData({...formData, series: e.target.value})}
                  className={inputClass}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Unit Code Outer</label>
                  <input
                    type="text"
                    value={formData.unit_code_outer || ''}
                    onChange={e => setFormData({...formData, unit_code_outer: e.target.value})}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Unit Code Inner</label>
                  <input
                    type="text"
                    value={formData.unit_code_inner || ''}
                    onChange={e => setFormData({...formData, unit_code_inner: e.target.value})}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Item No / BOM ID</label>
                <input
                  type="text"
                  value={formData.item_no || ''}
                  onChange={e => setFormData({...formData, item_no: e.target.value})}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Parsed Data View */}
        <div className="lg:col-span-2 space-y-6">
          {(!parsed?.outer && !parsed?.inner) ? (
             <div className="bg-surface-50 dark:bg-gray-800/50 border border-surface-200 dark:border-gray-700 rounded-2xl p-12 text-center transition-colors">
               <Layers className="mx-auto h-12 w-12 text-surface-300 dark:text-gray-600 mb-4" />
               <p className="text-surface-500 dark:text-gray-400">No standard lists extracted.</p>
             </div>
          ) : (
            <>
              {parsed.outer && <ParsedDataCard title="Standard List: Outer Frame" data={parsed.outer} />}
              {parsed.inner && <ParsedDataCard title="Standard List: Inner Sash" data={parsed.inner} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ParsedDataCard({ title, data = {} }) {
  if (!data) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-surface-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6 transition-colors">
      <div className="bg-surface-50 dark:bg-gray-900/50 px-6 py-4 border-b border-surface-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="font-semibold text-surface-900 dark:text-white">{title}</h2>
        <span className="text-xs font-medium bg-surface-200 dark:bg-gray-700 text-surface-700 dark:text-gray-300 px-2.5 py-1 rounded-md font-mono border border-transparent dark:border-gray-600">
          {data.list_no || 'Template'}
        </span>
      </div>
      
      <div className="p-0 overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-surface-50 dark:bg-gray-900/80 text-surface-500 dark:text-gray-400 font-semibold border-b border-surface-200 dark:border-gray-700 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-3">Description</th>
              <th className="px-6 py-3">Part/Fab No</th>
              <th className="px-6 py-3 text-center">Qty/Formula</th>
              <th className="px-6 py-3 text-center text-red-600 dark:text-red-400 font-bold">AT SITE</th> 
              <th className="px-6 py-3">Remark 1</th>
              <th className="px-6 py-3">Remark 2</th>
              <th className="px-6 py-3">Remark 3</th>
              <th className="px-6 py-3">Remark 4</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-gray-700/50">
            {data.materials?.map((m, i) => {
              const r2 = m.remark2 || m.remarks || '';
              return (
                <tr key={`m-${i}`} className="hover:bg-surface-50/50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-3 font-medium text-surface-900 dark:text-gray-200">{m.description}</td>
                  <td className="px-6 py-3 text-blue-600 dark:text-blue-400 font-mono text-sm">{m.fab_no}</td>
                  <td className="px-6 py-3 text-center">
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border dark:border-gray-600 px-2.5 py-1 rounded">
                      {m.cut_formula || m.qty || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center font-bold text-red-600 dark:text-red-400">{m.at_site}</td>
                  <td className="px-6 py-3 text-surface-500 dark:text-gray-400 text-xs">{m.remark1 ? m.remark1 : '-'}</td>
                  <td className="px-6 py-3 text-surface-500 dark:text-gray-400 text-xs">{r2 ? r2 : '-'}</td>
                  <td className="px-6 py-3 text-surface-500 dark:text-gray-400 text-xs">{m.remark3 ? m.remark3 : '-'}</td>
                  <td className="px-6 py-3 text-surface-500 dark:text-gray-400 text-xs">{m.remark4 ? m.remark4 : '-'}</td>
                </tr>
              );
            })}
            {data.parts?.map((p, i) => {
              const r2 = p.remark2 || p.remarks || '';
              return (
                <tr key={`p-${i}`} className="hover:bg-surface-50/50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-3 font-medium text-surface-900 dark:text-gray-200">{p.description}</td>
                  <td className="px-6 py-3 text-blue-600 dark:text-blue-400 font-mono text-sm">{p.part_no}</td>
                  <td className="px-6 py-3 text-center">
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border dark:border-gray-600 px-2.5 py-1 rounded">
                      {p.cut_formula || p.length || p.qty || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center font-bold text-red-600 dark:text-red-400">{p.at_site}</td>
                  <td className="px-6 py-3 text-surface-500 dark:text-gray-400 text-xs">{p.remark1 ? p.remark1 : '-'}</td>
                  <td className="px-6 py-3 text-surface-500 dark:text-gray-400 text-xs">{r2 ? r2 : '-'}</td>
                  <td className="px-6 py-3 text-surface-500 dark:text-gray-400 text-xs">{p.remark3 ? p.remark3 : '-'}</td>
                  <td className="px-6 py-3 text-surface-500 dark:text-gray-400 text-xs">{p.remark4 ? p.remark4 : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.lookup_tables && data.lookup_tables.length > 0 && (
        <div className="p-6 bg-surface-50 dark:bg-gray-900/30 border-t border-surface-200 dark:border-gray-700 transition-colors">
          <h3 className="font-semibold text-sm text-surface-700 dark:text-gray-300 mb-4 flex items-center">
            <Layers className="w-4 h-4 mr-2" />
            Lookup Tables (Sheet 2)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.lookup_tables.map((tbl, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 border border-surface-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-surface-100 dark:bg-gray-900/80 px-4 py-2 border-b border-surface-200 dark:border-gray-700 text-xs font-semibold text-surface-800 dark:text-gray-300">
                  [{tbl.table_id}] {tbl.description}
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="text-surface-500 dark:text-gray-400 bg-surface-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 font-medium border-b border-surface-100 dark:border-gray-700">Condition ({tbl.variable})</th>
                      <th className="px-4 py-2 font-medium border-b border-surface-100 dark:border-gray-700">
                        {tbl.conditions.length > 0 ? Object.keys(tbl.conditions[0].values).join(" / ") : "Value"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-50 dark:divide-gray-700/50">
                    {tbl.conditions.map((cond, cIdx) => (
                      <tr key={cIdx} className="hover:bg-surface-50/50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-2 font-mono text-surface-600 dark:text-gray-400">{cond.condition}</td>
                        <td className="px-4 py-2 font-mono text-blue-600 dark:text-blue-400 font-semibold">
                          {Object.values(cond.values).join(" / ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}