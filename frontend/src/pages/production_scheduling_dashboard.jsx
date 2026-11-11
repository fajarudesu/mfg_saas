import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import axios from 'axios';
import { 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  RefreshCw, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ShoppingBag,
  Settings
} from 'lucide-react';

const MOCK_START_DATE = '2026-08-27';
const MOCK_END_DATE = '2026-09-26';

const MOCK_SCHEDULE = {
  workCenterGroups: [
    {
      group_name: "Group 1", 
      centers: [
        { center_id: "C1-CUT", center_name: "Center 1 Cutting" },
        { center_id: "C1-PROC", center_name: "Center 1 Process" },
        { center_id: "C2-ASSY", center_name: "Center 2 Assembly" }
      ]
    }
  ],
  routings: [
    { 
      id: 1, prod_order_no: "RPO-001", operation_no: 10, center_id: "C1-CUT", 
      start_time: "2026-08-27 06:00:00", end_time: "2026-08-27 12:00:00", due_date: "2026-08-28 12:00:00",
      status: "Released", quantity: 100, weight: 1.5 


    },
    { 
      id: 2, prod_order_no: "RPO-002", operation_no: 10, center_id: "C1-CUT", 
      start_time: "2026-08-27 13:00:00", end_time: "2026-08-27 18:00:00", due_date: "2026-08-29 12:00:00",
      status: "Firm Planned", quantity: 50, weight: 2.0 
    },
    { 
      id: 3, prod_order_no: "RPO-001", operation_no: 20, center_id: "C2-ASSY", 
      start_time: "2026-08-28 06:00:00", end_time: "2026-08-28 16:00:00", due_date: "2026-08-29 12:00:00",
      status: "Released", quantity: 100, weight: 1.5 
    }
  ]
};

