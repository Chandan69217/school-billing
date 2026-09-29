import React, { useState, useEffect } from 'react';
import {
  Coins,
  Plus,
  Play,
  Calendar,
  AlertTriangle,
  Clock,
  Filter,
  CheckCircle2,
  Layers,
  ArrowRight,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client.js';

interface FeesPageProps {
  onOpenFeeCollection: (studentId?: string) => void;
}

export const FeesPage: React.FC<FeesPageProps> = ({ onOpenFeeCollection }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'generate' | 'structures' | 'types'>('pending');

  // Pending fees state
  const [pendingFees, setPendingFees] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [loadingPending, setLoadingPending] = useState(false);

  // Generate monthly fees state
  const [selectedYearId, setSelectedYearId] = useState('');
  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() + 1);
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  // Fee types state
  const [feeTypes, setFeeTypes] = useState<any[]>([]);
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCode, setNewTypeCode] = useState('');
  const [newTypeFreq, setNewTypeFreq] = useState('MONTHLY');

  // Fee structures state
  const [feeStructures, setFeeStructures] = useState<any[]>([]);

  // Initial load
  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const [yearsRes, classesRes, typesRes, structuresRes] = await Promise.all([
        apiClient.get('/academic-years'),
        apiClient.get('/classes'),
        apiClient.get('/fee-types'),
        apiClient.get('/fee-structures')
      ]);

      if (yearsRes.data?.success) {
        setAcademicYears(yearsRes.data.data);
        const active = yearsRes.data.data.find((y: any) => y.isActive);
        if (active) setSelectedYearId(active.id);
      }
      if (classesRes.data?.success) setClasses(classesRes.data.data);
      if (typesRes.data?.success) setFeeTypes(typesRes.data.data);
      if (structuresRes.data?.success) setFeeStructures(structuresRes.data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPendingFees = async () => {
    setLoadingPending(true);
    try {
      const params = new URLSearchParams();
      if (classFilter) params.append('classId', classFilter);
      const res = await apiClient.get(`/fees/pending?${params.toString()}`);
      if (res.data?.success) {
        setPendingFees(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingFees();
    }
  }, [activeTab, classFilter]);

  const handleGenerateMonthlyFees = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await apiClient.post('/fees/generate-monthly', {
        academicYearId: selectedYearId,
        month: generateMonth,
        year: generateYear
      });

      if (res.data?.success) {
        setGenerateResult(res.data.message);
        fetchPendingFees();
      } else {
        setGenerateResult(res.data?.message || 'Fee generation failed');
      }
    } catch (err: any) {
      setGenerateResult(err.response?.data?.message || 'Failed to generate fees');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateFeeType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName || !newTypeCode) return;
    try {
      const res = await apiClient.post('/fee-types', {
        name: newTypeName,
        code: newTypeCode,
        frequency: newTypeFreq
      });
      if (res.data?.success) {
        setFeeTypes([...feeTypes, res.data.data]);
        setShowAddTypeModal(false);
        setNewTypeName('');
        setNewTypeCode('');
        toast.success('Fee type created successfully');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create fee type');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Fee Structure & Generation Engine
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure tuition heads, define class fee matrices, run automated monthly billing runs, and monitor receivables.
          </p>
        </div>

        <button
          onClick={() => onOpenFeeCollection()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-2xs self-stretch sm:self-auto min-h-[42px] sm:min-h-[36px]"
        >
          <CreditCard className="h-4 w-4" />
          <span>Collect Student Fee</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-4 sm:gap-6 text-xs font-semibold overflow-x-auto whitespace-nowrap scrollbar-none">
        {[
          { id: 'pending', label: 'Pending & Overdue Receivables' },
          { id: 'generate', label: 'Automated Monthly Generation' },
          { id: 'structures', label: 'Class Fee Structures' },
          { id: 'types', label: 'Fee Heads & Frequencies' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 sm:py-3.5 border-b-2 transition-colors shrink-0 min-h-[44px] flex items-center ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Pending & Overdue Fees */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs font-bold text-slate-700 shrink-0">Filter Class:</span>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="rounded-lg border border-slate-200 py-1.5 px-3 text-xs bg-white w-full sm:w-auto min-h-[38px] sm:min-h-[auto]"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500">
              Total Outstanding Listed: <strong>{pendingFees.length} fee items</strong>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            {loadingPending ? (
              <div className="py-16 text-center text-xs text-slate-400 animate-pulse">
                Fetching pending fee ledger...
              </div>
            ) : pendingFees.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No outstanding pending fees found matching filter.
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[720px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Adm #</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Fee Head</th>
                      <th className="py-3 px-4 text-right">Net Amount</th>
                      <th className="py-3 px-4 text-right">Remaining Due</th>
                      <th className="py-3 px-4 text-center">Days Overdue</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingFees.map((fee) => (
                      <tr key={fee.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{fee.admissionNumber}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{fee.studentName}</div>
                          <div className="text-[10px] text-slate-400">{fee.parentPhone}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{fee.className} ({fee.sectionName})</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{fee.feeTitle}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          ₹{Number(fee.netAmount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-rose-600">
                          ₹{Number(fee.remainingAmount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {fee.daysOverdue > 0 ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                              {fee.daysOverdue} days
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Current</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            fee.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {fee.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onOpenFeeCollection(fee.studentId)}
                            className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px]"
                          >
                            Collect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Monthly Automated Generation */}
      {activeTab === 'generate' && (
        <div className="max-w-2xl bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Run Automated Monthly Fee Generator</h2>
            <p className="text-xs text-slate-500 mt-1">
              Computes and assigns monthly fee dues for all active students according to their class fee structure. Built-in idempotency prevents duplicate fee generation.
            </p>
          </div>

          <form onSubmit={handleGenerateMonthlyFees} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Academic Session</label>
              <select
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-white font-medium min-h-[42px]"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name} {y.isActive ? '(Active)' : ''}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Billing Month</label>
                <select
                  value={generateMonth}
                  onChange={(e) => setGenerateMonth(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-white min-h-[42px]"
                >
                  {[
                    '1 - January', '2 - February', '3 - March', '4 - April',
                    '5 - May', '6 - June', '7 - July', '8 - August',
                    '9 - September', '10 - October', '11 - November', '12 - December'
                  ].map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Year</label>
                <input
                  type="number"
                  value={generateYear}
                  onChange={(e) => setGenerateYear(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs font-mono min-h-[42px]"
                />
              </div>
            </div>

            {generateResult && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-900">
                {generateResult}
              </div>
            )}

            <button
              type="submit"
              disabled={generating}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs w-full sm:w-auto min-h-[44px]"
            >
              <Play className="h-4 w-4" />
              <span>{generating ? 'Processing Engine...' : 'Execute Fee Generation Batch'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Class Fee Structures */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {feeStructures.map((struct) => (
              <div key={struct.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{struct.title}</h3>
                    <p className="text-xs text-slate-500">
                      Class: <strong>{struct.class?.name}</strong> · Session: {struct.academicYear?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Annual Base</span>
                    <span className="text-sm font-bold text-indigo-700 font-mono">
                      ₹{Number(struct.totalAmount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2 text-xs">
                  {struct.items?.map((item: any) => (
                    <div key={item.id} className="py-1.5 flex justify-between">
                      <span className="text-slate-700 font-medium">{item.feeType?.name}</span>
                      <span className="text-slate-500 text-[11px]">
                        ₹{Number(item.amount).toLocaleString('en-IN')} / {item.frequency.toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Fee Heads */}
      {activeTab === 'types' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Standard Fee Heads</h3>
              <p className="text-xs text-slate-500">Configured tuition and activity charging heads</p>
            </div>
            <button
              onClick={() => setShowAddTypeModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              <span>Add Fee Head</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {feeTypes.map((ft) => (
              <div key={ft.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {ft.code}
                  </span>
                  <span className="text-[10px] font-semibold text-indigo-600">{ft.frequency}</span>
                </div>
                <div className="font-bold text-xs text-slate-900">{ft.name}</div>
                <div className="text-[11px] text-slate-500 line-clamp-2">{ft.description || 'Standard academic charge'}</div>
              </div>
            ))}
          </div>

          {/* Add Fee Type Modal */}
          {showAddTypeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
              <div className="w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto my-auto">
                <h3 className="text-base font-bold text-slate-900">Create New Fee Head</h3>
                <form onSubmit={handleCreateFeeType} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Fee Head Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Science Lab & Robotics Fee"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs min-h-[40px]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Code</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. ROBOT"
                        value={newTypeCode}
                        onChange={(e) => setNewTypeCode(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs uppercase font-mono min-h-[40px]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">Frequency</label>
                      <select
                        value={newTypeFreq}
                        onChange={(e) => setNewTypeFreq(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 py-2 px-3 text-xs bg-white min-h-[40px]"
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="ANNUAL">Annual</option>
                        <option value="ONE_TIME">One Time</option>
                        <option value="QUARTERLY">Quarterly</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddTypeModal(false)}
                      className="w-full sm:w-auto px-3.5 py-2.5 sm:py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 min-h-[42px] sm:min-h-[auto]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-4 py-2.5 sm:py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 min-h-[42px] sm:min-h-[auto]"
                    >
                      Save Fee Head
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
