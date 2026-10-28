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
  Lock,
  Edit,
  Copy,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Phone,
  Mail,
  User
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

  // Edit staff modal
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'ADMISSION_STAFF',
    isActive: true,
    mustChangePassword: false
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Reset password modal
  const [resetStaff, setResetStaff] = useState<any | null>(null);
  const [resetMode, setResetMode] = useState<'generate' | 'manual'>('generate');
  const [manualPassword, setManualPassword] = useState('');
  const [showManualPassword, setShowManualPassword] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(true);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetResult, setResetResult] = useState<{
    temporaryPassword?: string;
    mustChangePassword?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const openEditModal = (staff: any) => {
    setEditingStaff(staff);
    setEditForm({
      fullName: staff.fullName || '',
      email: staff.email || '',
      phone: staff.phone || '',
      role: staff.role || 'STAFF',
      isActive: staff.isActive !== false,
      mustChangePassword: Boolean(staff.mustChangePassword)
    });
    setEditError(null);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    // Frontend guardrails check
    if (currentUser?.id === editingStaff.id && !editForm.isActive) {
      setEditError('You cannot deactivate your own account.');
      return;
    }

    if (currentUser?.id === editingStaff.id && currentUser?.role === 'SUPER_ADMIN' && editForm.role !== 'SUPER_ADMIN') {
      setEditError('You cannot change your own Super Admin role.');
      return;
    }

    setEditSaving(true);
    setEditError(null);

    try {
      const res = await apiClient.put(`/staff/${editingStaff.id}`, editForm);
      if (res.data?.success) {
        toast.success('Staff details updated successfully');
        setStaffList(prev => prev.map(s => s.id === editingStaff.id ? { ...s, ...res.data.data } : s));
        setEditingStaff(null);
        if (currentUser?.id === editingStaff.id) {
          await refreshUser();
        }
      } else {
        setEditError(res.data?.message || 'Failed to update staff member');
      }
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'An error occurred while saving staff details.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (currentUser?.id === id && currentStatus) {
      toast.error('You cannot deactivate your own account.');
      return;
    }

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

  const openResetModal = (staff: any) => {
    setResetStaff(staff);
    setResetMode('generate');
    setManualPassword('');
    setForcePasswordChange(true);
    setResetResult(null);
    setCopied(false);
  };

  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStaff) return;

    if (resetMode === 'manual') {
      if (!manualPassword || manualPassword.length < 8) {
        toast.error('Password must be at least 8 characters long');
        return;
      }
    }

    setResetSaving(true);
    try {
      const payload: any = {
        mustChangePassword: forcePasswordChange
      };

      if (resetMode === 'generate') {
        payload.generateRandom = true;
      } else {
        payload.newPassword = manualPassword;
      }

      const res = await apiClient.put(`/staff/${resetStaff.id}/reset-password`, payload);
      if (res.data?.success) {
        setResetResult(res.data.data);
        toast.success('Password successfully reset');
        // Refresh staff list
        setStaffList(prev => prev.map(s => s.id === resetStaff.id ? { ...s, mustChangePassword: forcePasswordChange } : s));
      } else {
        toast.error(res.data?.message || 'Password update failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Password update failed');
    } finally {
      setResetSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Password copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
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
        await refreshUser();
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
        return 'Director (Super Admin)';
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
            Configure dynamic role permissions and manage user accounts & credentials for PBPS staff
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-stretch sm:self-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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
              Staff & User Directory
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Create Staff Account
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
                    <th className="py-3 px-4">Security Status</th>
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
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {staff.fullName}
                            {currentUser?.id === staff.id && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.2 rounded-full">
                                You
                              </span>
                            )}
                          </div>
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
                          <div className="text-[11px] text-slate-500">{staff.phone || 'No phone recorded'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1 items-start">
                            {staff.mustChangePassword ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                Force Change Pending
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                Password Active
                              </span>
                            )}
                            {staff.failedPasswordAttempts > 0 && (
                              <span className="text-[10px] text-slate-400">
                                {staff.failedPasswordAttempts} failed attempt(s)
                              </span>
                            )}
                          </div>
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
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button */}
                            <button
                              onClick={() => openEditModal(staff)}
                              title="Edit Staff Details"
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              Edit
                            </button>

                            {/* Reset Password Button */}
                            <button
                              onClick={() => openResetModal(staff)}
                              title="Reset Password"
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                              Reset Key
                            </button>

                            {/* Quick Activate/Deactivate Toggle */}
                            {staff.id !== currentUser?.id && (
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
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{getRoleDisplay(rKey)}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                        isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {count} perms
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handleSaveRolePermissions(selectedRoleForEdit)}
              disabled={savingMatrix}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingMatrix ? 'Saving Changes...' : 'Save Permissions'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(groupedPermissions).map(([mod, perms]) => (
              <div key={mod} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    {mod} Module
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {perms.length} capabilities
                  </span>
                </div>

                <div className="space-y-2 flex-1">
                  {perms.map((p) => {
                    const isChecked = (roleMatrix[selectedRoleForEdit] || []).includes(p.code);
                    return (
                      <label
                        key={p.code}
                        className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePermissionForRole(selectedRoleForEdit, p.code)}
                          className="mt-0.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-slate-800 leading-tight">
                            {p.name}
                          </div>
                          {p.description && (
                            <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                              {p.description}
                            </div>
                          )}
                          <div className="text-[10px] font-mono text-indigo-500 mt-0.5">
                            {p.code}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE STAFF MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Create Staff Account
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a new staff member with dedicated credentials and role permissions
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
                    <option value="SUPER_ADMIN">Director (Super Admin)</option>
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
                  placeholder="Minimum 8 characters"
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

      {/* EDIT STAFF DETAILS MODAL */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Edit className="h-5 w-5 text-blue-600" />
              Update Staff Details
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Editing profile and role for <strong className="text-slate-800">@{editingStaff.username}</strong>
            </p>

            {editError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-red-700 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStaff} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned System Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  disabled={editingStaff.id === currentUser?.id && currentUser?.role === 'SUPER_ADMIN'}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="SUPER_ADMIN">Director (Super Admin)</option>
                  <option value="PRINCIPAL">Principal / Management</option>
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="ADMISSION_STAFF">Admission Staff</option>
                  <option value="STAFF">Teacher / Staff</option>
                </select>
                {editingStaff.id === currentUser?.id && currentUser?.role === 'SUPER_ADMIN' && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    You cannot change your own Super Admin role.
                  </p>
                )}
              </div>

              {/* Status & Options Checkboxes */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    disabled={editingStaff.id === currentUser?.id}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Account Active</span>
                    {editingStaff.id === currentUser?.id && (
                      <span className="text-[10px] text-slate-400 block">(Cannot deactivate your own account)</span>
                    )}
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.mustChangePassword}
                    onChange={(e) => setEditForm({ ...editForm, mustChangePassword: e.target.checked })}
                    className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-700">Require password change on next login</span>
                    <span className="text-[10px] text-slate-400 block">Blocks user until they configure a new password</span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  disabled={editSaving}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPGRADED RESET PASSWORD MODAL */}
      {resetStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-amber-600" />
              Reset Staff Password
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Reset login key for <strong className="text-slate-800">{resetStaff.fullName}</strong> (@{resetStaff.username})
            </p>

            {resetResult ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    New Password Successfully Generated
                  </div>
                  <p className="text-xs text-slate-600">
                    Provide this temporary password to the staff member. All previous sessions have been invalidated.
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2 p-3 bg-white rounded-xl border border-emerald-300">
                    <span className="font-mono text-sm font-black text-slate-800 tracking-wider">
                      {resetResult.temporaryPassword}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(resetResult.temporaryPassword || '')}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>

                  {resetResult.mustChangePassword && (
                    <div className="text-[11px] text-amber-700 font-medium pt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      User will be required to change this password on their next sign-in.
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResetStaff(null);
                      setResetResult(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleExecuteResetPassword} className="space-y-4">
                {/* Method selector */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setResetMode('generate')}
                    className={`py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      resetMode === 'generate' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetMode('manual')}
                    className={`py-2 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      resetMode === 'manual' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Custom Password
                  </button>
                </div>

                {resetMode === 'generate' ? (
                  <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-xl text-xs text-blue-900 leading-relaxed">
                    A cryptographically strong 12-character password (with uppercase, lowercase, numbers, and symbols) will be created and displayed for you to copy.
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Enter Custom Password (min 8 chars)
                    </label>
                    <div className="relative">
                      <input
                        type={showManualPassword ? 'text' : 'password'}
                        required
                        value={manualPassword}
                        onChange={(e) => setManualPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 pr-10 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowManualPassword(!showManualPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showManualPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forcePasswordChange}
                      onChange={(e) => setForcePasswordChange(e.target.checked)}
                      className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-700">Require password change on next login</span>
                      <span className="text-[10px] text-slate-400 block">Strongly recommended for newly reset credentials</span>
                    </div>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setResetStaff(null)}
                    disabled={resetSaving}
                    className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetSaving}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {resetSaving ? 'Processing...' : resetMode === 'generate' ? 'Generate & Reset' : 'Set Password'}
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
