
import React, { useRef, useState, useEffect } from 'react';
import { BarChart2, Maximize2, Minimize2 } from 'lucide-react';

export default function DashboardShiage() {
  // Tempel link 'Website or portal' Power BI kamu di bawah ini
  const powerBiEmbedUrl = "https://app.powerbi.com/reportEmbed?reportId=56efa002-f0e6-41b0-af72-2121f774f4cd&autoAuth=true&ctid=c723c6fc-a698-4825-b57a-3d548c250fff";

  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fungsi Toggle Full Screen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error(`Gagal masuk mode fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.error(`Gagal keluar mode fullscreen: ${err.message}`);
      });
    }
  };

  // Event listener untuk memantau jika pengguna menekan tombol ESC di keyboard
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <BarChart2 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard Shiage</h1>
            <p className="text-xs text-gray-500">Laporan terintegrasi Power BI</p>
          </div>
        </div>

        {/* Tombol Full Screen */}
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-2 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium border border-gray-200 transition-all hover:border-gray-300"
          title={isFullscreen ? "Keluar Fullscreen" : "Layar Penuh"}
        >
          {isFullscreen ? (
            <>
              <Minimize2 size={16} className="text-gray-600" />
              <span>Keluar Fullscreen</span>
            </>
          ) : (
            <>
              <Maximize2 size={16} className="text-gray-600" />
              <span>Full Screen</span>
            </>
          )}
        </button>
      </div>

      {/* Frame Power BI Container */}
      <div 
        ref={containerRef}
        className={`bg-white rounded-xl shadow-sm border border-gray-100 transition-all ${
          isFullscreen ? 'p-0 w-full h-full flex items-center justify-center bg-gray-900' : 'p-2 min-h-[750px]'
        }`}
      >
        {powerBiEmbedUrl && !powerBiEmbedUrl.includes("YOUR_REPORT_ID") ? (
          <iframe
            title="Dashboard Shiage"
            className={`w-full border-0 ${
              isFullscreen ? 'h-screen rounded-none' : 'h-[750px] rounded-lg'
            }`}
            src={powerBiEmbedUrl}
            allowFullScreen={true}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-[700px] text-gray-400">
            <p className="text-sm font-medium">Silakan paste link dari 'Website or portal' pada file DashboardShiage.jsx</p>
          </div>
        )}
      </div>
    </div>
  );
}