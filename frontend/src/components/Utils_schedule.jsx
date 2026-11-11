import React from 'react';

export const getRpoColor = (rpoNo) => {
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

export const dateToOffsetPixels = (targetDateStr, baseDateStr, pxPerHour) => {
  if (!targetDateStr) return 0;
  const cleanTarget = targetDateStr.replace(' ', 'T');
  const target = new Date(cleanTarget); 
  const base = new Date(baseDateStr);
  base.setHours(0, 0, 0, 0);
  const diffHours = (target - base) / (1000 * 60 * 60);
  return diffHours * pxPerHour;
};

export const getWeekNumber = (d) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

export const generateDateList = (startDateStr, endDateStr) => {
  const dates = [];
  const baseDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  let days = Math.ceil((endDate - baseDate) / (1000 * 60 * 60 * 24)) + 1;
  if (days < 1) days = 1; 

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

export const DynamicTimelineHeader = ({ columnWidth, dateList, holidays, theme = 'dark' }) => {
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