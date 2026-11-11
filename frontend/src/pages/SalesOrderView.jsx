import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ChevronRight, ChevronDown, ShoppingBag, Clock, RefreshCw, ZoomIn, ZoomOut, RotateCcw, AlertCircle } from 'lucide-react';
import { dateToOffsetPixels, DynamicTimelineHeader, generateDateList } from '../components/Utils_schedule'; // Adjust path if necessary

export default function SalesOrderView() {
  // ==========================================
  // 1. STANDALONE STATE (Toolbar & Data API)
  // ==========================================
  const [startDate, setStartDate] = useState('2026-08-27');
  const [endDate, setEndDate] = useState('2026-09-26');
  const [columnWidth, setColumnWidth] = useState(70);
  const [loading, setLoading] = useState(false);

  const [hierarchy, setHierarchy] = useState([]);
  const [holidays, setHolidays] = useState([]);

  const pxPerHour = columnWidth / 24;
  const SIDEBAR_WIDTH = 320;

  const dateList = useMemo(() => generateDateList(startDate, endDate), [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    const cleanStart = startDate ? startDate.split('T')[0] : '2026-08-27';
    const cleanEnd = endDate ? endDate.split('T')[0] : '2026-09-26';
    
    try {
      const response = await axios.get(`/api/schedule/sales-orders?start_date=${cleanStart}&end_date=${cleanEnd}`);
      setHierarchy(response?.data?.hierarchy || []);
      setHolidays(response?.data?.holidays || []);
    } catch (err) {
      console.error("API Request Failed.", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (new Date(endDate) < new Date(startDate)) setEndDate(startDate);
    fetchData();
  }, [startDate, endDate]);

  // ==========================================
  // 2. UI INTERACTION STATE
  // ==========================================
  const [expandedNodes, setExpandedNodes] = useState({});
  
  const hierarchyCount = hierarchy ? hierarchy.length : 0;

  useEffect(() => {
    const defaultExpanded = {};
    (hierarchy || []).forEach(group => {
      if (!group) return;
      defaultExpanded[group.status] = true;
      (group.orders || []).forEach(so => { 
        if(so) defaultExpanded[so.soNo] = true; 
      });
    });
    setExpandedNodes(defaultExpanded);
  }, [hierarchyCount]);

  const toggleNode = (nodeKey) => setExpandedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }));

  return (
    <div className="flex flex-col h-full bg-gray-50 select-none text-xs font-sans p-4 gap-4">
      
      {/* TOOLBAR CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded border border-gray-200">
            <Clock size={16} className="text-gray-500" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent font-semibold text-gray-700 focus:outline-none cursor-pointer" />
            <span className="text-gray-400 font-bold">-</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent font-semibold text-gray-700 focus:outline-none cursor-pointer" />
          </div>
          <button onClick={fetchData} className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded border border-gray-300 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} /> Refresh
          </button>
        </div>

        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded border border-gray-200">
          <span className="text-[11px] font-semibold text-gray-500 px-2 uppercase tracking-wider">Zoom</span>
          <button onClick={() => setColumnWidth(prev => Math.max(prev - 25, 45))} className="p-1.5 hover:bg-white rounded text-gray-700"><ZoomOut size={15} /></button>
          <button onClick={() => setColumnWidth(70)} className="px-2 py-1 hover:bg-white rounded text-gray-700 text-[11px] font-medium flex items-center gap-1">
            <RotateCcw size={13} /> {Math.round((columnWidth / 70) * 100)}%
          </button>
          <button onClick={() => setColumnWidth(prev => Math.min(prev + 25, 300))} className="p-1.5 hover:bg-white rounded text-gray-700"><ZoomIn size={15} /></button>
        </div>
      </div>

      {/* SALES ORDER GANTT CHART BOARD */}
      <div className="bg-white rounded border border-gray-400 shadow flex flex-col" style={{ height: 'calc(100vh - 220px)' }} onClick={() => setSelectedTask(null)}>
        <div className="overflow-x-auto overflow-y-auto flex-1 relative custom-scrollbar">
          <div className="min-w-max">
            
            {/* TIMELINE HEADER */}
            <div className="sticky top-0 z-40 flex bg-slate-700 text-white font-sans border-b border-slate-600">
              <div className="sticky left-0 z-50 p-3 bg-slate-600 border-r border-slate-500 font-bold flex items-center gap-2 text-sm flex-shrink-0 shadow-md" style={{ width: SIDEBAR_WIDTH }}>
                <ShoppingBag size={16} /> Sales Orders (Read-Only)
              </div>
              <DynamicTimelineHeader columnWidth={columnWidth} dateList={dateList} holidays={holidays} theme="dark" />
            </div>

            {/* EMPTY STATE */}
            {hierarchyCount === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50">
                <AlertCircle size={48} className="mb-4 text-gray-300" />
                <p className="text-sm font-semibold">Tidak ada data Sales Order untuk tanggal yang dipilih.</p>
                <p className="text-xs mt-1">Silakan sesuaikan tanggal atau tekan tombol Refresh.</p>
              </div>
            )}

            {/* HIERARCHY CONTENT */}
            <div className="divide-y divide-gray-300 bg-gray-50">
              {(hierarchy || []).map((group) => {
                if (!group) return null;
                const isStatusExpanded = expandedNodes[group.status];
                
                return (
                  <React.Fragment key={group.status}>
                    {/* LEVEL 1: STATUS */}
                    <div onClick={() => toggleNode(group.status)} className="flex bg-amber-400 hover:bg-amber-500 cursor-pointer font-bold text-gray-900 transition-colors">
                      <div className="sticky left-0 z-30 p-2 border-r border-amber-500 flex items-center gap-2 flex-shrink-0 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                        {isStatusExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="uppercase tracking-wide">{group.status}</span>
                      </div>
                      <div className="flex-1" />
                    </div>

                    {isStatusExpanded && (group.orders || []).map((so) => {
                      if (!so) return null;
                      const isSoExpanded = expandedNodes[so.soNo];
                      const soDueDate = so.items?.[0]?.dueDate; 
                      const soDueOffset = soDueDate ? dateToOffsetPixels(soDueDate, startDate, pxPerHour) : 0;

                      return (
                        <React.Fragment key={so.soNo}>
                          {/* LEVEL 2: SALES ORDER NO */}
                          <div onClick={() => toggleNode(so.soNo)} className="flex bg-amber-200 hover:bg-amber-300 cursor-pointer font-semibold text-gray-900 border-b border-amber-300 transition-colors relative">
                            <div className="sticky left-0 z-30 p-2 pl-6 border-r border-amber-300 flex items-center gap-2 flex-shrink-0 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                              {isSoExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span>{so.soNo}</span>
                            </div>

                            <div className="flex relative items-center py-1 flex-1">
                              {(dateList || []).map(({ iso }) => {
                                const isHoliday = (holidays || []).includes(iso);
                                return <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-8 border-r flex-shrink-0 ${isHoliday ? 'bg-gray-300/50 border-gray-400/40' : 'border-amber-300/50'}`} />;
                              })}
                              {soDueOffset > 0 && (
                                <div className="absolute z-20 flex items-center justify-center pointer-events-none" style={{ left: `${soDueOffset}px` }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#000000" className="drop-shadow-sm -translate-x-1/2">
                                    <polygon points="12,0 24,12 12,24 0,12" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </div>

                          {isSoExpanded && (so.items || []).map((item) => {
                            if (!item) return null;
                            const isItemExpanded = expandedNodes[item.itemCode] ?? true;

                            return (
                              <React.Fragment key={item.itemCode}>
                                {/* LEVEL 3: ITEM DESCRIPTION */}
                                <div onClick={() => toggleNode(item.itemCode)} className="flex bg-gray-100 hover:bg-gray-200 cursor-pointer font-medium text-gray-800 border-b border-gray-300 transition-colors">
                                  <div className="sticky left-0 z-30 p-2 pl-10 border-r border-gray-300 flex items-center gap-2 flex-shrink-0 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                                    {isItemExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <span className="truncate">{item.itemCode}</span>
                                  </div>

                                  <div className="flex relative items-center py-1 flex-1">
                                    {(dateList || []).map(({ iso }) => {
                                      const isHoliday = (holidays || []).includes(iso);
                                      return <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-8 border-r flex-shrink-0 ${isHoliday ? 'bg-gray-300/60 border-gray-400/50' : 'border-gray-200'}`} />;
                                    })}
                                  </div>
                                </div>

                                {/* LEVEL 4: RPO BAR */}
                                {isItemExpanded && (item.rpos || []).map((rpo) => {
                                  if (!rpo) return null;
                                  
                                  const rpoStart = rpo.startTime || startDate;
                                  const rpoEnd = rpo.endTime || startDate;
                                  
                                  const startPx = dateToOffsetPixels(rpoStart, startDate, pxPerHour);
                                  const endPx = dateToOffsetPixels(rpoEnd, startDate, pxPerHour);
                                  const widthPx = Math.max(endPx - startPx, 12);
                                  
                                  const qty = rpo.qty || 0;
                                  const weightPerPc = rpo.weight || 0;
                                  const totalWeight = qty * weightPerPc;
                                  const desc = rpo.itemDescription || item.itemCode.split(' | ')[0] || '-'; 
                                  const tooltipText = `RPO: ${rpo.displayNo}\nDesc: ${desc}\nQty: ${qty}\nTotal Weight: ${totalWeight.toLocaleString('id-ID')} kg\nStart: ${rpoStart}\nEnd: ${rpoEnd}`;

                                  return (
                                    <div key={rpo.rpoNo || Math.random()} className="flex bg-white border-b border-gray-200 hover:bg-amber-50">
                                      <div className="sticky left-0 z-30 p-2 pl-14 border-r border-gray-300 flex items-center gap-2 flex-shrink-0 text-gray-700 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                                        <ChevronRight size={12} className="text-gray-400" />
                                        <span className="truncate">{rpo.rpoNo}</span>
                                      </div>

                                      <div className="flex relative items-center py-1 flex-1">
                                        {(dateList || []).map(({ iso }) => {
                                          const isHoliday = (holidays || []).includes(iso);
                                          return <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-9 border-r flex-shrink-0 ${isHoliday ? 'bg-gray-200/90 border-gray-300' : 'border-gray-100 bg-white'}`} />;
                                        })}
                                        
                                        {startPx >= 0 && (
                                          <div
                                            className="absolute z-20 h-6 rounded bg-amber-800 text-white font-bold text-[10px] px-2 flex items-center justify-center shadow border border-amber-950 overflow-hidden cursor-pointer hover:brightness-110"
                                            style={{ left: `${startPx}px`, width: `${widthPx}px` }}
                                            title={tooltipText}
                                          >
                                            <span>{rpo.displayNo}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}