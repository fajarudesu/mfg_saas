
import { TrendingUp, Package, Settings, Truck, Activity, CheckCircle, Clock } from "lucide-react";



export default function Dashboard() {
  const stats = [
    { title: "Total Order In", value: "1,284", icon: Package, color: "text-blue-600", bg: "bg-blue-100" },
    { title: "In Production", value: "452", icon: Settings, color: "text-amber-600", bg: "bg-amber-100" },
    { title: "Ready to Ship", value: "128", icon: Truck, color: "text-emerald-600", bg: "bg-emerald-100" },
    { title: "Efficiency", value: "94%", icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-100" }
  ];

  const recentActivities = [
    { id: 'ORD-2026-882', status: 'Completed', time: '10 menit yang lalu', project: 'Project Alpha' },
    { id: 'ORD-2026-883', status: 'In Progress', time: '1 jam yang lalu', project: 'Project Beta' },
    { id: 'ORD-2026-884', status: 'Pending', time: '3 jam yang lalu', project: 'Theme Park 2026' },
    { id: 'ORD-2026-885', status: 'Completed', time: '5 jam yang lalu', project: 'Resort Phase 1' },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-blue-900">Dashboard Overview</h1>
        <p className="text-gray-500 font-medium text-sm mt-1">Ringkasan performa produksi hari ini.</p>
      </div>

      {/* STAT CARDS (Grid 4 Kolom) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-1">
              <div className={`p-4 rounded-lg ${stat.bg} ${stat.color}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-gray-500 text-sm font-semibold">{stat.title}</p>
                <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* KOLOM KIRI (Visualisasi Progres) - Memakan 2 kolom */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2">
              <Activity size={20} className="text-blue-600" />
              Target Produksi Mingguan
            </h2>
            <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">September 2026</span>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm font-medium mb-2">
                <span className="text-gray-700">Pemotongan Material (Cutting)</span>
                <span className="text-blue-600">85%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm font-medium mb-2">
                <span className="text-gray-700">Perakitan (Assembly)</span>
                <span className="text-amber-500">62%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: '62%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm font-medium mb-2">
                <span className="text-gray-700">Inspeksi Akhir (QC)</span>
                <span className="text-emerald-500">40%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: '40%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN (Aktivitas Terbaru) - Memakan 1 kolom */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-blue-900 mb-6 flex items-center gap-2">
            <Clock size={20} className="text-blue-600" />
            Aktivitas Terbaru
          </h2>
          
          <div className="space-y-5">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="mt-1">
                  {activity.status === 'Completed' ? (
                    <CheckCircle size={16} className="text-emerald-500" />
                  ) : activity.status === 'In Progress' ? (
                    <Settings size={16} className="text-amber-500 animate-spin-slow" />
                  ) : (
                    <Clock size={16} className="text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{activity.id}</p>
                  <p className="text-xs text-gray-500">{activity.project}</p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
          
          <button className="w-full mt-6 py-2 border border-blue-200 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors">
            Lihat Semua Log
          </button>
        </div>

      </div>
    </div>
  );
}