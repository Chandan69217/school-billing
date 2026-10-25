import React, { useState, useEffect } from 'react';
import {
  UserCog,
  Plus,
  Shield,
  KeyRound,
  CheckCircle,
  XCircle,
  AlertCircle,
  Check,
  Save,
  RotateCcw,
  Sparkles,
  Users,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.js';

export const StaffPage: React.FC = () => {
  const { user: currentUser, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users');

  // Staff & User accounts
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add staff modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    fullName: '',
    email: '',
    username: '',
    phone: '',
    role: 'ADMISSION_STAFF',
    password: ''
  });

  // Reset password modal
  const [resetModalUserId, setResetModalUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Roles & Dynamic Permissions Matrix
  const [permissionsCatalog, setPermissionsCatalog] = useState<any[]>([]);
  const [roleMatrix, setRoleMatrix] = useState<Record<string, string[]>>({});
  const [selectedRoleForEdit, setSelectedRoleForEdit] = useState<string>('ACCOUNTANT');
  const [savingMatrix, setSavingMatrix] = useState(false);

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

  const fetchRolePermissions = async () => {
    try {
      const res = await apiClient.get('/roles/permissions');
      if (res.data?.success) {
        setPermissionsCatalog(res.data.data.permissions || []);
        setRoleMatrix(res.data.data.matrix || {});
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchRolePermissions();
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
          role: 'ADMISSION_STAFF',
          password: ''
        });
        toast.success('User account created successfully');
      } else {
        toast.error(res.data?.message || 'Failed to create user');
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
        toast.success(`Account status updated to ${!currentStatus ? 'Active' : 'Inactive'}`);
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
        }, 1200);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Password update failed');
    }
  };

  const togglePermissionForRole = (role: string, code: string) => {
    if (role === 'SUPER_ADMIN') {
      toast.info('Director has permanent full system access');
      return;
    }

    const currentPerms = roleMatrix[role] || [];
    const exists = currentPerms.includes(code);
    const updated = exists ? currentPerms.filter(c => c !== code) : [...currentPerms, code];

    setRoleMatrix({
      ...roleMatrix,
      [role]: updated
    });
  };

  const handleSaveRolePermissions = async (role: string) => {
    setSavingMatrix(true);
    try {
      const perms = roleMatrix[role] || [];
      const res = await apiClient.put('/roles/permissions', {
        role,
        permissions: perms
      });

      if (res.data?.success) {
        toast.success(`Permissions saved for ${getRoleDisplay(role)}`);
        await refreshUser(); // Real-time update in AuthContext
      } else {
        toast.error(res.data?.message || 'Failed to save permissions');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSavingMatrix(false);
    }
  };

  const getRoleDisplay = (roleKey: string) => {
    switch (roleKey) {
      case 'SUPER_ADMIN':
        return 'Director';
      case 'PRINCIPAL':
        return 'Principal / Management';
      case 'ACCOUNTANT':
        return 'Accountant';
      case 'ADMISSION_STAFF':
        return 'Admission Staff';
      case 'STAFF':
        return 'Teacher / Staff';
      default:
        return roleKey;
    }
  };

  // Group permissions by module
  const groupedPermissions: Record<string, any[]> = permissionsCatalog.reduce((acc: Record<string, any[]>, perm) => {
    const mod = perm.module || 'General';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(perm);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <UserCog className="h-6 w-6 text-indigo-600" />
            Roles & Staff Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure dynamic role permissions and manage user credentials for PBPS staff
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-stretch sm:self-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4" />
            Staff Accounts ({staffList.length})
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'permissions'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Roles & Permissions Matrix
          </button>
        </div>
      </div>

      {/* TAB 1: USERS & STAFF ACCOUNTS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active User Accounts
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Create User Account
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Name & Username</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Contact Info</th>
                    <th className="py-3 px-4">Collections Made</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
                        <div>Loading staff members...</div>
                      </td>
                    </tr>
                  ) : staffList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No staff members found.
                      </td>
                    </tr>
                  ) : (
                    staffList.map((staff) => (
                      <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{staff.fullName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">@{staff.username}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              staff.role === 'SUPER_ADMIN'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : staff.role === 'PRINCIPAL'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : staff.role === 'ACCOUNTANT'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : staff.role === 'ADMISSION_STAFF'
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            <Shield className="h-3 w-3" />
                            {getRoleDisplay(staff.role)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-800">{staff.email}</div>
                          <div className="text-[11px] text-slate-500">{staff.phone || 'No phone'}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {staff._count?.paymentsCollected || 0} receipts
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              staff.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {staff.isActive ? (
                              <>
                                <CheckCircle className="h-3 w-3 text-emerald-500" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 text-rose-500" />
                                Inactive
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setResetModalUserId(staff.id);
                                setNewPassword('');
                              }}
                              title="Reset Password"
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              Reset Key
                            </button>
                            {staff.role !== 'SUPER_ADMIN' && (
                              <button
                                onClick={() => handleToggleStatus(staff.id, staff.isActive)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  staff.isActive
                                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {staff.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & DYNAMIC PERMISSIONS MATRIX */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          {/* Role selector tabs */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(['PRINCIPAL', 'ACCOUNTANT', 'ADMISSION_STAFF', 'STAFF'] as const).map((rKey) => {
                const count = (roleMatrix[rKey] || []).length;
                const isSelected = selectedRoleForEdit === rKey;
                return (
                  <button
                    key={rKey}
                    onClick={() => setSelectedRoleForEdit(rKey)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{getRoleDisplay(rKey)}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {count} perms
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSaveRolePermissions(selectedRoleForEdit)}
                disabled={savingMatrix}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingMatrix ? 'Saving Changes...' : `Save ${getRoleDisplay(selectedRoleForEdit)} Permissions`}
              </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Changes take effect immediately across all active screens and backend APIs without code redeployment.
              Director maintains full access to all operations permanently.
            </span>
          </div>

          {/* Matrix by Module */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(groupedPermissions).map(([modName, perms]) => {
              const activeCount = perms.filter(p => (roleMatrix[selectedRoleForEdit] || []).includes(p.code)).length;
              const allChecked = activeCount === perms.length;

              return (
                <div key={modName} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 text-indigo-600" />
                        {modName}
                      </div>
                      <button
                        onClick={() => {
                          const current = roleMatrix[selectedRoleForEdit] || [];
                          let updated: string[];
                          if (allChecked) {
                            updated = current.filter(c => !perms.some(p => p.code === c));
                          } else {
                            const toAdd = perms.map(p => p.code).filter(c => !current.includes(c));
                            updated = [...current, ...toAdd];
                          }
                          setRoleMatrix({ ...roleMatrix, [selectedRoleForEdit]: updated });
                        }}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        {allChecked ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {perms.map((p) => {
                        const checked = (roleMatrix[selectedRoleForEdit] || []).includes(p.code);
                        return (
                          <label
                            key={p.code}
                            className={`flex items-start gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${
                              checked
                                ? 'bg-indigo-50/50 border-indigo-200'
                                : 'bg-slate-50/50 border-transparent hover:border-slate-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermissionForRole(selectedRoleForEdit, p.code)}
                              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-300"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 leading-tight">
                                {p.name}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                {p.description || p.code}
                              </div>
                              <span className="inline-block mt-1 text-[10px] font-mono text-slate-400">
                                {p.code}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Active in this module</span>
                    <span className="font-bold text-slate-600">{activeCount} / {perms.length}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREATE STAFF MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" />
              Create Staff / User Account
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a new staff member with credentials and assigned role
            </p>

            <form onSubmit={handleCreateStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="staff@pbps.edu.in"
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="ramesh_c"
                    value={newStaff.username}
                    onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="PRINCIPAL">Principal / Management</option>
                    <option value="ACCOUNTANT">Accountant</option>
                    <option value="ADMISSION_STAFF">Admission Staff</option>
                    <option value="STAFF">Teacher / Staff</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetModalUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              Reset Staff Password
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter a new secure password for this staff member
            </p>

            {resetSuccess ? (
              <div className="py-4 text-center text-emerald-600 flex flex-col items-center gap-2">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
                <span className="text-xs font-bold">Password Reset Successfully!</span>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetModalUserId(null)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Update Password
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
