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
  CreditCard,
  Copy,
  Edit2,
  Save,
  Check,
  Percent,
  HelpCircle,
  Building2,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.js';

interface FeesPageProps {
  onOpenFeeCollection: (studentId?: string) => void;
}

export const FeesPage: React.FC<FeesPageProps> = ({ onOpenFeeCollection }) => {
  const { hasPermission, user } = useAuth();
  const canManageFees = hasPermission('fee.structure.manage');

  const [activeTab, setActiveTab] = useState<'structures' | 'pending' | 'generate' | 'heads' | 'discounts'>('structures');

  // Metadata
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [feeTypes, setFeeTypes] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');

  // Fee structures state
  const [feeStructures, setFeeStructures] = useState<any[]>([]);
  const [loadingStructures, setLoadingStructures] = useState(false);

  // Edit structure modal
  const [editingClass, setEditingClass] = useState<any | null>(null);
  const [structureItems, setStructureItems] = useState<any[]>([]);
  const [savingStructure, setSavingStructure] = useState(false);

  // Copy structure modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyFromYearId, setCopyFromYearId] = useState('');
  const [copyingStructure, setCopyingStructure] = useState(false);

  // Add Fee Head modal
  const [showAddHeadModal, setShowAddHeadModal] = useState(false);
  const [newHead, setNewHead] = useState({
    name: '',
    code: '',
    frequency: 'MONTHLY',
    description: '',
    defaultAmount: 0
  });

  // Delete Fee Head state
  const [headToDelete, setHeadToDelete] = useState<any | null>(null);
  const [deletingHead, setDeletingHead] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // Discount rules
  const [discountRules, setDiscountRules] = useState<any[]>([]);
  const [showAddDiscountModal, setShowAddDiscountModal] = useState(false);
  const [newDiscount, setNewDiscount] = useState({
    name: '',
    type: 'PERCENTAGE',
    value: 10,
    applicableFeeHeads: 'Tuition Fee',
    requiresApproval: false,
    description: ''
  });

  // Pending dues state
  const [pendingFeesData, setPendingFeesData] = useState<any>({ fees: [], totalOutstanding: 0 });
  const [classFilter, setClassFilter] = useState('');
  const [hostelFilter, setHostelFilter] = useState('ALL');
  const [transportFilter, setTransportFilter] = useState('ALL');
  const [feeHeadFilter, setFeeHeadFilter] = useState('');
  const [loadingPending, setLoadingPending] = useState(false);

  // Monthly fee generation state
  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() + 1);
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  const fetchMetadata = async () => {
    try {
      const [yearsRes, classesRes, typesRes, discountsRes] = await Promise.all([
        apiClient.get('/academic-years'),
        apiClient.get('/classes'),
        apiClient.get('/fee-types'),
        apiClient.get('/discounts/rules')
      ]);

      if (yearsRes.data?.success) {
        setAcademicYears(yearsRes.data.data);
        const active = yearsRes.data.data.find((y: any) => y.isActive);
        if (active) setSelectedYearId(active.id);
        const previous = yearsRes.data.data.find((y: any) => !y.isActive);
        if (previous) setCopyFromYearId(previous.id);
      }
      if (classesRes.data?.success) setClasses(classesRes.data.data);
      if (typesRes.data?.success) setFeeTypes(typesRes.data.data);
      if (discountsRes.data?.success) setDiscountRules(discountsRes.data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFeeStructures = async () => {
    if (!selectedYearId) return;
    setLoadingStructures(true);
    try {
      const res = await apiClient.get(`/fee-structures?academicYearId=${selectedYearId}`);
      if (res.data?.success) {
        setFeeStructures(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStructures(false);
    }
  };

  const fetchPendingFees = async () => {
    setLoadingPending(true);
    try {
      const params = new URLSearchParams();
      if (classFilter) params.append('classId', classFilter);
      if (selectedYearId) params.append('academicYearId', selectedYearId);
      if (hostelFilter !== 'ALL') params.append('isHostel', hostelFilter === 'HOSTEL' ? 'true' : 'false');
      if (transportFilter !== 'ALL') params.append('usesTransport', transportFilter === 'TRANSPORT' ? 'true' : 'false');
      if (feeHeadFilter) params.append('feeTypeId', feeHeadFilter);

      const res = await apiClient.get(`/fees/pending?${params.toString()}`);
      if (res.data?.success) {
        setPendingFeesData(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (selectedYearId) {
      fetchFeeStructures();
    }
  }, [selectedYearId]);

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingFees();
    }
  }, [activeTab, classFilter, hostelFilter, transportFilter, feeHeadFilter, selectedYearId]);

  // Open Edit Structure for Class (merges all configurable fee heads)
  const handleOpenEditClassStructure = (cls: any) => {
    const existing = feeStructures.find(s => s.classId === cls.id);
    setEditingClass(cls);

    const existingItems = existing?.items || [];

    // Ensure ALL active feeTypes are represented in the editor
    const mergedItems = feeTypes.map(ft => {
      const match = existingItems.find((it: any) => it.feeTypeId === ft.id);
      if (match) {
        return {
          id: match.id,
          feeTypeId: match.feeTypeId,
          feeTypeName: ft.name,
          componentName: match.componentName || ft.name,
          amount: Number(match.amount),
          frequency: match.frequency || ft.frequency,
          dueMonths: match.dueMonths || (match.dueMonth ? String(match.dueMonth) : ''),
          appliesTo: match.appliesTo || 'ALL',
          isActive: match.isActive !== undefined ? Boolean(match.isActive) : true
        };
      }
      return {
        feeTypeId: ft.id,
        feeTypeName: ft.name,
        componentName: ft.name,
        amount: 0,
        frequency: ft.frequency,
        dueMonths: ft.code === 'TERM' ? '5,10' : '',
        appliesTo: ft.code === 'HOSTEL' ? 'HOSTEL_ONLY' : (ft.code === 'PROS' || ft.code === 'ADM' ? 'NEW_ADMISSION_ONLY' : 'ALL'),
        isActive: false // Default to inactive when newly introduced
      };
    });

    // Also include any items that existed in database but might not be in feeTypes
    for (const it of existingItems) {
      if (!mergedItems.some(m => m.feeTypeId === it.feeTypeId)) {
        mergedItems.push({
          id: it.id,
          feeTypeId: it.feeTypeId,
          feeTypeName: it.feeType?.name || it.componentName,
          componentName: it.componentName || it.feeType?.name,
          amount: Number(it.amount),
          frequency: it.frequency,
          dueMonths: it.dueMonths || (it.dueMonth ? String(it.dueMonth) : ''),
          appliesTo: it.appliesTo || 'ALL',
          isActive: it.isActive !== undefined ? Boolean(it.isActive) : true
        });
      }
    }

    setStructureItems(mergedItems);
  };

  const handleSaveClassStructure = async () => {
    if (!editingClass || !selectedYearId) return;
    setSavingStructure(true);
    try {
      const res = await apiClient.post('/fee-structures', {
        academicYearId: selectedYearId,
        classId: editingClass.id,
        title: `${editingClass.name} Fee Structure`,
        items: structureItems.map(it => ({
          feeTypeId: it.feeTypeId,
          componentName: it.componentName,
          amount: parseFloat(it.amount) || 0,
          frequency: it.frequency,
          dueMonths: it.dueMonths || null,
          appliesTo: it.appliesTo,
          isActive: Boolean(it.isActive)
        }))
      });

      if (res.data?.success) {
        toast.success(`Fee structure updated for ${editingClass.name}`);
        setEditingClass(null);
        fetchFeeStructures();
      } else {
        toast.error(res.data?.message || 'Save failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save fee structure');
    } finally {
      setSavingStructure(false);
    }
  };

  const handleCopyFromPreviousYear = async () => {
    if (!copyFromYearId || !selectedYearId) return;
    setCopyingStructure(true);
    try {
      const res = await apiClient.post('/fee-structures/copy-previous', {
        fromYearId: copyFromYearId,
        toYearId: selectedYearId
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Fee structure copied successfully');
        setShowCopyModal(false);
        fetchFeeStructures();
      } else {
        toast.error(res.data?.message || 'Copy failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to copy fee structure');
    } finally {
      setCopyingStructure(false);
    }
  };

  const handleCreateFeeHead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/fee-types', newHead);
      if (res.data?.success) {
        toast.success(res.data.message || `Fee head '${newHead.name}' created`);
        setShowAddHeadModal(false);
        setNewHead({ name: '', code: '', frequency: 'MONTHLY', description: '', defaultAmount: 0 });
        await fetchMetadata();
        await fetchFeeStructures();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create fee head');
    }
  };

  const handleDeleteFeeHead = async (force: boolean = false) => {
    if (!headToDelete) return;
    setDeletingHead(true);
    setDeleteNotice(null);
    try {
      const res = await apiClient.delete(`/fee-types/${headToDelete.id}${force ? '?force=true' : ''}`);
      if (res.data?.success) {
        toast.success(res.data.message || 'Fee head deleted successfully');
        setHeadToDelete(null);
        await fetchMetadata();
        await fetchFeeStructures();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to delete fee head';
      if (err.response?.data?.requiresConfirmation) {
        setDeleteNotice(msg);
      } else {
        toast.error(msg);
        setHeadToDelete(null);
      }
    } finally {
      setDeletingHead(false);
    }
  };

  const handleCreateDiscountRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post('/discounts/rules', newDiscount);
      if (res.data?.success) {
        toast.success(`Discount rule '${newDiscount.name}' added`);
        setShowAddDiscountModal(false);
        fetchMetadata();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create discount rule');
    }
  };

  const handleGenerateMonthlyFees = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGenerateResult(null);
    try {
      const res = await apiClient.post('/fees/generate-monthly', {
        academicYearId: selectedYearId,
        month: generateMonth,
        year: generateYear,
        classId: classFilter || undefined
      });

      if (res.data?.success) {
        setGenerateResult(res.data.message);
        toast.success('Fee generation complete');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate fees');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Coins className="h-6 w-6 text-indigo-600" />
            Dynamic Fee Structure & Billing
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Director-managed fee heads, class tariffs, term schedules, hostel rates, and discount concessions
          </p>
        </div>

        {/* Academic Session Selector */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 self-stretch sm:self-auto">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Session:</span>
          <select
            value={selectedYearId}
            onChange={(e) => setSelectedYearId(e.target.value)}
            className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500"
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.isActive ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveTab('structures')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'structures'
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" />
          Class Fee Structures ({classes.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="h-4 w-4" />
          Pending Dues & Accounts
        </button>
        <button
          onClick={() => setActiveTab('heads')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'heads'
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Coins className="h-4 w-4" />
          Configurable Fee Heads ({feeTypes.length})
        </button>
        <button
          onClick={() => setActiveTab('discounts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'discounts'
              ? 'bg-white text-indigo-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Percent className="h-4 w-4" />
          Discounts & Concessions ({discountRules.length})
        </button>
        {canManageFees && (
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'generate'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Play className="h-4 w-4" />
            Monthly Fee Generator
          </button>
        )}
      </div>

      {/* TAB 1: CLASS FEE STRUCTURES */}
      {activeTab === 'structures' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Configured Class Tariffs (Versioned by Session)
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                Every fee is fully editable by Director. Revisions only affect new bills; previous receipts remain untouched.
              </p>
            </div>

            {canManageFees && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCopyModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Copy className="h-4 w-4 text-slate-500" />
                  Copy From Previous Year
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cls) => {
              const struct = feeStructures.find(s => s.classId === cls.id);
              const items = struct?.items || [];

              const tuitionItem = items.find((i: any) => i.componentName === 'Tuition Fee' || i.feeType?.code === 'TUIT');
              const compItem = items.find((i: any) => i.componentName === 'Computer Fee' || i.feeType?.code === 'COMP');
              const prospectusItem = items.find((i: any) => i.componentName === 'Prospectus Fee' || i.feeType?.code === 'PROS');
              const admissionItem = items.find((i: any) => i.componentName === 'Admission Charge' || i.feeType?.code === 'ADM');
              const termItem = items.find((i: any) => i.componentName === 'Term Fee' || i.feeType?.code === 'TERM');
              const hostelItem = items.find((i: any) => i.componentName === 'Hostel Fee' || i.feeType?.code === 'HOSTEL');

              const standardCodes = ['TUIT', 'COMP', 'PROS', 'ADM', 'TERM', 'HOSTEL'];
              const customActiveItems = items.filter((i: any) => i.isActive && !standardCodes.includes(i.feeType?.code));
              const inactiveItems = items.filter((i: any) => !i.isActive);
              const monthlyTotal = (Number(tuitionItem?.amount || 0) + Number(compItem?.amount || 0));

              return (
                <div
                  key={cls.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                      <div>
                        <div className="text-base font-extrabold text-slate-900">{cls.name}</div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          {cls.description || 'General class curriculum'}
                        </div>
                      </div>
                      {canManageFees && (
                        <button
                          onClick={() => handleOpenEditClassStructure(cls)}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit Fees
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* Monthly Tuition with component breakdown */}
                      <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <div className="font-bold text-slate-800">Monthly Tuition</div>
                          {Number(compItem?.amount || 0) > 0 ? (
                            <div className="text-[10px] text-slate-500">
                              (Tuition ₹{Number(tuitionItem?.amount || 0)} + Computer ₹{Number(compItem?.amount || 0)})
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">Regular tuition only</div>
                          )}
                        </div>
                        <div className="font-mono font-black text-indigo-700 text-sm">
                          ₹{monthlyTotal.toLocaleString()}
                        </div>
                      </div>

                      {/* Prospectus & Admission Charges */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">Prospectus (New)</span>
                          <span className="font-bold text-slate-800 font-mono">
                            {prospectusItem && Number(prospectusItem.amount) > 0 ? `₹${Number(prospectusItem.amount)}` : 'N/A'}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">Admission Charge</span>
                          <span className="font-bold text-slate-800 font-mono">
                            {admissionItem ? (Number(admissionItem.amount) === 0 ? 'Free' : `₹${Number(admissionItem.amount)}`) : 'Discretion'}
                          </span>
                        </div>
                      </div>

                      {/* Term Fee & Hostel Fee */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">Term Fee (May & Oct)</span>
                          <span className="font-bold text-slate-800 font-mono">
                            ₹{Number(termItem?.amount || 1350).toLocaleString()}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <span className="text-[10px] text-slate-400 font-semibold block">Hostel Fee</span>
                          <span className="font-bold text-slate-800 font-mono">
                            {hostelItem && Number(hostelItem.amount) > 0 ? `₹${Number(hostelItem.amount)}/mo` : 'Not set'}
                          </span>
                        </div>
                      </div>

                      {/* Additional Active Configurable Fee Heads */}
                      {customActiveItems.length > 0 && (
                        <div className="pt-1 border-t border-slate-100 space-y-1.5">
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                            Additional Active Heads
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {customActiveItems.map((cIt: any, cIdx: number) => (
                              <div key={cIdx} className="p-1.5 rounded-lg bg-indigo-50/60 border border-indigo-100/80 flex items-center justify-between">
                                <span className="font-medium text-slate-700 truncate max-w-[110px]" title={cIt.componentName || cIt.feeType?.name}>
                                  {cIt.componentName || cIt.feeType?.name}
                                </span>
                                <span className="font-mono font-bold text-indigo-800">
                                  ₹{Number(cIt.amount).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        {items.filter((i: any) => i.isActive).length} Active
                      </span>
                      {inactiveItems.length > 0 && (
                        <span className="text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-full font-medium">
                          {inactiveItems.length} Inactive
                        </span>
                      )}
                    </div>
                    <span className="text-slate-600 font-bold font-mono">
                      Total: ₹{Number(struct?.totalAmount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: PENDING DUES */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">Class:</span>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Student Type:</span>
                <select
                  value={hostelFilter}
                  onChange={(e) => setHostelFilter(e.target.value)}
                  className="text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Students</option>
                  <option value="HOSTEL">Hostel Students Only</option>
                  <option value="DAY">Day Scholars Only</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Transport:</span>
                <select
                  value={transportFilter}
                  onChange={(e) => setTransportFilter(e.target.value)}
                  className="text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Students</option>
                  <option value="TRANSPORT">Transport Enrolled Only</option>
                  <option value="NON_TRANSPORT">Non-Transport Only</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Fee Head:</span>
                <select
                  value={feeHeadFilter}
                  onChange={(e) => setFeeHeadFilter(e.target.value)}
                  className="text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Fee Heads</option>
                  {feeTypes.map((ft) => (
                    <option key={ft.id} value={ft.id}>{ft.name} ({ft.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl flex items-center gap-2">
              <span className="text-xs text-rose-700 font-semibold">Total Outstanding Dues:</span>
              <span className="text-base font-black text-rose-800 font-mono">
                ₹{Number(pendingFeesData.totalOutstanding || 0).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Student & Adm No.</th>
                    <th className="py-3 px-4">Class & Type</th>
                    <th className="py-3 px-4">Fee Head / Description</th>
                    <th className="py-3 px-4">Net Due</th>
                    <th className="py-3 px-4">Paid</th>
                    <th className="py-3 px-4">Balance Remaining</th>
                    <th className="py-3 px-4 text-right">Collect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingPending ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
                        <div>Loading pending dues...</div>
                      </td>
                    </tr>
                  ) : pendingFeesData.fees?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                        <div className="font-bold text-slate-700">All fees up to date!</div>
                        <div className="text-xs text-slate-400">No pending dues found matching selected filters.</div>
                      </td>
                    </tr>
                  ) : (
                    pendingFeesData.fees?.map((f: any) => (
                      <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{f.student.firstName} {f.student.lastName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{f.student.admissionNumber}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">
                            {f.student.academicRecords[0]?.class?.name || 'Class'}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              f.student.isHostelStudent ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {f.student.isHostelStudent ? 'Hostel' : 'Day Scholar'}
                            </span>
                            {f.student.usesTransport && (
                              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900">
                                Bus
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{f.title}</div>
                          <div className="text-[11px] text-slate-400">Due Date: {new Date(f.dueDate).toLocaleDateString()}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-700">₹{Number(f.netAmount).toLocaleString()}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-emerald-600">₹{Number(f.paidAmount).toLocaleString()}</td>
                        <td className="py-3 px-4 font-mono font-bold text-rose-600">₹{Number(f.remainingAmount).toLocaleString()}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onOpenFeeCollection(f.student.id)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ml-auto"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Collect
                          </button>
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

      {/* TAB 3: CONFIGURABLE FEE HEADS */}
      {activeTab === 'heads' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Configurable Fee Heads (SRS Heads)
              </span>
              <p className="text-xs text-slate-400">Director can add custom fee heads beyond the defaults at any time</p>
            </div>
            {canManageFees && (
              <button
                onClick={() => setShowAddHeadModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Fee Head
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feeTypes.map((ft) => (
              <div key={ft.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{ft.name}</span>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {ft.code}
                      </span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ft.isActive !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {ft.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-snug min-h-[32px]">{ft.description || 'Configured fee component for classes'}</p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-medium">Frequency</span>
                      <span className="font-bold text-slate-800">{ft.frequency}</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-medium">Usage</span>
                      <span className="font-bold text-slate-800">
                        {ft._count?.studentFees ? `${ft._count.studentFees} fee items` : 'No bills yet'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">
                    {ft._count?.structureItems ? `In ${ft._count.structureItems} class tariffs` : 'Available in all classes'}
                  </span>
                  {canManageFees && (
                    <button
                      onClick={() => {
                        setHeadToDelete(ft);
                        setDeleteNotice(null);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      title={`Delete ${ft.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: DISCOUNTS & CONCESSIONS */}
      {activeTab === 'discounts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Flexible Concession & Discount Rules
              </span>
              <p className="text-xs text-slate-400">Rules configured by Director (sibling, staff child, scholarship, etc.)</p>
            </div>
            {canManageFees && (
              <button
                onClick={() => setShowAddDiscountModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Discount Rule
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {discountRules.map((dr) => (
              <div key={dr.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                    <span className="text-sm font-bold text-slate-900">{dr.name}</span>
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                      {dr.type === 'PERCENTAGE' ? `${dr.value}%` : `₹${dr.value}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{dr.description || 'General fee concession'}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span>Applies to:</span>
                    <span className="font-semibold text-slate-700">{dr.applicableFeeHeads || 'All fee heads'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Approval:</span>
                    <span className={dr.requiresApproval ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                      {dr.requiresApproval ? 'Director Approval Required' : 'Auto-approved'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: GENERATE MONTHLY FEES */}
      {activeTab === 'generate' && canManageFees && (
        <div className="max-w-2xl bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Play className="h-5 w-5 text-indigo-600" />
              Automated Monthly Fee Generation
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Computes and generates monthly bills for active students according to their class fee structure.
              Automatically includes May/October Term Fees and hostel rates. Existing records will not be duplicated.
            </p>
          </div>

          <form onSubmit={handleGenerateMonthlyFees} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Month</label>
                <select
                  value={generateMonth}
                  onChange={(e) => setGenerateMonth(parseInt(e.target.value, 10))}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white"
                >
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                    <option key={m} value={idx + 1}>{m} (Month {idx + 1})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Year</label>
                <input
                  type="number"
                  value={generateYear}
                  onChange={(e) => setGenerateYear(parseInt(e.target.value, 10))}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class Scope (Optional)</label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white"
              >
                <option value="">All Classes (Nursery to Class XII)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {generateResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{generateResult}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={generating}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Play className="h-4 w-4" />
              {generating ? 'Processing Fee Batch...' : 'Generate Monthly Bills Now'}
            </button>
          </form>
        </div>
      )}

      {/* EDIT CLASS FEE STRUCTURE MODAL */}
      {editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Coins className="h-5 w-5 text-indigo-600" />
                  Configure Class Tariffs: {editingClass.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enable or disable fee heads for this class. Only active fee heads will be billed in upcoming fee generation.
                </p>
              </div>
              <button
                onClick={() => setEditingClass(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Info notice */}
            <div className="px-5 py-3 bg-indigo-50/70 border-b border-indigo-100/70 text-xs text-indigo-900 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>Fee Versioning Notice:</strong> Configurable fee heads are added to all classes. When you enable an <strong>Active</strong> fee head and save, it will be applicable for <em>new monthly fee generation only</em>. Historical student records, past receipts, and ledger balances remain untouched.
              </span>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {structureItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border transition-all ${
                    item.isActive
                      ? 'bg-white border-slate-200 shadow-xs ring-1 ring-emerald-500/10'
                      : 'bg-slate-50/80 border-slate-200/60 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-2.5 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">
                        {item.feeTypeName || item.componentName}
                      </span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {item.frequency}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...structureItems];
                        updated[idx].isActive = !updated[idx].isActive;
                        setStructureItems(updated);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        item.isActive
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 border border-slate-300 hover:bg-slate-300'
                      }`}
                    >
                      {item.isActive ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Active (Billed)</span>
                        </>
                      ) : (
                        <span>○ Inactive (Not Billed)</span>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-600">Component Display Title</label>
                      <input
                        type="text"
                        value={item.componentName}
                        onChange={(e) => {
                          const updated = [...structureItems];
                          updated[idx].componentName = e.target.value;
                          setStructureItems(updated);
                        }}
                        className="w-full text-xs font-semibold px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white mt-1 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600">Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.amount}
                        onChange={(e) => {
                          const updated = [...structureItems];
                          updated[idx].amount = parseFloat(e.target.value) || 0;
                          setStructureItems(updated);
                        }}
                        className={`w-full text-xs font-mono font-bold px-2.5 py-1.5 border rounded-lg mt-1 focus:ring-1 focus:ring-indigo-500 ${
                          item.isActive ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-100 border-slate-200 text-slate-400'
                        }`}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-600">Applies To</label>
                      <select
                        value={item.appliesTo}
                        onChange={(e) => {
                          const updated = [...structureItems];
                          updated[idx].appliesTo = e.target.value;
                          setStructureItems(updated);
                        }}
                        className="w-full text-xs font-semibold px-2 py-1.5 border border-slate-300 rounded-lg bg-white mt-1"
                      >
                        <option value="ALL">All Students</option>
                        <option value="NEW_ADMISSION_ONLY">New Admission Only</option>
                        <option value="HOSTEL_ONLY">Hostel Students Only</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-600">Due Month(s)</label>
                      <input
                        type="text"
                        placeholder="e.g. 5,10"
                        value={item.dueMonths}
                        onChange={(e) => {
                          const updated = [...structureItems];
                          updated[idx].dueMonths = e.target.value;
                          setStructureItems(updated);
                        }}
                        className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg bg-white mt-1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/70">
              <div className="text-xs text-slate-600 flex items-center gap-3">
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                  {structureItems.filter(i => i.isActive).length} Active Heads
                </span>
                <span className="text-slate-500 bg-slate-200/60 px-2 py-1 rounded-lg">
                  {structureItems.filter(i => !i.isActive).length} Inactive Heads
                </span>
                <span className="font-mono font-bold text-indigo-700">
                  Active Total: ₹{structureItems.filter(i => i.isActive).reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveClassStructure}
                  disabled={savingStructure}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Save className="h-4 w-4" />
                  {savingStructure ? 'Saving...' : 'Save Structure'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COPY FROM PREVIOUS YEAR MODAL */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Copy className="h-5 w-5 text-indigo-600" />
              Copy Fee Structure from Previous Year
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Duplicate all class tariffs and fee items from a previous academic session to the current one
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Source Session (Copy From)</label>
                <select
                  value={copyFromYearId}
                  onChange={(e) => setCopyFromYearId(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 font-semibold bg-white"
                >
                  {academicYears.filter(y => y.id !== selectedYearId).map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Session (Copy To)</label>
                <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100">
                  {academicYears.find(y => y.id === selectedYearId)?.name} (Current Selected Session)
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCopyFromPreviousYear}
                  disabled={copyingStructure}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {copyingStructure ? 'Copying...' : 'Confirm Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD FEE HEAD MODAL */}
      {showAddHeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" />
              Add Configurable Fee Head
            </h3>
            <p className="text-xs text-slate-500 mb-3">Create a new fee component to bill across classes</p>

            {/* Explanatory notice */}
            <div className="mb-4 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <span>
                <strong>Automatic Class Integration:</strong> Once created, this fee head will automatically appear in <strong>all class fee structures</strong> as <em>Inactive (Not Billed)</em>. You can then selectively activate it and adjust tariffs per class. Historical student records and receipts remain completely unchanged.
              </span>
            </div>

            <form onSubmit={handleCreateFeeHead} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Head Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Science Lab Fee"
                  value={newHead.name}
                  onChange={(e) => setNewHead({ ...newHead, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    placeholder="SCILAB"
                    value={newHead.code}
                    onChange={(e) => setNewHead({ ...newHead, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency</label>
                  <select
                    value={newHead.frequency}
                    onChange={(e) => setNewHead({ ...newHead, frequency: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-semibold bg-white"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="ANNUAL">Term / Annual</option>
                    <option value="ONE_TIME">One-Time</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Amount (₹) (Optional)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={newHead.defaultAmount || ''}
                  onChange={(e) => setNewHead({ ...newHead, defaultAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Initial tariff populated into inactive items; can be adjusted per class</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional details..."
                  value={newHead.description}
                  onChange={(e) => setNewHead({ ...newHead, description: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddHeadModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Create Head
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE FEE HEAD CONFIRMATION MODAL */}
      {headToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in duration-200">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Fee Head</h3>
                <p className="text-xs text-slate-500 font-mono font-medium">{headToDelete.name} ({headToDelete.code})</p>
              </div>
            </div>

            {deleteNotice ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 mb-4 space-y-2">
                <div className="flex items-start gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Unpaid Records Detected</span>
                </div>
                <p className="text-slate-600 leading-relaxed">{deleteNotice}</p>
                <p className="text-[11px] text-amber-800 font-medium">
                  Would you like to force delete this fee head and remove all unpaid line items, or cancel?
                </p>
              </div>
            ) : (
              <div className="text-xs text-slate-600 mb-4 space-y-2">
                <p>
                  Are you sure you want to delete <strong className="text-slate-900">{headToDelete.name}</strong>?
                </p>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Frequency:</span>
                    <span className="font-semibold text-slate-800">{headToDelete.frequency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Class structures using this:</span>
                    <span className="font-semibold text-slate-800">{headToDelete._count?.structureItems ?? 'All classes'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Student fee bills:</span>
                    <span className="font-semibold text-slate-800">{headToDelete._count?.studentFees || 0}</span>
                  </div>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Note: If paid student fee receipts exist for this fee head, it will be safely deactivated across all classes rather than deleted, preserving accounting compliance and audit records.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setHeadToDelete(null);
                  setDeleteNotice(null);
                }}
                disabled={deletingHead}
                className="px-3.5 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              {deleteNotice ? (
                <button
                  type="button"
                  onClick={() => handleDeleteFeeHead(true)}
                  disabled={deletingHead}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingHead ? 'Deleting...' : 'Force Delete (Remove Unpaid)'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDeleteFeeHead(false)}
                  disabled={deletingHead}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingHead ? 'Processing...' : 'Confirm Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD DISCOUNT RULE MODAL */}
      {showAddDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Percent className="h-5 w-5 text-indigo-600" />
              Add Discount / Concession Rule
            </h3>
            <p className="text-xs text-slate-500 mb-4">Configure concession criteria and relief amounts</p>

            <form onSubmit={handleCreateDiscountRule} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sibling Concession"
                  value={newDiscount.name}
                  onChange={(e) => setNewDiscount({ ...newDiscount, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Type</label>
                  <select
                    value={newDiscount.type}
                    onChange={(e) => setNewDiscount({ ...newDiscount, type: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-semibold bg-white"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Value</label>
                  <input
                    type="number"
                    required
                    value={newDiscount.value}
                    onChange={(e) => setNewDiscount({ ...newDiscount, value: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Applicable Fee Head(s)</label>
                <input
                  type="text"
                  placeholder="e.g. Tuition Fee (or leave empty for all)"
                  value={newDiscount.applicableFeeHeads}
                  onChange={(e) => setNewDiscount({ ...newDiscount, applicableFeeHeads: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reqApproval"
                  checked={newDiscount.requiresApproval}
                  onChange={(e) => setNewDiscount({ ...newDiscount, requiresApproval: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 rounded border-slate-300"
                />
                <label htmlFor="reqApproval" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Require Director / Principal Approval
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddDiscountModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
