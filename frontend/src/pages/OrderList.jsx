import { useState, useEffect } from 'react';
import { Package, Plus, FileSpreadsheet, Trash2 } from 'lucide-react';
import { getOrders, deleteOrder } from '../api';
import CreateOrderModal from '../components/CreateOrderModal';

export default function OrderList({ onSelectOrder }) {
  const [orders, setOrders] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this order?')) {
      await deleteOrder(id);
      loadOrders();
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 transition-colors duration-200">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-surface-900 dark:text-white">Breakdown Lists</h1>
          <p className="text-surface-500 dark:text-gray-400 mt-1">Manage standard lists and generate breakdown List outputs.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all hover:shadow hover:-translate-y-0.5"
        >
          <Plus size={20} />
          New Order BOM
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 dark:border-primary-400"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-surface-200 dark:border-gray-700 border-dashed transition-colors">
          <Package className="mx-auto h-12 w-12 text-surface-300 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-surface-900 dark:text-gray-200">No orders yet</h3>
          <p className="text-surface-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">Upload a standard list (.xls file) to get started with a new manufacturing list.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-6 text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
          >
            Create your first order
          </button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <div
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
              className="group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-surface-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-primary-300 dark:hover:border-primary-500 transition-all cursor-pointer relative"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="bg-primary-100 dark:bg-primary-900/40 p-3 rounded-xl text-primary-600 dark:text-primary-400 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                  <FileSpreadsheet size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-white truncate">
                    {order.project_name || 'Unnamed Order'}
                  </h3>
                  <p className="text-sm text-surface-500 dark:text-gray-400 font-medium truncate">
                    {order.series || 'MADELA'} • {order.elevation_code || '52T'}
                  </p>
                </div>
              </div>
              
              {/* KOTAK KECIL (INNER BOX) UNTUK SIZE & COLOR */}
              <div className="grid grid-cols-2 gap-4 text-sm bg-surface-50 dark:bg-gray-900/50 p-3 rounded-xl mb-4 border border-transparent dark:border-gray-700/50 transition-colors">
                <div>
                  <p className="text-surface-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Size (W×H)</p>
                  <p className="font-medium text-surface-900 dark:text-gray-100">{order.width} × {order.height}</p>
                </div>
                <div>
                  <p className="text-surface-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Color</p>
                  <p className="font-medium text-surface-900 dark:text-gray-100">{order.color || 'YK1N'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-surface-100 dark:border-gray-700 pt-4 mt-auto">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                  ${order.status === 'generated' 
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/50' 
                    : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/50'}`}>
                  <span className={`w-1.5 h-1.5 py-1 rounded-full ${order.status === 'generated' ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                  {order.status === 'generated' ? 'Generated' : 'Draft'}
                </span>
                
                <button
                  onClick={(e) => handleDelete(e, order.id)}
                  className="p-1.5 text-surface-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateOrderModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={loadOrders} 
      />
    </div>
  );
}