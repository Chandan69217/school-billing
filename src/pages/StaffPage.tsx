import React, { useState, useEffect } from 'react';
import {
  UserCog,
  Plus,
  Shield,
  KeyRound,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client.js';

export const StaffPage: React.FC = () => {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add staff modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    fullName: '',
    email: '',
    username: '',
    phone: '',
    role: 'STAFF',
    password: ''
  });

  // Reset password modal
  const [resetModalUserId, setResetModalUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/staff');
      if (res.data?.success) {
        setStaffList(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/staff', newStaff);
      if (res.data?.success) {
        setStaffList([res.data.data, ...staffList]);
        setShowAddModal(false);
        setNewStaff({
          fullName: '',
          email: '',
          username: '',
          phone: '',
          role: 'STAFF',
          password: ''
        });
        toast.success('Staff member added successfully');
      } else {
        toast.error(res.data?.message || 'Failed to add staff');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create staff');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await apiClient.put(`/staff/${id}/status`, { isActive: !currentStatus });
      if (res.data?.success) {
        setStaffList(staffList.map(s => s.id === id ? { ...s, isActive: !currentStatus } : s));
        toast.success(`Staff status ${!currentStatus ? 'activated' : 'deactivated'}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUserId || !newPassword) return;
    try {
      const res = await apiClient.put(`/staff/${resetModalUserId}/reset-password`, { newPassword });
      if (res.data?.success) {
        setResetSuccess(true);
        toast.success('Password updated successfully');
        setTimeout(() => {
          setResetModalUserId(null);
          setResetSuccess(false);
          setNewPassword('');
        }, 1500);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Password reset failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Staff & Role-Based Access Control (RBAC)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage administrative personnel, accountants, principals, admission coordinators, and system credentials.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs self-stretch sm:self-auto min-h-[42px] sm:min-h-[36px]"
        >
          <Plus className="h-4 w-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Staff Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
            Loading authorized staff directory...
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[650px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-3 sm:px-4">Staff Member</th>
                  <th className="py-3 px-3 sm:px-4">Username & Email</th>
                  <th className="py-3 px-3 sm:px-4">Assigned Role</th>
                  <th className="py-3 px-3 sm:px-4">Contact Phone</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Status</th>
                  <th className="py-3 px-3 sm:px-4">Last Activity</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 sm:px-4 font-bold text-slate-900">{s.fullName}</td>
                    <td className="py-3 px-3 sm:px-4">
                      <div className="font-medium text-slate-800">{s.email}</div>
                      <div className="text-[10px] text-slate-400 font-mono">@{s.username}</div>
                    </td>
                    <td className="py-3 px-3 sm:px-4">
                      <span className="font-semibold text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {s.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-slate-600 font-mono">{s.phone || 'N/A'}</td>
                    <td className="py-3 px-3 sm:px-4 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        s.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {s.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-slate-500">
                      {s.lastLoginAt
                        ? new Date(s.lastLoginAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : 'Never logged in'}
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setResetModalUserId(s.id);
                            setNewPassword('');
                            setResetSuccess(false);
                          }}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 rounded min-h-[36px] min-w-[36px] flex items-center justify-center"
                          title="Reset Password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleToggleStatus(s.id, s.isActive)}
                          className={`text-[11px] font-semibold px-2 py-1 rounded min-h-[36px] flex items-center ${
                            s.isActive ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {s.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <h3 className="text-base font-bold text-slate-900">Add Staff Account</h3>
            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 min-h-[40px] sm:min-h-[auto]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="ramesh@school.edu"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 min-h-[40px] sm:min-h-[auto]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="ramesh_c"
                    value={newStaff.username}
                    onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 font-mono min-h-[40px] sm:min-h-[auto]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">System Role</label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 bg-white min-h-[40px] sm:min-h-[auto]"
                  >
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="ADMISSION_STAFF">Admission Staff</option>
                    <option value="PRINCIPAL">Principal</option>
                    <option value="STAFF">General Staff</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 00000"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 min-h-[40px] sm:min-h-[auto]"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 min-h-[40px] sm:min-h-[auto]"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-full sm:w-auto px-3.5 py-2.5 sm:py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 min-h-[42px] sm:min-h-[auto]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-1.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 min-h-[42px] sm:min-h-[auto]"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <h3 className="text-sm font-bold text-slate-900">Reset Staff Password</h3>
            {resetSuccess ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg text-center">
                Password updated successfully!
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 min-h-[40px]"
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetModalUserId(null)}
                    className="w-full sm:w-auto px-3.5 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 min-h-[42px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 min-h-[42px]"
                  >
                    Save Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
