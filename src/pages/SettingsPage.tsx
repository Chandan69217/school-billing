import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Save,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client.js';

export const SettingsPage: React.FC = () => {
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
    currencySymbol: '₹'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/settings').then((res) => {
      if (res.data?.success && res.data?.data) {
        setSettings(res.data.data);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await apiClient.put('/settings', settings);
      if (res.data?.success) {
        setSaveMessage('School details and receipt branding saved successfully!');
        toast.success('School settings saved successfully');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-xs text-slate-400">Loading school configuration...</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Institutional Profile & Receipt Branding
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          These details are automatically printed on official A4 fee receipts, tax summaries, and PDF documents.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 md:p-8 shadow-2xs">
        {saveMessage && (
          <div className="mb-4 sm:mb-6 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-semibold">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{saveMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5 sm:space-y-6">
          {/* General School Profile */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Building className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>School Identity & Location</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Official School Name</label>
                <input
                  type="text"
                  required
                  value={settings.schoolName}
                  onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 text-xs font-semibold min-h-[42px] sm:min-h-[auto]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Motto / Tagline</label>
                <input
                  type="text"
                  value={settings.tagline || ''}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 text-xs min-h-[42px] sm:min-h-[auto]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Full Campus Address</label>
              <textarea
                rows={2}
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">School Contact Phone</label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 text-xs min-h-[42px] sm:min-h-[auto]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Finance / School Email</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 text-xs min-h-[42px] sm:min-h-[auto]"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-semibold text-slate-700 block mb-1">Website URL</label>
                <input
                  type="url"
                  value={settings.website || ''}
                  onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 text-xs min-h-[42px] sm:min-h-[auto]"
                />
              </div>
            </div>
          </div>

          {/* Receipt Customization */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Receipt & Regulatory Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Affiliation / Reg Number</label>
                <input
                  type="text"
                  value={settings.registrationNumber || ''}
                  onChange={(e) => setSettings({ ...settings, registrationNumber: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 text-xs font-mono min-h-[42px] sm:min-h-[auto]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Principal Name</label>
                <input
                  type="text"
                  value={settings.principalName || ''}
                  onChange={(e) => setSettings({ ...settings, principalName: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 text-xs min-h-[42px] sm:min-h-[auto]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Authorized Signatory Title</label>
                <input
                  type="text"
                  value={settings.authorizedSignatory || ''}
                  onChange={(e) => setSettings({ ...settings, authorizedSignatory: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 text-xs min-h-[42px] sm:min-h-[auto]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={settings.currencySymbol || '₹'}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 text-xs font-bold min-h-[42px] sm:min-h-[auto]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Receipt Disclaimer / Footer</label>
              <textarea
                rows={2}
                value={settings.receiptFooter || ''}
                onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                className="w-full rounded-lg border border-slate-200 py-2 sm:py-1.5 px-3 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs w-full sm:w-auto min-h-[44px]"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
