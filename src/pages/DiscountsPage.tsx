import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag,
  Percent,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  ShieldAlert,
  Sparkles,
  Layers,
  FileCheck,
  Calendar,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.js';

interface DiscountRule {
  id: string;
  name: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  applicableFeeHeads?: string;
  applicableClasses?: string;
  category: string;
  frequency: string;
  selectedMonths?: string;
  maxCapPerStudent?: number;
  isStackable: boolean;
  requiresApproval: boolean;
  isActive: boolean;
  isDeleted: boolean;
  deletedReason?: string;
  activeAssignmentsTreatment?: string;
  description?: string;
  _count?: {
    applications: number;
  };
}

export const DiscountsPage: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'rules' | 'students' | 'approvals'>('rules');

  // Search & Filters
  const [ruleSearch, setRuleSearch] = useState('');
  const [showDeletedRules, setShowDeletedRules] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Modals
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<DiscountRule | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [activeTreatment, setActiveTreatment] = useState<'END_FROM_MONTH' | 'KEEP'>('END_FROM_MONTH');
  const [deleteEndMonth, setDeleteEndMonth] = useState(new Date().getMonth() + 1);

  // Assign Concession Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedStudentForAssign, setSelectedStudentForAssign] = useState('');
  const [assignRuleId, setAssignRuleId] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [effectiveMonth, setEffectiveMonth] = useState(new Date().getMonth() + 1);
  const [endMonth, setEndMonth] = useState('');
  const [assignRemarks, setAssignRemarks] = useState('');

  // Sibling Detector
  const [siblingSearchStudentId, setSiblingSearchStudentId] = useState('');
  const [siblingResults, setSiblingResults] = useState<any | null>(null);

  // Form State
  const [ruleForm, setRuleForm] = useState({
    name: '',
    code: '',
    type: 'PERCENTAGE',
    value: '',
    category: 'Sibling',
    applicableFeeHeads: ['TUIT'],
    maxCapPerStudent: '',
    isStackable: true,
    requiresApproval: false,
    description: ''
  });

  // Queries
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['discountRules', showDeletedRules],
    queryFn: async () => {
      const res = await apiClient.get(`/discounts/rules?includeDeleted=${showDeletedRules}`);
      return res.data?.data || [];
    }
  });

  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ['pendingDiscounts'],
    queryFn: async () => {
      const res = await apiClient.get('/discounts/pending');
      return res.data?.data || [];
    }
  });

  const { data: studentsList = [] } = useQuery({
    queryKey: ['studentsCompact'],
    queryFn: async () => {
      const res = await apiClient.get('/students?limit=250');
      return res.data?.data?.students || [];
    }
  });

  // Mutations
  const createOrUpdateRuleMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingRule) {
        return apiClient.put(`/discounts/rules/${editingRule.id}`, payload);
      }
      return apiClient.post('/discounts/rules', payload);
    },
    onSuccess: () => {
      toast.success(editingRule ? 'Rule updated' : 'Discount rule created');
      queryClient.invalidateQueries({ queryKey: ['discountRules'] });
      setIsRuleModalOpen(false);
      setEditingRule(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save rule');
    }
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async () => {
      return apiClient.delete(`/discounts/rules/${ruleToDelete?.id}`, {
        data: {
          reason: deleteReason,
          activeAssignmentsTreatment: activeTreatment,
          endMonth: deleteEndMonth,
          endYear: new Date().getFullYear()
        }
      });
    },
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Discount rule archived');
      queryClient.invalidateQueries({ queryKey: ['discountRules'] });
      setIsDeleteModalOpen(false);
      setRuleToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete rule');
    }
  });

  const restoreRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.post(`/discounts/rules/${id}/restore`);
    },
    onSuccess: () => {
      toast.success('Discount rule restored to active catalog');
      queryClient.invalidateQueries({ queryKey: ['discountRules'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to restore');
    }
  });

  const assignDiscountMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post(`/discounts/students/${payload.studentId}/assign`, payload);
    },
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Concession assigned to student');
      setIsAssignModalOpen(false);
      setSelectedStudentForAssign('');
      setAssignRemarks('');
      setCustomAmount('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to assign concession');
    }
  });

  const approveDiscountMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) => {
      return apiClient.put(`/discounts/requests/${id}`, { status });
    },
    onSuccess: () => {
      toast.success('Discount request processed');
      queryClient.invalidateQueries({ queryKey: ['pendingDiscounts'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  });

  const checkSiblingsMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await apiClient.get(`/discounts/students/${studentId}/siblings`);
      return res.data?.data;
    },
    onSuccess: (data) => {
      setSiblingResults(data);
      if (data?.siblingsFound > 0) {
        toast.success(`Found ${data.siblingsFound} sibling(s) in database!`);
      } else {
        toast.info('No siblings detected sharing parent phone or contact.');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to check siblings');
    }
  });

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const filteredRules = rules.filter((r: DiscountRule) => {
    const matchCategory = selectedCategoryFilter === 'ALL' || r.category === selectedCategoryFilter;
    const matchSearch = r.name.toLowerCase().includes(ruleSearch.toLowerCase()) ||
      (r.code && r.code.toLowerCase().includes(ruleSearch.toLowerCase()));
    return matchCategory && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Tag className="h-7 w-7 text-indigo-600" />
            Fee Concessions & Discounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dynamic concession rules, automatic sibling detection, soft-delete with active assignment treatment, and administrative approvals.
          </p>
        </div>

        {hasPermission('discount.manage') && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setEditingRule(null);
                setRuleForm({
                  name: '',
                  code: '',
                  type: 'PERCENTAGE',
                  value: '',
                  category: 'Sibling',
                  applicableFeeHeads: ['TUIT'],
                  maxCapPerStudent: '',
                  isStackable: true,
                  requiresApproval: false,
                  description: ''
                });
                setIsRuleModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Concession Rule
            </button>
            <button
              onClick={() => {
                setSelectedStudentForAssign('');
                setAssignRuleId(rules[0]?.id || '');
                setCustomAmount('');
                setEffectiveMonth(new Date().getMonth() + 1);
                setEndMonth('');
                setAssignRemarks('');
                setIsAssignModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Users className="h-4 w-4 text-slate-500" />
              Assign Concession
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'rules'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Tag className="h-4 w-4" />
            Concession Rules Master ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'students'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            Sibling Detector & Assignments
          </button>
          {hasPermission('discount.approve') && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'approvals'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <FileCheck className="h-4 w-4" />
              Pending Approvals
              {pendingApprovals.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  {pendingApprovals.length}
                </span>
              )}
            </button>
          )}
        </nav>
      </div>

      {/* TAB 1: Rules Master */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search rule name or code..."
                value={ruleSearch}
                onChange={(e) => setRuleSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDeletedRules}
                  onChange={(e) => setShowDeletedRules(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 rounded border-slate-300"
                />
                Show Archived / Deleted Rules
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRules.map((rule: DiscountRule) => (
              <div
                key={rule.id}
                className={`bg-white rounded-xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                  rule.isDeleted ? 'border-slate-300 bg-slate-50/70 opacity-75' : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                      {rule.category}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {rule.isDeleted ? (
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[11px] font-bold">
                          Archived
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mt-2.5">{rule.name}</h3>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">Code: {rule.code}</div>

                  <div className="mt-4 p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Concession Value:</span>
                      <strong className="text-slate-900 font-extrabold text-sm">
                        {rule.type === 'PERCENTAGE' ? `${rule.value}%` : `₹${rule.value}`}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Applicable Heads:</span>
                      <strong className="text-slate-800">{rule.applicableFeeHeads || 'ALL FEEDS'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Stackable:</span>
                      <span className={rule.isStackable ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                        {rule.isStackable ? 'Yes (Can combine)' : 'No (Exclusive)'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Requires Approval:</span>
                      <span className={rule.requiresApproval ? 'text-amber-700 font-medium' : 'text-slate-500'}>
                        {rule.requiresApproval ? 'Yes (Director/Principal)' : 'Auto-approved'}
                      </span>
                    </div>
                  </div>

                  {rule.isDeleted && rule.deletedReason && (
                    <div className="mt-3 p-2 bg-rose-50 border border-rose-100 rounded text-[11px] text-rose-800">
                      <strong>Archived Reason:</strong> {rule.deletedReason}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Usage: <strong>{rule._count?.applications || 0} students</strong></span>

                  <div className="flex items-center gap-1">
                    {!rule.isDeleted ? (
                      <>
                        {hasPermission('discount.manage') && (
                          <button
                            onClick={() => {
                              setEditingRule(rule);
                              setRuleForm({
                                name: rule.name,
                                code: rule.code,
                                type: rule.type,
                                value: rule.value.toString(),
                                category: rule.category,
                                applicableFeeHeads: rule.applicableFeeHeads ? rule.applicableFeeHeads.split(',') : ['TUIT'],
                                maxCapPerStudent: rule.maxCapPerStudent ? rule.maxCapPerStudent.toString() : '',
                                isStackable: rule.isStackable,
                                requiresApproval: rule.requiresApproval,
                                description: rule.description || ''
                              });
                              setIsRuleModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                            title="Edit Rule"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {hasPermission('discount.delete') && (
                          <button
                            onClick={() => {
                              setRuleToDelete(rule);
                              setDeleteReason('');
                              setActiveTreatment('END_FROM_MONTH');
                              setDeleteEndMonth(new Date().getMonth() + 1);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 text-rose-400 hover:text-rose-600 rounded"
                            title="Delete / Archive Rule"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    ) : (
                      hasPermission('discount.manage') && (
                        <button
                          onClick={() => restoreRuleMutation.mutate(rule.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Sibling Detector & Student Assignments */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          {/* Sibling Detector Tool */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-lg shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-base">Automatic Sibling Concession Detector</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Scan the database for real-time enrolled siblings by parent phone numbers or guardian relations to automatically recommend 2nd/3rd child concession rules.
                </p>

                <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl">
                  <select
                    value={siblingSearchStudentId}
                    onChange={(e) => setSiblingSearchStudentId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Student to Scan --</option>
                    {studentsList.map((st: any) => (
                      <option key={st.id} value={st.id}>
                        {st.admissionNumber} - {st.firstName} {st.lastName}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      if (!siblingSearchStudentId) {
                        toast.error('Please select a student');
                        return;
                      }
                      checkSiblingsMutation.mutate(siblingSearchStudentId);
                    }}
                    disabled={checkSiblingsMutation.isPending || !siblingSearchStudentId}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    {checkSiblingsMutation.isPending ? 'Scanning...' : 'Scan for Siblings'}
                  </button>
                </div>
              </div>
            </div>

            {/* Sibling Scan Results */}
            {siblingResults && (
              <div className="mt-4 pt-4 border-t border-indigo-100 space-y-3">
                <div className="text-xs font-bold text-slate-700">
                  Target Student: <span className="text-indigo-700">{siblingResults.targetStudent?.name}</span> ({siblingResults.targetStudent?.admissionNumber})
                </div>

                {siblingResults.siblingsFound === 0 ? (
                  <div className="p-3 bg-white/70 rounded-lg text-xs text-slate-500 border border-indigo-100">
                    No active siblings found with matching contact credentials.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-emerald-800">
                      Enrolled Siblings Found ({siblingResults.siblingsFound}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {siblingResults.siblings.map((s: any) => (
                        <div key={s.id} className="p-3 bg-white rounded-lg border border-indigo-200 shadow-2xs text-xs space-y-1">
                          <div className="font-bold text-slate-900">{s.fullName} ({s.admissionNumber})</div>
                          <div className="text-slate-500">Class: <strong>{s.className}</strong> | Phone: {s.phone}</div>
                          {s.activeDiscounts?.length > 0 && (
                            <div className="text-purple-700 font-medium">Active: {s.activeDiscounts.join(', ')}</div>
                          )}
                        </div>
                      ))}
                    </div>

                    {siblingResults.suggestedRules?.length > 0 && (
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 mt-2">
                        <div className="font-bold text-emerald-900 text-xs mb-1">
                          Recommended Sibling Concession:
                        </div>
                        {siblingResults.suggestedRules.map((sr: any) => (
                          <div key={sr.id} className="flex items-center justify-between text-xs text-emerald-800">
                            <span>{sr.name} ({sr.type === 'PERCENTAGE' ? `${sr.value}%` : `₹${sr.value}`})</span>
                            <button
                              onClick={() => {
                                setSelectedStudentForAssign(siblingResults.targetStudent.id);
                                setAssignRuleId(sr.id);
                                setAssignRemarks(`Auto-detected sibling of ${siblingResults.siblings[0]?.fullName}`);
                                setIsAssignModalOpen(true);
                              }}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs"
                            >
                              Apply to Student
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Approvals */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Concession Name</th>
                  <th className="py-3 px-4">Amount / %</th>
                  <th className="py-3 px-4">Reason / Remarks</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingApprovals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No discount requests pending administrative approval.
                    </td>
                  </tr>
                ) : (
                  pendingApprovals.map((req: any) => (
                    <tr key={req.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {req.studentId}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {req.discountName}
                      </td>
                      <td className="py-3 px-4 font-bold text-indigo-600">
                        ₹{Number(req.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {req.reason || 'Concession request'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {new Date(req.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => approveDiscountMutation.mutate({ id: req.id, status: 'APPROVED' })}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => approveDiscountMutation.mutate({ id: req.id, status: 'REJECTED' })}
                            className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Rule */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingRule ? 'Edit Concession Rule' : 'Create New Concession Rule'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createOrUpdateRuleMutation.mutate({
                  ...ruleForm,
                  value: parseFloat(ruleForm.value)
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rule Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sibling Discount (2nd Child)"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rule Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SIBLING-25"
                    value={ruleForm.code}
                    onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type *</label>
                  <select
                    value={ruleForm.type}
                    onChange={(e) => setRuleForm({ ...ruleForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Value *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder={ruleForm.type === 'PERCENTAGE' ? '25' : '500'}
                    value={ruleForm.value}
                    onChange={(e) => setRuleForm({ ...ruleForm, value: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={ruleForm.category}
                    onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Sibling">Sibling</option>
                    <option value="Staff Ward">Staff Ward</option>
                    <option value="Scholarship">Scholarship</option>
                    <option value="Merit">Merit</option>
                    <option value="Need-Based">Need-Based</option>
                    <option value="Management Discretion">Management Discretion</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Applicable Fee Heads (Multi-Select)
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    { label: 'Tuition Fee (TUIT)', code: 'TUIT' },
                    { label: 'Computer Fee (COMP)', code: 'COMP' },
                    { label: 'Transport Fee (TRANS)', code: 'TRANS' },
                    { label: 'Term Fee (TERM)', code: 'TERM' },
                    { label: 'Hostel Fee (HOSTEL)', code: 'HOSTEL' }
                  ].map((head) => (
                    <label key={head.code} className="flex items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ruleForm.applicableFeeHeads.includes(head.code)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setRuleForm({
                            ...ruleForm,
                            applicableFeeHeads: checked
                              ? [...ruleForm.applicableFeeHeads, head.code]
                              : ruleForm.applicableFeeHeads.filter(h => h !== head.code)
                          });
                        }}
                        className="h-3.5 w-3.5 text-indigo-600 rounded border-slate-300"
                      />
                      <span className="text-slate-700">{head.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={ruleForm.isStackable}
                    onChange={(e) => setRuleForm({ ...ruleForm, isStackable: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 rounded border-slate-300"
                  />
                  Stackable (Can combine with other concessions)
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={ruleForm.requiresApproval}
                    onChange={(e) => setRuleForm({ ...ruleForm, requiresApproval: e.target.checked })}
                    className="h-4 w-4 text-amber-600 rounded border-slate-300"
                  />
                  Requires Director/Principal Approval
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Guidelines</label>
                <textarea
                  rows={2}
                  placeholder="e.g. 25% discount for 2nd sibling on tuition fee only"
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createOrUpdateRuleMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {createOrUpdateRuleMutation.isPending ? 'Saving...' : 'Save Concession Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Rule with Treatment Choices */}
      {isDeleteModalOpen && ruleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-start gap-3 text-rose-600 mb-3">
              <ShieldAlert className="h-6 w-6 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-bold text-slate-900">Archive / Delete Concession Rule</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Rule: <strong>{ruleToDelete.name}</strong> ({ruleToDelete.code})
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 mb-4">
              This rule has <strong>{ruleToDelete._count?.applications || 0} active student assignment(s)</strong>.
              Select how existing student concessions will be treated:
            </div>

            <div className="space-y-3 mb-4">
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="treatment"
                  checked={activeTreatment === 'END_FROM_MONTH'}
                  onChange={() => setActiveTreatment('END_FROM_MONTH')}
                  className="mt-0.5 h-4 w-4 text-indigo-600"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-900">
                    End concessions from chosen month (Discontinue immediately)
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    Stops concession starting from this month onward. Prior billed months remain untouched.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="treatment"
                  checked={activeTreatment === 'KEEP'}
                  onChange={() => setActiveTreatment('KEEP')}
                  className="mt-0.5 h-4 w-4 text-indigo-600"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-900">
                    Keep existing student concessions running
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    Existing assigned students keep receiving their discount until their scheduled expiry. No new students can be assigned this rule.
                  </span>
                </div>
              </label>
            </div>

            {activeTreatment === 'END_FROM_MONTH' && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Discontinuation Month *</label>
                <select
                  value={deleteEndMonth}
                  onChange={(e) => setDeleteEndMonth(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <option key={m} value={m}>{monthNames[m]} {new Date().getFullYear()}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Deletion Reason (Audit Trail) *</label>
              <input
                type="text"
                required
                placeholder="e.g. Discontinued by School Management Board"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!deleteReason.trim()) {
                    toast.error('Please enter a deletion reason');
                    return;
                  }
                  deleteRuleMutation.mutate();
                }}
                disabled={deleteRuleMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {deleteRuleMutation.isPending ? 'Processing...' : 'Confirm Archival'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Assign Concession to Student */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Assign Concession to Student</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                assignDiscountMutation.mutate({
                  studentId: selectedStudentForAssign,
                  discountRuleId: assignRuleId,
                  customAmount: customAmount ? parseFloat(customAmount) : undefined,
                  effectiveMonth,
                  effectiveYear: new Date().getFullYear(),
                  endMonth: endMonth ? parseInt(endMonth, 10) : undefined,
                  endYear: endMonth ? new Date().getFullYear() : undefined,
                  remarks: assignRemarks
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Student *</label>
                <select
                  required
                  value={selectedStudentForAssign}
                  onChange={(e) => setSelectedStudentForAssign(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Student --</option>
                  {studentsList.map((st: any) => (
                    <option key={st.id} value={st.id}>
                      {st.admissionNumber} - {st.firstName} {st.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Concession Rule *</label>
                <select
                  required
                  value={assignRuleId}
                  onChange={(e) => setAssignRuleId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select Rule --</option>
                  {rules.filter(r => !r.isDeleted && r.isActive).map((r: DiscountRule) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type === 'PERCENTAGE' ? `${r.value}%` : `₹${r.value}`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Start Month *</label>
                  <select
                    value={effectiveMonth}
                    onChange={(e) => setEffectiveMonth(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                      <option key={m} value={m}>{monthNames[m]} {new Date().getFullYear()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Month (Optional)</label>
                  <select
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Continuous (No end)</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                      <option key={m} value={m}>{monthNames[m]} {new Date().getFullYear()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Sibling proof verified with birth certificates"
                  value={assignRemarks}
                  onChange={(e) => setAssignRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignDiscountMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {assignDiscountMutation.isPending ? 'Assigning...' : 'Assign Concession'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
