import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Construction, 
  ArrowLeft, 
  Clock, 
  CheckSquare, 
  ShieldAlert, 
  FileCheck2 
} from 'lucide-react';

export default function Inspection() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl p-8 sm:p-12 shadow-sm text-center relative overflow-hidden">
        
        {/* Background Decorative Accent */}
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-blue-500/10 dark:bg-blue-400/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-amber-500/10 dark:bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />

        {/* Development Icon Badge */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 mb-6 shadow-inner">
          <Construction size={40} className="animate-pulse" />
        </div>

        {/* Main Headings */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-3 tracking-wide uppercase">
          <Clock size={13} />
          <span>Work in Progress</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-3">
          Final Inspection is Under Development
        </h1>

        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-lg mx-auto leading-relaxed mb-8">
          This module is currently being built to ensure comprehensive quality control, defect reporting, and inspection verification standards. It will be released in an upcoming update.
        </p>

        {/* Feature Roadmap Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-8">
          <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-900/40">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <CheckSquare size={16} />
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">QC Checklist</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Automated pass/fail criteria per profile item.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-900/40">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
              <ShieldAlert size={16} />
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Defect Logs</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Scrap and rework tracking with photo evidence.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-900/40">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
              <FileCheck2 size={16} />
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">Certification</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Inspection sign-off & report export.
            </p>
          </div>
        </div>

        {/* Navigation Action */}
        <div className="flex justify-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 text-xs font-semibold shadow-sm transition-all"
          >
            <ArrowLeft size={16} />
            <span>Return to Previous Page</span>
          </button>
        </div>

      </div>
    </div>
  );
}