const MOCK_SALES = {
  holidays: ["2026-08-29", "2026-08-30"],
  hierarchy: [
    {
      status: "Released", 
      orders: [
        {
          soNo: "SO-123", 
          items: [
            {
              itemCode: "Item A", 
              rpos: [
                {
                  rpoNo: "RPO-001 | 10000 | 50", displayNo: "RPO-001", 
                  startTime: "2026-08-27 06:00:00", endTime: "2026-08-27 16:00:00"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

const getRpoColor = (rpoNo) => {
  if (!rpoNo) return { bg: '#2563eb', border: '#1d4ed8' };
  const colors = [
    { bg: '#2563eb', border: '#1e40af' },
    { bg: '#059669', border: '#065f46' },
    { bg: '#d97706', border: '#92400e' },
    { bg: '#7c3aed', border: '#5b21b6' },
    { bg: '#dc2626', border: '#991b1b' },
    { bg: '#0891b2', border: '#155e75' },
    { bg: '#db2777', border: '#9d174d' },
  ];
  let hash = 0;
  for (let i = 0; i < rpoNo.length; i++) hash = rpoNo.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const dateToOffsetPixels = (targetDateStr, baseDateStr, pxPerHour) => {
  if (!targetDateStr) return 0;
  const cleanTarget = targetDateStr.replace(' ', 'T');
  const target = new Date(cleanTarget); 
  const base = new Date(baseDateStr);
  base.setHours(0, 0, 0, 0);
  const diffHours = (target - base) / (1000 * 60 * 60);
  return diffHours * pxPerHour;
};

const getWeekNumber = (d) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const generateDateList = (startDateStr, endDateStr) => {
  const dates = [];
  const baseDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  // Hitung selisih hari
  let days = Math.ceil((endDate - baseDate) / (1000 * 60 * 60 * 24)) + 1;
  if (days < 1) days = 1; // Minimal 1 hari

  let currentMonth = '';
  let currentWeek = '';

  for (let i = 0; i < days; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    
    const iso = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('id-ID', { weekday: 'short', month: 'short', day: '2-digit' });
    const monthYear = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const week = `Wk ${getWeekNumber(d)}`;
    
    const isNewMonth = monthYear !== currentMonth;
    const isNewWeek = week !== currentWeek;
    
    if (isNewMonth) currentMonth = monthYear;
    if (isNewWeek) currentWeek = week;

    dates.push({
      iso, label, day: d.getDate().toString().padStart(2, '0'),
      monthYear, week, isNewMonth, isNewWeek
    });
  }
  return dates;
};

const DynamicTimelineHeader = ({ columnWidth, dateList, holidays, theme = 'dark' }) => {
  const getSubdivisions = () => {
    if (columnWidth < 120) return [];
    if (columnWidth < 240) return ['12:00'];
    return ['06:00', '12:00', '18:00'];
  };

  const divisions = getSubdivisions();
  const isDark = theme === 'dark';
  
  const thClasses = isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-200 border-gray-300 text-gray-800';
  const thHolidayClass = isDark ? 'bg-slate-800 text-slate-400' : 'bg-gray-300 text-gray-500';
  const subDivClass = isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-gray-100 text-gray-500 border-gray-200';

  return (
    <div className="flex">
      {dateList.map(({ iso, label }) => {
        const isHoliday = holidays.includes(iso);
        return (
          <div key={iso} style={{ width: `${columnWidth}px` }} className={`border-r flex-shrink-0 transition-all duration-300 ${isDark ? 'border-slate-600' : 'border-gray-300'}`}>
            <div className={`p-1 text-center font-bold border-b truncate text-[11px] ${isHoliday ? thHolidayClass : thClasses} ${isDark ? 'border-slate-600' : 'border-gray-300'}`}>
              {label}
            </div>
            <div className={`flex w-full text-[10px] text-center ${subDivClass} py-0.5`}>
              <div className={`flex-1 border-r ${isDark ? 'border-slate-700' : 'border-gray-200'} truncate`}>
                {divisions.length > 0 ? '00:00' : ''}
              </div>
              {divisions.map((div, i) => (
                <div key={i} className={`flex-1 ${i !== divisions.length - 1 ? `border-r ${isDark ? 'border-slate-700' : 'border-gray-200'}` : ''} truncate`}>{div}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SalesOrderView = ({ hierarchy, startDate, columnWidth, holidays, dateList }) => {
  const [expandedNodes, setExpandedNodes] = useState({});
  const pxPerHour = columnWidth / 24;
  const SIDEBAR_WIDTH = 320;

  useEffect(() => {
    const defaultExpanded = {};
    hierarchy.forEach(group => {
      defaultExpanded[group.status] = true;
      group.orders?.forEach(so => { defaultExpanded[so.soNo] = true; });
    });
    setExpandedNodes(defaultExpanded);
  }, [hierarchy]);

  const toggleNode = (nodeKey) => setExpandedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }));

  return (
    <div className="bg-white rounded border border-gray-400 overflow-hidden shadow h-full flex flex-col">
      <div className="overflow-x-auto overflow-y-auto flex-1 relative custom-scrollbar">
        <div className="inline-block min-w-full align-middle">
          
          <div className="sticky top-0 z-40 flex bg-slate-700 text-white font-sans border-b border-slate-600">
            <div className="sticky left-0 z-50 p-3 bg-slate-600 border-r border-slate-500 font-bold flex items-center gap-2 text-sm flex-shrink-0 shadow-md" style={{ width: SIDEBAR_WIDTH }}>
              <ShoppingBag size={16} /> Sales Orders (Read-Only)
            </div>
            <DynamicTimelineHeader columnWidth={columnWidth} dateList={dateList} holidays={holidays} theme="dark" />
          </div>

          <div className="divide-y divide-gray-300 bg-gray-50">
            {hierarchy.map((group) => {
              const isStatusExpanded = expandedNodes[group.status];
              return (
                <React.Fragment key={group.status}>
                  <div onClick={() => toggleNode(group.status)} className="flex bg-amber-400 hover:bg-amber-500 cursor-pointer font-bold text-gray-900 transition-colors">
                    <div className="sticky left-0 z-30 p-2 border-r border-amber-500 flex items-center gap-2 flex-shrink-0 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                      {isStatusExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="uppercase tracking-wide">{group.status}</span>
                    </div>
                    <div className="flex-1" />
                  </div>

                  {isStatusExpanded && group.orders.map((so) => {
                    const isSoExpanded = expandedNodes[so.soNo];
                    const soDueDate = so.items[0]?.dueDate; 
                    const soDueOffset = soDueDate ? dateToOffsetPixels(soDueDate, startDate, pxPerHour) : 0;

                    return (
                      <React.Fragment key={so.soNo}>
                        <div onClick={() => toggleNode(so.soNo)} className="flex bg-amber-200 hover:bg-amber-300 cursor-pointer font-semibold text-gray-900 border-b border-amber-300 transition-colors relative">
                          <div className="sticky left-0 z-30 p-2 pl-6 border-r border-amber-300 flex items-center gap-2 flex-shrink-0 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                            {isSoExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>{so.soNo}</span>
                          </div>

                          <div className="flex relative items-center py-1 flex-1">
                            {dateList.map(({ iso }) => (
                              <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-8 border-r flex-shrink-0 ${holidays.includes(iso) ? 'bg-gray-300/50 border-gray-400/40' : 'border-amber-300/50'}`} />
                            ))}
                            {soDueOffset > 0 && (
                              <div className="absolute z-20 flex items-center justify-center pointer-events-none" style={{ left: `${soDueOffset}px` }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#000000" className="drop-shadow-sm -translate-x-1/2">
                                  <polygon points="12,0 24,12 12,24 0,12" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>

                        {isSoExpanded && so.items.map((item) => {
                          const isItemExpanded = expandedNodes[item.itemCode] ?? true;

                          return (
                            <React.Fragment key={item.itemCode}>
                              <div onClick={() => toggleNode(item.itemCode)} className="flex bg-gray-100 hover:bg-gray-200 cursor-pointer font-medium text-gray-800 border-b border-gray-300 transition-colors">
                                <div className="sticky left-0 z-30 p-2 pl-10 border-r border-gray-300 flex items-center gap-2 flex-shrink-0 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                                  {isItemExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  <span className="truncate">{item.itemCode}</span>
                                </div>

                                <div className="flex relative items-center py-1 flex-1">
                                  {dateList.map(({ iso }) => (
                                    <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-8 border-r flex-shrink-0 ${holidays.includes(iso) ? 'bg-gray-300/60 border-gray-400/50' : 'border-gray-200'}`} />
                                  ))}
                                </div>
                              </div>

                              {isItemExpanded && item.rpos.map((rpo) => {
                                const startPx = dateToOffsetPixels(rpo.startTime, startDate, pxPerHour);
                                const endPx = dateToOffsetPixels(rpo.endTime, startDate, pxPerHour);
                                const widthPx = Math.max(endPx - startPx, 12);

                                return (
                                  <div key={rpo.rpoNo} className="flex bg-white border-b border-gray-200 hover:bg-amber-50">
                                    <div className="sticky left-0 z-30 p-2 pl-14 border-r border-gray-300 flex items-center gap-2 flex-shrink-0 text-gray-700 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                                      <ChevronRight size={12} className="text-gray-400" />
                                      <span className="truncate">{rpo.rpoNo}</span>
                                    </div>

                                    <div className="flex relative items-center py-1 flex-1">
                                      {dateList.map(({ iso }) => (
                                        <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-9 border-r flex-shrink-0 ${holidays.includes(iso) ? 'bg-gray-200/90 border-gray-300' : 'border-gray-100 bg-white'}`} />
                                      ))}
                                      {startPx >= 0 && (
                                        <div
                                          className="absolute z-20 h-6 rounded bg-amber-800 text-white font-bold text-[10px] px-2 flex items-center justify-center shadow border border-amber-950 overflow-hidden"
                                          style={{ left: `${startPx}px`, width: `${widthPx}px` }}
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
  );
};

const TaskBar = ({ task, startDate, pxPerHour, selectedTask, setSelectedTask }) => {
  const startPx = dateToOffsetPixels(task.start_time, startDate, pxPerHour);
  const endPx = dateToOffsetPixels(task.end_time, startDate, pxPerHour);
  const widthPx = Math.max(endPx - startPx, 16); 

  if (endPx < 0) return null; 

  const colorObj = getRpoColor(task.prod_order_no);
  const isSelected = selectedTask && selectedTask.prod_order_no === task.prod_order_no;


  const qty = task.quantity || 0;
  const weightPerPc = task.weight || 1.5; // Default 1.5 jika belum ada dari API
  const totalWeight = qty * weightPerPc;

  const tooltipText = `RPO: ${task.prod_order_no}\nDesc: ${task.item_description || '-'}\nStatus: ${task.status}\nOp: ${task.operation_no}\nQty: ${qty}\nTotal Weight: ${totalWeight.toLocaleString('id-ID')} kg\nStart: ${task.start_time}\nEnd: ${task.end_time}`;
  return (
    <div
      id={`task-${task.id}`}
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
      <span className={widthPx < 25 ? 'hidden' : 'block'}>{task.operation_no}</span>
    </div>
  );
};

const SchedulingView = ({ workCenterGroups, routings, startDate, columnWidth, holidays, dateList }) => {
  const [expandedGroups, setExpandedGroups] = useState({});     
  const [expandedSubGroups, setExpandedSubGroups] = useState({}); 
  const [expandedCenters, setExpandedCenters] = useState({});   

  const [selectedTask, setSelectedTask] = useState(null);
  const [links, setLinks] = useState([]);
  
  const containerRef = useRef(null);
  const SIDEBAR_WIDTH = 250;
  const pxPerHour = columnWidth / 24;

  useEffect(() => {
    setExpandedGroups({});
    setExpandedSubGroups({});
    setExpandedCenters({});
  }, [workCenterGroups]);

  const toggleGroup = (groupName) => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  const toggleSubGroup = (subGroupId) => setExpandedSubGroups(prev => ({ ...prev, [subGroupId]: !prev[subGroupId] }));
  const toggleCenter = (centerId) => setExpandedCenters(prev => ({ ...prev, [centerId]: !prev[centerId] }));

  useLayoutEffect(() => {
    if (!containerRef.current || routings.length === 0 || !selectedTask) {
      setLinks([]); // Reset links jika tidak ada task yang diklik
      return;
    }
    
    let animationFrameId;
    
    const calculateCoords = () => {
      try {
        const calculatedLinks = [];
        const boardRect = containerRef.current.getBoundingClientRect();

        // Hanya hitung relasi routing untuk task yang sedang dipilih (diklik)
        const relatedTasks = routings.filter(t => t.prod_order_no === selectedTask.prod_order_no);

        relatedTasks.forEach((task) => {
          const colorObj = getRpoColor(task.prod_order_no);
          const nextTask = relatedTasks.find(t => t.operation_no === task.operation_no + 10);

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
    <div className="bg-white rounded border border-gray-400 overflow-hidden shadow h-full flex flex-col" onClick={() => setSelectedTask(null)}>
      <div ref={containerRef} className="overflow-x-auto overflow-y-auto flex-1 relative custom-scrollbar">
        
        {/* SVG OVERLAYS UNTUK CONNECTION LINKS (HANYA MUNCUL SAAT DIKLIK) */}
        <svg className="absolute inset-0 pointer-events-none z-20 w-full h-full" style={{ minHeight: '100%' }}>
          {links.map((link) => (
            <line key={link.id} x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} stroke="#2563eb" strokeWidth="2.5" className="animate-pulse shadow-sm" />
          ))}
        </svg>

        <div className="inline-block min-w-full align-middle">
          
          <div className="sticky top-0 z-40 flex bg-gray-100 text-gray-800 font-sans border-b border-gray-300">
            <div className="sticky left-0 z-50 p-3 bg-gray-200 border-r border-gray-300 font-bold flex items-center justify-between shadow-md flex-shrink-0" style={{ width: SIDEBAR_WIDTH }}>
              <span className="flex items-center gap-2"><Settings size={16} /> Capacities</span>
            </div>

            <div className="flex flex-col flex-1">
              <div className="flex bg-slate-200 border-b border-gray-300">
                {dateList.map((d) => (
                  <div key={`m-${d.iso}`} style={{ width: `${columnWidth}px` }} className={`h-6 flex items-center text-[11px] px-1 font-bold ${d.isNewMonth ? 'border-l border-gray-400' : ''}`}>
                    <span className="truncate">{d.isNewMonth ? d.monthYear : ''}</span>
                  </div>
                ))}
              </div>
              <div className="flex bg-slate-100 border-b border-gray-200">
                {dateList.map((d) => (
                  <div key={`w-${d.iso}`} style={{ width: `${columnWidth}px` }} className={`h-6 flex items-center text-[11px] px-1 font-semibold ${d.isNewWeek ? 'border-l border-gray-300' : ''}`}>
                    <span className="truncate">{d.isNewWeek ? d.week : ''}</span>
                  </div>
                ))}
              </div>
              <div className="flex bg-white">
                {dateList.map((d) => {
                  const isHoliday = holidays.includes(d.iso);
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

          <div className="divide-y divide-gray-300 bg-slate-50">
            {workCenterGroups.map((group) => {
              const isGroupExpanded = expandedGroups[group.group_name];
              const groupedCenters = {};
              
              group.centers.forEach(center => {
                const prefix = center.center_id.substring(0, 2).toUpperCase();
                if (!groupedCenters[prefix]) groupedCenters[prefix] = [];
                groupedCenters[prefix].push(center);
              });

              return (
                <React.Fragment key={group.group_name}>
                  {/* LEVEL 1: GROUP */}
                  <div onClick={() => toggleGroup(group.group_name)} className="flex bg-slate-300 hover:bg-slate-400 cursor-pointer font-bold text-gray-800 transition-colors">
                    <div className="sticky left-0 z-30 p-2.5 border-r border-slate-400 flex items-center gap-2 flex-shrink-0 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                      {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="uppercase tracking-wide">{group.group_name}</span>
                    </div>
                    <div className="flex relative items-center py-1 flex-1">
                      {dateList.map(({ iso }) => (
                         <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-8 border-r flex-shrink-0 ${holidays.includes(iso) ? 'bg-slate-400/20 border-slate-400/30' : 'border-slate-300/30'}`} />
                      ))}
                    </div>
                  </div>

                  {/* LEVEL 2: SUB-GROUP */}
                  {isGroupExpanded && Object.entries(groupedCenters).map(([prefix, centers]) => {
                    const subGroupId = `${group.group_name}-${prefix}`;
                    const isSubGroupExpanded = expandedSubGroups[subGroupId];

                    return (
                      <React.Fragment key={subGroupId}>
                        <div onClick={() => toggleSubGroup(subGroupId)} className="flex bg-slate-200 hover:bg-slate-300 cursor-pointer font-semibold text-gray-800 transition-colors border-b border-gray-300">
                          <div className="sticky left-0 z-30 p-2 pl-6 border-r border-gray-300 flex items-center gap-2 flex-shrink-0 shadow-sm" style={{ width: SIDEBAR_WIDTH, backgroundColor: 'inherit' }}>
                            {isSubGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span className="uppercase">{prefix}</span>
                          </div>
                          <div className="flex relative items-center py-1 flex-1">
                            {dateList.map(({ iso }) => (
                              <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-8 border-r flex-shrink-0 ${holidays.includes(iso) ? 'bg-gray-300/30 border-gray-300' : 'border-gray-200'}`} />
                            ))}
                          </div>
                        </div>

                        {/* LEVEL 3: WORK CENTER DETAIL (RELEASED & SUMMARY WEIGHT) */}
                        {isSubGroupExpanded && centers.map((center) => {
                          const isCenterExpanded = expandedCenters[center.center_id];
                          
                          // Kalkulasi Total Weight untuk Work Center ini
                          const centerTasks = routings.filter(t => t.center_id === center.center_id);
                          const centerTotalWeight = centerTasks.reduce((acc, t) => acc + ((t.quantity || 0) * (t.weight || 1.5)), 0);

                          return (
                            <React.Fragment key={center.center_id}>
                              <div onClick={() => toggleCenter(center.center_id)} className="flex bg-white hover:bg-blue-50/40 cursor-pointer transition-colors border-b border-gray-200">
                                <div className="sticky left-0 z-30 p-2 pl-10 border-r border-gray-300 flex items-center justify-between flex-shrink-0 shadow-sm bg-white" style={{ width: SIDEBAR_WIDTH }}>
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    {isCenterExpanded ? <ChevronDown size={14} className="flex-shrink-0" /> : <ChevronRight size={14} className="flex-shrink-0" />}
                                    <span className="font-semibold text-gray-700 truncate">{center.center_name}</span>
                                  </div>
                                  {/* TAMPILAN SUMMARY WEIGHT */}
                                  <span className="text-[10px] text-gray-500 font-medium ml-2 mr-1 flex-shrink-0 whitespace-nowrap">
                                    {centerTotalWeight > 0 ? `(${centerTotalWeight.toLocaleString('id-ID')} kg)` : ''}
                                  </span>
                                </div>
                                
                                <div className="flex relative items-center py-1 flex-1">
                                  {dateList.map(({ iso }) => (
                                    <div key={iso} style={{ width: `${columnWidth}px` }} className={`h-8 border-r flex-shrink-0 ${holidays.includes(iso) ? 'bg-gray-100/50 border-gray-200' : 'border-gray-100'}`} />
                                  ))}

                                  {/* RENDER TASKS: HANYA STATUS 'RELEASED' */}
                                  {centerTasks
                                    .filter((task) => task.status !== "Firm Planned")
                                    .map((task) => (
                                      <TaskBar 
                                        key={task.id} task={task} startDate={startDate} 
                                        pxPerHour={pxPerHour} selectedTask={selectedTask} setSelectedTask={setSelectedTask} 
                                      />
                                    ))}
                                </div>
                              </div>

                              {/* LEVEL 4: STANDBY (FIRM PLANNED) */}
                              {isCenterExpanded && (
                                <div className="flex bg-green-100 border-b border-green-200">
                                  <div className="sticky left-0 z-30 p-2 pl-14 border-r border-green-200 flex-shrink-0 flex items-center shadow-sm bg-green-100" style={{ width: SIDEBAR_WIDTH }}>
                                    <span className="text-[11px] font-medium text-green-800">Standby (∞)</span>
                                  </div>

                                  <div className="flex relative items-center py-1 flex-1">
                                    {dateList.map(({ iso }) => (
                                      <div key={iso} style={{ width: `${columnWidth}px` }} className="h-10 border-r border-green-200/60 flex-shrink-0" />
                                    ))}

                                    {/* RENDER TASKS: HANYA STATUS 'FIRM PLANNED' */}
                                    {centerTasks
                                      .filter((task) => task.status === "Firm Planned")
                                      .map((task) => (
                                        <TaskBar 
                                          key={task.id} task={task} startDate={startDate} 
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
  );
};

export default function App() {
  const [currentView, setCurrentView] = useState('capacity'); 
  const [startDate, setStartDate] = useState(MOCK_START_DATE); // State Start Date
  const [endDate, setEndDate] = useState(MOCK_END_DATE);       // State End Date
  const [columnWidth, setColumnWidth] = useState(70); 
  const [loading, setLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  const [salesHierarchy, setSalesHierarchy] = useState([]);
  const [salesHolidays, setSalesHolidays] = useState([]);
  const [workCenterGroups, setWorkCenterGroups] = useState([]);
  const [routings, setRoutings] = useState([]);

  // Generate Date List Berdasarkan Start & End Date
  const dateList = generateDateList(startDate, endDate);

  const fetchData = async () => {
    setLoading(true);
    setIsFallback(false);
    
    // Pastikan format date aman untuk URL
    const cleanStart = startDate ? startDate.split('T')[0] : '2026-08-27';
    const cleanEnd = endDate ? endDate.split('T')[0] : '2026-09-26';
    
    try {
      const [salesRes, scheduleRes] = await Promise.all([
        axios.get(`/api/schedule/sales-orders?start_date=${cleanStart}&end_date=${cleanEnd}`),
        axios.get(`/api/schedule?start_date=${cleanStart}&end_date=${cleanEnd}`)
      ]);

      setSalesHierarchy(salesRes.data.hierarchy || []);
      setSalesHolidays(salesRes.data.holidays || []);
      setWorkCenterGroups(scheduleRes.data.workCenterGroups || []);
      setRoutings(scheduleRes.data.routings || []);
      
    } catch (err) {
      console.warn("API Request Failed. Switching to Mock Data Mode.", err);
      setIsFallback(true);
      
      setSalesHierarchy(MOCK_SALES.hierarchy);
      setSalesHolidays(MOCK_SALES.holidays);
      setWorkCenterGroups(MOCK_SCHEDULE.workCenterGroups);
      setRoutings(MOCK_SCHEDULE.routings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Validasi logic jika end date lebih kecil dari start date
    if (new Date(endDate) < new Date(startDate)) {
      setEndDate(startDate);
    }
    fetchData();
  }, [startDate, endDate]); // Trigger fetch saat start atau end date berubah

  const zoomIn = () => setColumnWidth(prev => Math.min(prev + 25, 300));
  const zoomOut = () => setColumnWidth(prev => Math.max(prev - 25, 45));
  const resetZoom = () => setColumnWidth(70);

  return (
    <div className="p-4 bg-gray-200 h-screen w-screen text-xs select-none font-sans flex flex-col overflow-hidden">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* TOOLBAR */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded shadow-sm border border-gray-300">
        <div className="flex items-center gap-4">
          
          {/* INPUT DATE RANGE */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded border border-gray-200">
            <Clock size={16} className="text-gray-500" />
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent font-semibold text-gray-700 focus:outline-none cursor-pointer"
              title="Start Date"
            />
            <span className="text-gray-400 font-bold">-</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent font-semibold text-gray-700 focus:outline-none cursor-pointer"
              title="End Date"
            />
          </div>
          
          <button onClick={fetchData} className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded border border-gray-300 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} /> Refresh
          </button>
          <div className="h-6 w-px bg-gray-300 mx-1" />
          <div className="flex bg-gray-100 p-1 rounded border border-gray-200 shadow-inner">
            <button 
              onClick={() => setCurrentView('sales')}
              className={`px-4 py-1 rounded text-sm font-medium transition-colors ${currentView === 'sales' ? 'bg-white shadow-sm text-blue-700 border border-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Sales Orders
            </button>
            <button 
              onClick={() => setCurrentView('capacity')}
              className={`px-4 py-1 rounded text-sm font-medium transition-colors ${currentView === 'capacity' ? 'bg-white shadow-sm text-blue-700 border border-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Capacity Scheduling
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isFallback && (
             <span className="text-orange-700 font-semibold text-[11px] bg-orange-100 px-2 py-1 rounded border border-orange-300 animate-pulse">
               API Offline (Using Mock)
             </span>
          )}
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded border border-gray-200">
            <span className="text-[11px] font-semibold text-gray-500 px-2 uppercase tracking-wider">Zoom</span>
            <button onClick={zoomOut} className="p-1.5 hover:bg-white rounded text-gray-700"><ZoomOut size={15} /></button>
            <button onClick={resetZoom} className="px-2 py-1 hover:bg-white rounded text-gray-700 text-[11px] font-medium flex items-center gap-1">
              <RotateCcw size={13} /> {Math.round((columnWidth / 70) * 100)}%
            </button>
            <button onClick={zoomIn} className="p-1.5 hover:bg-white rounded text-gray-700"><ZoomIn size={15} /></button>
          </div>
        </div>
      </div>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 overflow-hidden relative">
        {loading && salesHierarchy.length === 0 ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded border border-gray-300 shadow">
            <div className="flex flex-col items-center gap-3 bg-white p-6 rounded shadow-lg border border-gray-200">
              <RefreshCw size={32} className="animate-spin text-blue-600" />
              <p className="text-gray-600 font-bold text-sm">Synchronizing Schedule Data...</p>
            </div>
          </div>
        ) : null}
        
        {currentView === 'sales' ? (
          <SalesOrderView hierarchy={salesHierarchy} startDate={startDate} columnWidth={columnWidth} holidays={salesHolidays} dateList={dateList} />
        ) : (
          <SchedulingView workCenterGroups={workCenterGroups} routings={routings} startDate={startDate} columnWidth={columnWidth} holidays={salesHolidays} dateList={dateList} />
        )}
      </div>
    </div>
  );
}