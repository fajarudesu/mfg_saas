import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { ChevronRight, ChevronDown, Settings, Clock, RefreshCw, ZoomIn, ZoomOut, RotateCcw, AlertCircle } from 'lucide-react';
import { dateToOffsetPixels, getRpoColor, generateDateList } from '../components/Utils_schedule'; // Sesuaikan path ini jika perlu

const TaskBar = ({ task, startDate, pxPerHour, selectedTask, setSelectedTask }) => {
  const startTime = task?.start_time || startDate;
  const endTime = task?.end_time || startDate;
  
  const startPx = dateToOffsetPixels(startTime, startDate, pxPerHour);
  const endPx = dateToOffsetPixels(endTime, startDate, pxPerHour);
  const widthPx = Math.max(endPx - startPx, 16); 

  if (endPx < 0) return null; 

  const rpoNo = task?.prod_order_no || 'UNKNOWN';
  const colorObj = getRpoColor(rpoNo);
  const isSelected = selectedTask && selectedTask?.prod_order_no === rpoNo;

  const qty = task?.quantity || 0;
  const weightPerPc = task?.weight || 0;
  const totalWeight = qty * weightPerPc;
  const desc = task?.item_description || '-';
  const opNo = task?.operation_no || '-';
  const status = task?.status || '-';

  const tooltipText = `RPO: ${rpoNo}\nDesc: ${desc}\nStatus: ${status}\nOp: ${opNo}\nQty: ${qty}\nTotal Weight: ${totalWeight.toLocaleString('id-ID')} kg\nStart: ${startTime}\nEnd: ${endTime}`;

  return (
    <div
      id={`task-${task?.id || Math.random()}`}
      onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}
      className={`absolute z-20 h-7 rounded text-white font-bold text-[11px] flex items-center justify-center shadow-sm cursor-pointer transition-transform ${
        isSelected ? 'ring-2 ring-red-500 ring-offset-1 scale-105 z-30 shadow-md' : 'hover:brightness-110'
      }`}
      style={{
        left: `${Math.max(2, startPx)}px`,
        width: `${widthPx}px`,
        backgroundColor: colorObj.bg,
        border: `1px solid ${colorObj.border}`
      }}
      title={tooltipText}
    >
      <span className={widthPx < 25 ? 'hidden' : 'block'}>{opNo}</span>
    </div>
  );
};

