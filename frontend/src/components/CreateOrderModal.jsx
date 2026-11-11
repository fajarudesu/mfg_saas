import { useState } from 'react';
import { X, UploadCloud, Loader2 } from 'lucide-react';
import { createOrder } from '../api';

export default function CreateOrderModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [outerFile, setOuterFile] = useState(null);
  const [innerFile, setInnerFile] = useState(null);
  const [projectName, setProjectName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!outerFile && !innerFile) {
      setError('Please upload at least one standard list file');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      if (outerFile) formData.append('outer_file', outerFile);
      if (innerFile) formData.append('inner_file', innerFile);
      formData.append('project_name', projectName);

      await createOrder(formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-surface-200">
          <h2 className="text-xl font-semibold text-surface-900">Create New BOM</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-900 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">BOM ID</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Skyline Skyscraper Phase 1"
              className="w-full px-4 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">Standard List (Outer)</label>
              <div className="border border-dashed border-surface-300 rounded-lg p-4 text-center hover:bg-surface-50 transition-colors relative cursor-pointer group">
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(e) => setOuterFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <UploadCloud className="mx-auto h-6 w-6 text-surface-400 group-hover:text-primary-500 transition-colors mb-2" />
                <span className="text-xs text-surface-600 font-medium truncate block px-2">
                  {outerFile ? outerFile.name : 'Upload frame (.xls)'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">Standard List (Inner)</label>
              <div className="border border-dashed border-surface-300 rounded-lg p-4 text-center hover:bg-surface-50 transition-colors relative cursor-pointer group">
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(e) => setInnerFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <UploadCloud className="mx-auto h-6 w-6 text-surface-400 group-hover:text-primary-500 transition-colors mb-2" />
                <span className="text-xs text-surface-600 font-medium truncate block px-2">
                  {innerFile ? innerFile.name : 'Upload sash (.xls)'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
