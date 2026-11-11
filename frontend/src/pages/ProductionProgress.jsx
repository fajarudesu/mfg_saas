import { Layers, Download } from 'lucide-react';

export default function ProductionProgress() {
  // Ini adalah template statis. Nanti Anda bisa menambahkan state dan axios
  // seperti pada halaman Order In Perline untuk menarik data dari database.

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      
      {/* HEADER PAGE */}
      <div className="flex items-center gap-3 border-b border-blue-200 pb-4">
        <div className="p-3 bg-blue-600 text-white rounded-lg shadow-sm">
          <Layers size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Production Progress</h1>
          <p className="text-blue-600/70 text-sm font-medium">Pemantauan status progres produksi secara real-time</p>
        </div>
      </div>

      {/* FILTER SECTION (Bisa disesuaikan nanti) */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden p-6 text-center">
        <p className="text-gray-500 italic">Area Filter Pencarian (Sedang disiapkan)</p>
      </div>

      {/* RESULT SECTION */}
      <div>
        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="font-semibold text-blue-900 flex items-center gap-2">
            Data Results 
          </h2>
          <button 
            disabled
            className="flex items-center gap-2 bg-white border border-blue-200 text-blue-300 px-4 py-2 rounded-lg text-sm font-semibold cursor-not-allowed shadow-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>

        {/* TABEL DATA */}
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden min-h-[300px] flex items-center justify-center">
           <p className="text-gray-400 font-medium">Data tabel akan muncul di sini setelah API dihubungkan.</p>
        </div>
      </div>
    </div>
  );
}