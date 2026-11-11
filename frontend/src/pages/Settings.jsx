import { useState, useEffect } from 'react';
import { KeyRound, UserPlus, Shield, UserCheck, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import axios from 'axios';

export default function Settings({ currentUser, onChangePassword }) {
  const [activeTab, setActiveTab] = useState('profile');

  // PostgreSQL User List State
  const [userList, setUserList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Change Password Form
  const [passForm, setPassForm] = useState({ oldPass: '', newPass: '', confirmPass: '' });
  const [passMessage, setPassMessage] = useState({ type: '', text: '' });

  // Add User Form
  const [newUser, setNewUser] = useState({ nik: '', name: '', role: 'production', password: '' });
  const [newUserMsg, setNewUserMsg] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // 1. Fetch users from PostgreSQL when the 'users' tab is active
  const fetchUsersFromDB = async () => {
    setLoadingUsers(true);
    try {
      const res = await axios.get('/api/users');
      if (res.data.status === 'success') {
        setUserList(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch user list:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && currentUser?.role?.toLowerCase() === 'admin') {
      fetchUsersFromDB();
    }
  }, [activeTab, currentUser]);

  // 2. Change Password Form Submit Handler
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passForm.newPass !== passForm.confirmPass) {
      setPassMessage({ type: 'error', text: 'New password and confirmation do not match!' });
      return;
    }

    const success = onChangePassword(currentUser.nik, passForm.oldPass, passForm.newPass);
    if (success) {
      setPassMessage({ type: 'success', text: 'Password updated successfully!' });
      setPassForm({ oldPass: '', newPass: '', confirmPass: '' });
    } else {
      setPassMessage({ type: 'error', text: 'Incorrect current password!' });
    }
  };

  // 3. Add New User to PostgreSQL (dwh_mfg_dev)
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.nik || !newUser.password) return;

    setSubmitLoading(true);
    setNewUserMsg('');

    try {
      const res = await axios.post('/api/users', {
        nik: newUser.nik,
        name: newUser.name,
        password: newUser.password,
        role: newUser.role
      });

      if (res.data.status === 'success') {
        setNewUserMsg('New user successfully added to PostgreSQL!');
        setNewUser({ nik: '', name: '', role: 'production', password: '' });
        fetchUsersFromDB(); // Refresh table
        setTimeout(() => setNewUserMsg(''), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add user');
    } finally {
      setSubmitLoading(false);
    }
  };

  // 4. Update User Role in PostgreSQL
  const handleRoleChange = async (nik, newRole) => {
    try {
      const res = await axios.put(`/api/users/${nik}/role`, {
        role: newRole
      });
      if (res.data.status === 'success') {
        setUserList(userList.map(u => u.nik === nik ? { ...u, role: newRole } : u));
      }
    } catch (err) {
      alert('Failed to update role: ' + (err.response?.data?.detail || err.message));
    }
  };

  // 5. Delete User from PostgreSQL (dwh_mfg_dev)
  const handleDeleteUser = async (targetNik) => {
    if (targetNik === currentUser?.nik) {
      alert('You cannot delete your own active account!');
      return;
    }

    if (!confirm(`Are you sure you want to delete user with NIK ${targetNik}?`)) {
      return;
    }

    try {
      const res = await axios.delete(`/api/users/${targetNik}`);
      if (res.data.status === 'success') {
        setUserList(userList.filter(u => u.nik !== targetNik));
      }
    } catch (err) {
      alert('Failed to delete user: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">System Settings & Access Control</h1>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 py-3 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <KeyRound size={18} /> Profile Security
        </button>

        {currentUser?.role?.toLowerCase() === 'admin' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 py-3 px-6 font-medium text-sm border-b-2 transition-colors ${activeTab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <UserCheck size={18} /> Manage Users & Roles (Admin)
          </button>
        )}
      </div>

      {/* PROFILE SECURITY TAB */}
      {activeTab === 'profile' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border max-w-md">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Change My Password</h2>

          {passMessage.text && (
            <div className={`p-3 rounded mb-4 text-sm ${passMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {passMessage.text}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={passForm.oldPass}
                onChange={(e) => setPassForm({ ...passForm, oldPass: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                required
                value={passForm.newPass}
                onChange={(e) => setPassForm({ ...passForm, newPass: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={passForm.confirmPass}
                onChange={(e) => setPassForm({ ...passForm, confirmPass: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700">
              Save New Password
            </button>
          </form>
        </div>
      )}

      {/* MANAGE USERS & ROLES TAB (ADMIN ONLY) */}
      {activeTab === 'users' && currentUser?.role?.toLowerCase() === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ADD USER FORM */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <UserPlus size={20} className="text-blue-600" /> Add New User
            </h2>

            {newUserMsg && (
              <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm flex items-center gap-2">
                <CheckCircle2 size={16} /> {newUserMsg}
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee NIK</label>
                <input
                  type="text"
                  required
                  value={newUser.nik}
                  onChange={(e) => setNewUser({ ...newUser, nik: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., 1004"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g., John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role/Access Level</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm capitalize"
                >
                  <option value="Admin">Admin</option>
                  <option value="User">User</option>
                  <option value="Production">Production</option>
                  <option value="Delivery">Delivery</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitLoading && <Loader2 size={16} className="animate-spin" />}
                {submitLoading ? 'Processing...' : 'Add User'}
              </button>
            </form>
          </div>

          {/* USER LIST TABLE */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Shield size={20} className="text-blue-600" /> Employee List & Access Permissions
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                    <th className="py-3 px-4">NIK</th>
                    <th className="py-3 px-4">Employee Name</th>
                    <th className="py-3 px-4">Current Role</th>
                    <th className="py-3 px-4">Role Action</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-500">
                        <Loader2 size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                        Loading employee data from PostgreSQL...
                      </td>
                    </tr>
                  ) : userList.map((u) => (
                    <tr key={u.nik} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono font-medium text-gray-900">{u.nik}</td>
                      <td className="py-3 px-4 text-gray-700">{u.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded capitalize">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.nik, e.target.value)}
                          className="border rounded px-2 py-1 text-xs capitalize"
                        >
                          <option value="Admin">Admin</option>
                          <option value="PPIC">PPIC</option>
                          <option value="Production">Production</option>
                          <option value="MT">MT</option>
                          <option value="Delivery">Delivery</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteUser(u.nik)}
                          title="Delete User"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}