export default function SchedulingView() {
  // ==========================================
  // 1. STATE MANDIRI (Toolbar & Data API)
  // ==========================================
  const [startDate, setStartDate] = useState('2026-08-27');
  const [endDate, setEndDate] = useState('2026-09-26');
  const [columnWidth, setColumnWidth] = useState(70);
  const [loading, setLoading] = useState(false);

  const [workCenterGroups, setWorkCenterGroups] = useState([]);
  const [routings, setRoutings] = useState([]);
  const [holidays, setHolidays] = useState([]);

  const dateList = useMemo(() => generateDateList(startDate, endDate), [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    const cleanStart = startDate ? startDate.split('T')[0] : '2026-08-27';
    const cleanEnd = endDate ? endDate.split('T')[0] : '2026-09-26';
    
    try {
      const [salesRes, scheduleRes] = await Promise.all([
        axios.get(`/api/schedule/sales-orders?start_date=${cleanStart}&end_date=${cleanEnd}`),
        axios.get(`/api/schedule?start_date=${cleanStart}&end_date=${cleanEnd}`)
      ]);

      // TAMBAHKAN TANDA TANYA (?.) DI SINI AGAR TIDAK CRASH SAAT DATA NULL
      setHolidays(salesRes?.data?.holidays || []);
      setWorkCenterGroups(scheduleRes?.data?.workCenterGroups || []);
      setRoutings(scheduleRes?.data?.routings || []);
      
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
  // 2. STATE INTERAKSI GANTT CHART (4 Level)
  // ==========================================
  const [expandedGroups, setExpandedGroups] = useState({});     
  const [expandedSubGroups, setExpandedSubGroups] = useState({}); 
  const [expandedCenters, setExpandedCenters] = useState({});   

  const [selectedTask, setSelectedTask] = useState(null);
  const [links, setLinks] = useState([]);
  
  const containerRef = useRef(null);
  const SIDEBAR_WIDTH = 250;
  const pxPerHour = columnWidth / 24;

  const groupCount = workCenterGroups ? workCenterGroups.length : 0;

  useEffect(() => {
    setExpandedGroups({});
    setExpandedSubGroups({});
    setExpandedCenters({});
  }, [groupCount]); 

  const toggleGroup = (groupName) => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  const toggleSubGroup = (subGroupId) => setExpandedSubGroups(prev => ({ ...prev, [subGroupId]: !prev[subGroupId] }));
  const toggleCenter = (centerId) => setExpandedCenters(prev => ({ ...prev, [centerId]: !prev[centerId] }));

  useLayoutEffect(() => {
    if (!containerRef.current || !routings || routings.length === 0 || !selectedTask) {
      setLinks(prev => prev.length === 0 ? prev : []); 
      return;
    }
    
    let animationFrameId;
    const calculateCoords = () => {
      try {
        const calculatedLinks = [];
        const boardRect = containerRef.current.getBoundingClientRect();
        const relatedTasks = (routings || []).filter(t => t?.prod_order_no === selectedTask?.prod_order_no);

        relatedTasks.forEach((task) => {
          if (!task) return;
          const colorObj = getRpoColor(task.prod_order_no || '');
          const nextTask = relatedTasks.find(t => t?.operation_no === (task.operation_no + 10));

          if (nextTask) {
            const el1 = document.getElementById(`task-${task.id}`);
            const el2 = document.getElementById(`task-${nextTask.id}`);
            if (el1 && el2) {
              const r1 = el1.getBoundingClientRect();
              const r2 = el2.getBoundingClientRect();
              const x1 = (r1.left + r1.width / 2) - boardRect.left + containerRef.current.scrollLeft;
              const y1 = r1.bottom - boardRect.top + containerRef.current.scrollTop;
              const x2 = (r2.left + r2.width / 2) - boardRect.left + containerRef.current.scrollLeft;
              const y2 = r2.top - boardRect.top + containerRef.current.scrollTop;

              if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
                calculatedLinks.push({ id: `${task.id}-${nextTask.id}`, rpo: task.prod_order_no, x1, y1, x2, y2, color: colorObj.bg });
              }
            }
          }
        });
        setLinks(calculatedLinks);
      } catch (err) {
        console.warn('SVG Calculation Deferred:', err);
      }
    };
    const timer = setTimeout(() => { animationFrameId = requestAnimationFrame(calculateCoords); }, 150);
    return () => { clearTimeout(timer); cancelAnimationFrame(animationFrameId); };
  }, [expandedGroups, expandedSubGroups, expandedCenters, columnWidth, startDate, selectedTask, routings]);

  const showTime = columnWidth >= 120;

  return (
    <div className="flex flex-col h-full bg-gray-50 select-none text-xs font-sans p-4 gap-4">
      
      {/* TOOLBAR CONTROLS (Tampil di atas Gantt Chart) */}
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

      {/* GANTT CHART BOARD */}
      <div className="bg-white rounded border border-gray-400 shadow flex flex-col" style={{ height: 'calc(100vh - 220px)' }} onClick={() => setSelectedTask(null)}>
        <div ref={containerRef} className="overflow-x-auto overflow-y-auto flex-1 relative custom-scrollbar">
          
          <svg className="absolute inset-0 pointer-events-none z-20 w-full h-full" style={{ minHeight: '100%' }}>
            {links.map((link) => (
              <line key={link.id} x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} stroke="#2563eb" strokeWidth="2.5" className="animate-pulse shadow-sm" />
            ))}
          </svg>

          <div className="w-max min-w-full flex flex-col">
            
            {/* HEADER TIMELINE */}
            <div className="sticky top-0 z-40 flex bg-gray-100 text-gray-800 font-sans border-b border-gray-300">
              <div className="sticky left-0 z-50 p-3 bg-gray-200 border-r border-gray-300 font-bold flex items-center justify-between shadow-md flex-shrink-0" style={{ width: SIDEBAR_WIDTH }}>
                <span className="flex items-center gap-2"><Settings size={16} /> Capacities</span>
              </div>

              <div className="flex flex-col flex-1">
                <div className="flex bg-slate-200 border-b border-gray-300">
                  {(dateList || []).map((d) => (
                    <div key={`m-${d.iso}`} style={{ width: `${columnWidth}px` }} className={`h-6 flex items-center text-[11px] px-1 font-bold ${d.isNewMonth ? 'border-l border-gray-400' : ''}`}>
                      <span className="truncate">{d.isNewMonth ? d.monthYear : ''}</span>
                    </div>
                  ))}
                </div>
                <div className="flex bg-slate-100 border-b border-gray-200">
                  {(dateList || []).map((d) => (
                    <div key={`w-${d.iso}`} style={{ width: `${columnWidth}px` }} className={`h-6 flex items-center text-[11px] px-1 font-semibold ${d.isNewWeek ? 'border-l border-gray-300' : ''}`}>
                      <span className="truncate">{d.isNewWeek ? d.week : ''}</span>
                    </div>
                  ))}
                </div>
                <div className="flex bg-white">
                  {(dateList || []).map((d) => {
                    const isHoliday = (holidays || []).includes(d.iso);
                    return (
                      <div key={`d-${d.iso}`} style={{ width: `${columnWidth}px` }} className={`flex flex-col border-r border-gray-200 flex-shrink-0 ${isHoliday ? 'bg-gray-100 text-gray-500' : 'text-gray-800'}`}>
                        <div className="h-6 flex items-center justify-center text-[11px] font-medium border-b border-gray-100">
                          {d.day}
                        </div>
                        {showTime && (
                          <div className="flex w-full text-[9px] text-gray-400 text-center bg-gray-50 h-4 items-center">
                            <div className="flex-1 border-r border-gray-200 truncate">00:00</div>
                            <div className="flex-1 truncate">12:00</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* EMPTY STATE */}
            {groupCount === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-gray-50">
                <AlertCircle size={48} className="mb-4 text-gray-300" />
                <p className="text-sm font-semibold">Tidak ada data jadwal untuk tanggal yang dipilih.</p>
                <p className="text-xs mt-1">Silakan sesuaikan tanggal atau tekan tombol Refresh.</p>
              </div>
            )}

            {/* KONTEN GANTT CHART (4 Level) */}
            <div className="divide-y divide-gray-300 bg-slate-50">
              {(workCenterGroups || []).map((group) => {
                if (!group) return null;
                
                const groupName = group.group_name || 'UNGROUPED';
                const isGroupExpanded = expandedGroups[groupName];
                const groupedCenters = {};
                
                (group.centers || []).forEach(center => {
                  if (!center) return;
                  const centerIdStr = center.center_id || '';
                  const prefix = centerIdStr.length >= 2 ? centerIdStr.substring(0, 2).toUpperCase() : 'MISC';
                  
                  if (!groupedCenters[prefix]) groupedCenters[prefix] = [];
                  groupedCenters[prefix].push(center);
                });

                return (
                  <React.Fragment key={groupName}>
                    <div onClick={() => toggleGroup(groupName)} className="flex bg-slate-300 hover:bg-slate-400 cursor-pointer font-bold text-gray-800 transition-colors">
                      <div className="sticky left-0 z-30 p-2.5 border-r border-slate-400 flex items-center gap-2 flex-shrink-0 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                        {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span className="uppercase tracking-wide">{groupName}</span>
                      </div>
                      <div className="flex relative items-center py-1 flex-1">
                        {(dateList || []).map(({ iso }) => {
                           const isHoliday = (holidays || []).includes(iso);
                           return <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-8 border-r flex-shrink-0 ${isHoliday ? 'bg-slate-400/20 border-slate-400/30' : 'border-slate-300/30'}`} />;
                        })}
                      </div>
                    </div>

                    {isGroupExpanded && Object.entries(groupedCenters).map(([prefix, centers]) => {
                      const subGroupId = `${groupName}-${prefix}`;
                      const isSubGroupExpanded = expandedSubGroups[subGroupId];

                      return (
                        <React.Fragment key={subGroupId}>
                          <div onClick={() => toggleSubGroup(subGroupId)} className="flex bg-slate-200 hover:bg-slate-300 cursor-pointer font-semibold text-gray-800 transition-colors border-b border-gray-300">
                            <div className="sticky left-0 z-30 p-2 pl-6 border-r border-gray-300 flex items-center gap-2 flex-shrink-0 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                              {isSubGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span className="uppercase">{prefix}</span>
                            </div>
                            <div className="flex relative items-center py-1 flex-1">
                              {(dateList || []).map(({ iso }) => {
                                const isHoliday = (holidays || []).includes(iso);
                                return <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-8 border-r flex-shrink-0 ${isHoliday ? 'bg-gray-300/30 border-gray-300' : 'border-gray-200'}`} />;
                              })}
                            </div>
                          </div>

                          {isSubGroupExpanded && (centers || []).map((center) => {
                            const centerId = center?.center_id || '';
                            const centerName = center?.center_name || 'Unknown Center';
                            const isCenterExpanded = expandedCenters[centerId];
                            
                            const centerTasks = (routings || []).filter(t => t?.center_id === centerId);
                            const centerTotalWeight = centerTasks.reduce((acc, t) => acc + ((t?.quantity || 0) * (t?.weight || 0)), 0);

                            return (
                              <React.Fragment key={centerId}>
                                <div onClick={() => toggleCenter(centerId)} className="flex bg-white hover:bg-blue-50/40 cursor-pointer transition-colors border-b border-gray-200">
                                  <div className="sticky left-0 z-30 p-2 pl-10 border-r border-gray-300 flex items-center justify-between flex-shrink-0 shadow-sm bg-white" style={{ width: SIDEBAR_WIDTH }}>
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      {isCenterExpanded ? <ChevronDown size={14} className="flex-shrink-0" /> : <ChevronRight size={14} className="flex-shrink-0" />}
                                      <span className="font-semibold text-gray-700 truncate">{centerName}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-medium ml-2 mr-1 flex-shrink-0 whitespace-nowrap">
                                      {centerTotalWeight > 0 ? `(${centerTotalWeight.toLocaleString('id-ID')} kg)` : ''}
                                    </span>
                                  </div>
                                  
                                  <div className="flex relative items-center py-1 flex-1">
                                    {(dateList || []).map(({ iso }) => {
                                      const isHoliday = (holidays || []).includes(iso);
                                      return <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-8 border-r flex-shrink-0 ${isHoliday ? 'bg-gray-100/50 border-gray-200' : 'border-gray-100'}`} />;
                                    })}

                                    {centerTasks
                                      .filter((task) => task?.status !== "Firm Planned")
                                      .map((task) => (
                                        <TaskBar 
                                          key={task?.id || Math.random()} task={task} startDate={startDate} 
                                          pxPerHour={pxPerHour} selectedTask={selectedTask} setSelectedTask={setSelectedTask} 
                                        />
                                      ))}
                                  </div>
                                </div>

                                {isCenterExpanded && (
                                  <div className="flex bg-green-100 border-b border-green-200">
                                    <div className="sticky left-0 z-30 p-2 pl-14 border-r border-green-200 flex-shrink-0 flex items-center shadow-sm bg-green-100" style={{ width: SIDEBAR_WIDTH }}>
                                      <span className="text-[11px] font-medium text-green-800">Standby (∞)</span>
                                    </div>

                                    <div className="flex relative items-center py-1 flex-1">
                                      {(dateList || []).map(({ iso }) => (
                                        <div key={iso} style={{ width: `${columnWidth}px` }} className="h-10 border-r border-green-200/60 flex-shrink-0" />
                                      ))}

                                      {centerTasks
                                        .filter((task) => task?.status === "Firm Planned")
                                        .map((task) => (
                                          <TaskBar 
                                            key={task?.id || Math.random()} task={task} startDate={startDate} 
                                            pxPerHour={pxPerHour} selectedTask={selectedTask} setSelectedTask={setSelectedTask} 
                                          />
                                        ))}
                                    </div>
                                  </div>
                                )}
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