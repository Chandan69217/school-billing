import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Save,
  CheckCircle,
  AlertCircle,
  Shield,
  Download,
  Upload,
  Clock,
  RotateCcw,
  Sliders,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.js';
import { SchoolLogo } from '../components/common/SchoolLogo.js';
import { DEFAULT_SCHOOL_LOGO } from '../config/logo.js';

export const SettingsPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'audit' | 'backup'>('profile');

  // Settings form state
  const [settings, setSettings] = useState<any>({
    schoolName: '',
    tagline: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    registrationNumber: '',
    principalName: '',
    receiptFooter: '',
    authorizedSignatory: '',
    currencySymbol: '₹',
    receiptPrefix: 'PBPS',
    lateFeeEnabled: false,
    lateFeeType: 'FIXED',
    lateFeeAmount: 50,
    lateFeeGraceDays: 10,
    requireDiscountApproval: true,
    requireCustomFeeApproval: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [resettingLogo, setResettingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.error(`Logo file must be less than 500 KB (selected: ${(file.size / 1024).toFixed(1)} KB)`);
      return;
    }

    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PNG, JPG, and JPEG images are allowed');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await apiClient.post('/settings/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        toast.success('School logo updated successfully');
        setSettings((prev: any) => ({ ...prev, logoUrl: res.data.data.logoUrl }));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleResetLogo = async () => {
    setResettingLogo(true);
    try {
      const res = await apiClient.post('/settings/reset-logo');
      if (res.data?.success) {
        toast.success('School logo reset to official default emblem');
        setSettings((prev: any) => ({ ...prev, logoUrl: res.data.data.logoUrl }));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset logo');
    } finally {
      setResettingLogo(false);
    }
  };

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Backup & restore state
  const [restoring, setRestoring] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiClient.get('/settings');
      if (res.data?.success && res.data?.data) {
        setSettings(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await apiClient.get('/system/audit-logs');
      if (res.data?.success) {
        setAuditLogs(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await apiClient.put('/settings', settings);
      if (res.data?.success) {
        setSaveMessage('School details and system parameters saved successfully!');
        toast.success('Settings saved successfully');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const res = await apiClient.get('/system/backup/export');
      if (res.data?.success) {
        const jsonStr = JSON.stringify(res.data.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `PBPS-Database-Backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Database backup exported and downloaded successfully');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to export backup');
    }
  };

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setRestoreConfirmOpen(true);
    }
  };

  const executeRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const text = await restoreFile.text();
      const backupData = JSON.parse(text);

      const res = await apiClient.post('/system/backup/restore', { backupData });
      if (res.data?.success) {
        toast.success('Database restored successfully from backup archive!');
        setRestoreConfirmOpen(false);
        setRestoreFile(null);
        fetchSettings();
      } else {
        toast.error(res.data?.message || 'Restore failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to parse or restore backup file');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-xs text-slate-400">Loading school configuration...</div>;
  }

  const isDirector = (user?.role as string) === 'SUPER_ADMIN' || (user?.role as string) === 'DIRECTOR';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            System Settings, Governance & Disaster Recovery
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure school profile, dynamic receipt prefix, late fee rules, audit trail, and one-click database backups.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 border border-slate-300/60 w-full sm:w-auto overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'profile'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            School Branding & Fees
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'audit'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit Trail
          </button>
          {isDirector && (
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'backup'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Backup & Recovery
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: SCHOOL BRANDING & FEE PARAMETERS */}
      {activeTab === 'profile' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 md:p-8 shadow-2xs">
          {saveMessage && (
            <div className="mb-4 sm:mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-semibold">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* School Logo & Brand Emblem Management (Part A1) */}
            <div className="p-4 sm:p-5 rounded-2xl border border-indigo-100 bg-linear-to-br from-indigo-50/50 via-white to-slate-50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-indigo-600 shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Official School Logo & Emblem</h2>
                    <p className="text-[11px] text-slate-500">
                      Single source of truth used across receipts, certificates, reports, PDFs, Excel exports, and UI.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-2xs transition-colors cursor-pointer">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadingLogo ? 'Uploading...' : 'Upload New Logo'}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".png,.jpg,.jpeg"
                      disabled={uploadingLogo || resettingLogo}
                      onChange={handleLogoUpload}
                    />
                  </label>

                  {settings.logoUrl && settings.logoUrl !== DEFAULT_SCHOOL_LOGO && settings.logoUrl !== '/school-logo.svg' && (
                    <button
                      type="button"
                      disabled={uploadingLogo || resettingLogo}
                      onClick={handleResetLogo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
                      title="Reset to default official PBPS emblem"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                      <span>{resettingLogo ? 'Resetting...' : 'Reset to Default'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Logo Preview against Light Theme */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <div className="h-16 w-16 p-1 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    <SchoolLogo size="lg" logoUrl={settings.logoUrl} className="h-14 w-14 object-contain" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Light Theme Preview</span>
                    <span className="text-xs font-bold text-slate-900 truncate block">Pragya Bharti Public School</span>
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {settings.logoUrl && settings.logoUrl !== DEFAULT_SCHOOL_LOGO && settings.logoUrl !== '/school-logo.svg'
                        ? 'Custom Logo Active'
                        : 'Official Emblem (Default)'}
                    </span>
                  </div>
                </div>

                {/* Logo Preview against Dark Background */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950 shadow-2xs text-white">
                  <div className="h-16 w-16 p-1 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                    <SchoolLogo size="lg" logoUrl={settings.logoUrl} className="h-14 w-14 object-contain" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Dark Theme Preview</span>
                    <span className="text-xs font-bold text-white truncate block">Pragya Bharti Public School</span>
                    <span className="text-[10px] font-bold text-amber-400 tracking-wider">Darkness to Light</span>
                  </div>
                </div>

                {/* Specifications Notice */}
                <div className="text-[11px] text-slate-500 space-y-1 bg-white/70 p-3 rounded-xl border border-slate-200/80">
                  <div className="font-bold text-slate-700">Logo Upload Specifications:</div>
                  <div>• Accepted formats: <strong>PNG, JPG, JPEG</strong></div>
                  <div>• Maximum file size: <strong>500 KB</strong> (enforced client & server)</div>
                  <div>• Transparency: Supported for crisp vector-like display</div>
                </div>
              </div>
            </div>

            {/* General Profile */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Building className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>School Identity & Location</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Official School Name</label>
                  <input
                    type="text"
                    required
                    value={settings.schoolName}
                    onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Motto / Tagline</label>
                  <input
                    type="text"
                    value={settings.tagline || ''}
                    onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Full Campus Address</label>
                <textarea
                  rows={2}
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Phone</label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Affiliation / Reg #</label>
                  <input
                    type="text"
                    value={settings.registrationNumber || ''}
                    onChange={(e) => setSettings({ ...settings, registrationNumber: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Receipt Numbering & Prefix */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>Receipt Numbering & Formatting</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Receipt Number Prefix (Default: PBPS)
                  </label>
                  <input
                    type="text"
                    value={settings.receiptPrefix || 'PBPS'}
                    onChange={(e) => setSettings({ ...settings, receiptPrefix: e.target.value.toUpperCase() })}
                    className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Format: PBPS-YYYY-0001</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Authorized Signatory Title</label>
                  <input
                    type="text"
                    value={settings.authorizedSignatory || ''}
                    onChange={(e) => setSettings({ ...settings, authorizedSignatory: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Currency Symbol</label>
                  <input
                    type="text"
                    value={settings.currencySymbol || '₹'}
                    onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Receipt Footer Disclaimer</label>
                <input
                  type="text"
                  value={settings.receiptFooter || ''}
                  onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-1.5 px-3 text-xs"
                />
              </div>
            </div>

            {/* Late Fee Policy (SRS Section 5: Default is DISABLED) */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-indigo-600 shrink-0" />
                  <span>Late Fee Rules & Overdue Penalties</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={settings.lateFeeEnabled || false}
                    onChange={(e) => setSettings({ ...settings, lateFeeEnabled: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-700">Enable Late Fee Penalty</span>
                </label>
              </h2>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs">
                <p className="text-[11px] text-slate-500 mb-3">
                  Default status is <strong>DISABLED</strong>. When activated by the Director, penalty will apply after the grace period past due dates.
                </p>

                {settings.lateFeeEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Penalty Mode</label>
                      <select
                        value={settings.lateFeeType || 'FIXED'}
                        onChange={(e) => setSettings({ ...settings, lateFeeType: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 py-1.5 px-2 bg-white"
                      >
                        <option value="FIXED">Fixed Amount (₹)</option>
                        <option value="PER_DAY">Per Day Overdue (₹/Day)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={settings.lateFeeAmount || 50}
                        onChange={(e) => setSettings({ ...settings, lateFeeAmount: parseFloat(e.target.value) })}
                        className="w-full rounded-lg border border-slate-200 py-1.5 px-2 bg-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Grace Days</label>
                      <input
                        type="number"
                        min="0"
                        value={settings.lateFeeGraceDays || 10}
                        onChange={(e) => setSettings({ ...settings, lateFeeGraceDays: parseInt(e.target.value, 10) })}
                        className="w-full rounded-lg border border-slate-200 py-1.5 px-2 bg-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Approval Governance (SRS Section 9) */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>Approval Governance & Discretion</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between cursor-pointer">
                  <div>
                    <div className="font-bold text-slate-800">Require Director Approval for Discounts</div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Fee concessions applied by counter staff remain PENDING until approved.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.requireDiscountApproval ?? true}
                    onChange={(e) => setSettings({ ...settings, requireDiscountApproval: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 mt-0.5"
                  />
                </label>

                <label className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between cursor-pointer">
                  <div>
                    <div className="font-bold text-slate-800">Require Approval for Custom Admission Fees</div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Discretionary rates entered for unconfigured classes require Director confirmation.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.requireCustomFeeApproval ?? true}
                    onChange={(e) => setSettings({ ...settings, requireCustomFeeApproval: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 mt-0.5"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: AUDIT LOG (SRS Section 9: Who changed what and when) */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Institutional Audit Trail</h2>
              <p className="text-xs text-slate-500">
                Immutable activity log for fee structure modifications, voided payments, user role changes, and authorizations.
              </p>
            </div>
            <button
              onClick={fetchAuditLogs}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
            >
              Refresh Logs
            </button>
          </div>

          {loadingLogs ? (
            <div className="py-16 text-center text-xs text-slate-400 animate-pulse">Loading audit trail...</div>
          ) : auditLogs.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500">No audit entries found.</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Resource</th>
                    <th className="py-3 px-4">Officer / User</th>
                    <th className="py-3 px-4">IP Address</th>
                    <th className="py-3 px-4">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{log.action}</td>
                      <td className="py-2.5 px-4 text-slate-700">{log.resource}</td>
                      <td className="py-2.5 px-4 font-semibold text-indigo-700">
                        {log.user?.fullName || log.userId || 'System'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">{log.ipAddress || 'Internal'}</td>
                      <td className="py-2.5 px-4 text-slate-600 text-[11px] max-w-xs truncate" title={log.details}>
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BACKUP AND RESTORE (SRS Section 9: Director only) */}
      {activeTab === 'backup' && isDirector && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Download className="h-4 w-4 text-indigo-600" />
                  <span>One-Click Database Export & Backup</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Download a full point-in-time JSON archive of student profiles, fee structures, payments, receipts, and permissions.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Export & Download Backup</span>
              </button>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              Archived records are encrypted in transit and saved directly to your local workstation. Maintain regular weekly backups.
            </div>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50/20 p-6 shadow-2xs space-y-4">
            <div className="pb-3 border-b border-rose-100">
              <h2 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                <Upload className="h-4 w-4 text-rose-600" />
                <span>Disaster Recovery: Restore Database Archive</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Upload a previously downloaded PBPS backup JSON archive to recover or roll back database records.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs">
                <Upload className="h-4 w-4 text-slate-500" />
                <span>Select Backup JSON Archive</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleRestoreFileSelected}
                />
              </label>
              <span className="text-xs text-slate-500">
                Supported format: UTF-8 PBPS Database Archive JSON
              </span>
            </div>
          </div>

          {/* Restore Confirmation Modal */}
          {restoreConfirmOpen && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-rose-600 font-bold text-sm pb-2 border-b border-slate-100">
                  <AlertCircle className="h-5 w-5" />
                  <span>Confirm Database Restoration</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You are about to restore database records from <strong>"{restoreFile?.name}"</strong>. This will reconcile existing fee structures, student ledgers, and transactions.
                </p>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  Make sure you have downloaded a current backup before executing a restore.
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreConfirmOpen(false);
                      setRestoreFile(null);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={restoring}
                    onClick={executeRestore}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
                  >
                    {restoring ? 'Restoring Database...' : 'Confirm & Execute Restore'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
