import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag,
  BookOpen,
  Shirt,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Printer,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  ArrowRight,
  Filter,
  Layers,
  CreditCard,
  UserCheck,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.js';

interface StoreItem {
  id: string;
  name: string;
  sku?: string;
  categoryId: string;
  price: number;
  costPrice?: number;
  sizes?: string;
  trackStock: boolean;
  currentStock: number;
  lowStockAlert: number;
  isKit: boolean;
  isActive: boolean;
  category: { id: string; name: string; code: string };
}

interface CartLine {
  item: StoreItem;
  size?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
}

export const StorePage: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pos' | 'items' | 'history'>('pos');

  // POS State
  const [customerType, setCustomerType] = useState<'STUDENT' | 'WALK_IN'>('STUDENT');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [overallDiscount, setOverallDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionRef, setTransactionRef] = useState('');
  const [addToStudentDues, setAddToStudentDues] = useState(false);
  const [saleNotes, setSaleNotes] = useState('');

  // Item & Stock State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<StoreItem | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Item Form
  const [itemForm, setItemForm] = useState({
    name: '',
    sku: '',
    categoryId: '',
    price: '',
    costPrice: '',
    sizes: '',
    trackStock: true,
    currentStock: '0',
    lowStockAlert: '5',
    isKit: false
  });

  // Returns State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<any | null>(null);
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQty, setReturnQty] = useState('1');
  const [returnRefund, setReturnRefund] = useState('');
  const [returnReason, setReturnReason] = useState('');

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ['storeCategories'],
    queryFn: async () => {
      const res = await apiClient.get('/store/categories');
      return res.data?.data || [];
    }
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['storeItems'],
    queryFn: async () => {
      const res = await apiClient.get('/store/items');
      return res.data?.data || [];
    }
  });

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['storeSales'],
    queryFn: async () => {
      const res = await apiClient.get('/store/sales?limit=50');
      return res.data?.data?.sales || [];
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
  const createSaleMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post('/store/sales', payload);
    },
    onSuccess: (res) => {
      const sale = res.data?.data;
      toast.success(`Sale completed! Receipt #${sale?.receiptNumber}`);
      queryClient.invalidateQueries({ queryKey: ['storeSales'] });
      queryClient.invalidateQueries({ queryKey: ['storeItems'] });
      // Reset cart
      setCart([]);
      setOverallDiscount('0');
      setTransactionRef('');
      setSaleNotes('');
      // Open receipt PDF
      if (sale?.id) {
        window.open(`/api/store/sales/${sale.id}/pdf`, '_blank');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Sale failed');
    }
  });

  const createItemMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post('/store/items', payload);
    },
    onSuccess: () => {
      toast.success('Store item added to inventory');
      queryClient.invalidateQueries({ queryKey: ['storeItems'] });
      setIsItemModalOpen(false);
      setItemForm({
        name: '',
        sku: '',
        categoryId: '',
        price: '',
        costPrice: '',
        sizes: '',
        trackStock: true,
        currentStock: '0',
        lowStockAlert: '5',
        isKit: false
      });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to add item');
    }
  });

  const adjustStockMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post('/store/stock-adjustment', payload);
    },
    onSuccess: () => {
      toast.success('Stock adjusted successfully');
      queryClient.invalidateQueries({ queryKey: ['storeItems'] });
      setIsAdjustModalOpen(false);
      setSelectedItemForAdjust(null);
      setAdjustQty('');
      setAdjustReason('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to adjust stock');
    }
  });

  const processReturnMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post(`/store/sales/${selectedSaleForReturn?.id}/return`, payload);
    },
    onSuccess: (res) => {
      toast.success(res.data?.message || 'Return processed and stock reversed');
      queryClient.invalidateQueries({ queryKey: ['storeSales'] });
      queryClient.invalidateQueries({ queryKey: ['storeItems'] });
      setIsReturnModalOpen(false);
      setSelectedSaleForReturn(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Return failed');
    }
  });

  const cancelSaleMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiClient.post(`/store/sales/${id}/cancel`, { reason });
    },
    onSuccess: () => {
      toast.success('Sale cancelled and stock restored to inventory');
      queryClient.invalidateQueries({ queryKey: ['storeSales'] });
      queryClient.invalidateQueries({ queryKey: ['storeItems'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to cancel sale');
    }
  });

  // Cart operations
  const addToCart = (item: StoreItem, selectedSize?: string) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(c => c.item.id === item.id && c.size === selectedSize);
      if (existingIdx >= 0) {
        const next = [...prev];
        const updatedQty = next[existingIdx].quantity + 1;
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: updatedQty,
          totalPrice: (updatedQty * next[existingIdx].unitPrice) - next[existingIdx].discount
        };
        return next;
      } else {
        const availableSizes = item.sizes ? item.sizes.split(',').map(s => s.trim()) : [];
        const defaultSize = selectedSize || (availableSizes.length > 0 ? availableSizes[0] : undefined);
        return [
          ...prev,
          {
            item,
            size: defaultSize,
            quantity: 1,
            unitPrice: Number(item.price),
            discount: 0,
            totalPrice: Number(item.price)
          }
        ];
      }
    });
  };

  const updateCartQty = (idx: number, delta: number) => {
    setCart(prev => {
      const next = [...prev];
      const newQty = next[idx].quantity + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== idx);
      }
      next[idx] = {
        ...next[idx],
        quantity: newQty,
        totalPrice: (newQty * next[idx].unitPrice) - next[idx].discount
      };
      return next;
    });
  };

  const updateCartSize = (idx: number, size: string) => {
    setCart(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], size };
      return next;
    });
  };

  const removeFromCart = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  // Calculations
  const subtotal = cart.reduce((sum, c) => sum + (c.quantity * c.unitPrice), 0);
  const totalItemDiscounts = cart.reduce((sum, c) => sum + c.discount, 0);
  const parsedOverallDiscount = parseFloat(overallDiscount) || 0;
  const grandTotal = Math.max(0, subtotal - totalItemDiscounts - parsedOverallDiscount);

  // Filtered items for POS
  const filteredCatalog = items.filter((it: StoreItem) => {
    const matchCategory = selectedCategoryFilter === 'ALL' || it.categoryId === selectedCategoryFilter;
    const matchSearch = it.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
      (it.sku && it.sku.toLowerCase().includes(itemSearchQuery.toLowerCase()));
    return matchCategory && matchSearch && it.isActive;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <ShoppingBag className="h-7 w-7 text-indigo-600" />
            Books & Uniform Store (POS)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Over-the-counter sales, uniform sizing, textbook bundles, stock ledger, and sequential BU receipts.
          </p>
        </div>

        {hasPermission('store.manage') && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setItemForm({
                  name: '',
                  sku: '',
                  categoryId: categories[0]?.id || '',
                  price: '',
                  costPrice: '',
                  sizes: '',
                  trackStock: true,
                  currentStock: '0',
                  lowStockAlert: '5',
                  isKit: false
                });
                setIsItemModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Item / Kit
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('pos')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'pos'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            Counter Sale (POS)
          </button>
          <button
            onClick={() => setActiveTab('items')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'items'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Layers className="h-4 w-4" />
            Catalog & Inventory ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <FileText className="h-4 w-4" />
            Sales & Returns Ledger
          </button>
        </nav>
      </div>

      {/* TAB 1: Counter Sale (POS) */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Product Selection Grid */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item name, book kit, uniform, SKU..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setSelectedCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCategoryFilter === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Items
                </button>
                {categories.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategoryFilter(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedCategoryFilter === c.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredCatalog.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-white rounded-xl border border-slate-200">
                  <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No items found matching the category or search query.</p>
                </div>
              ) : (
                filteredCatalog.map((item: StoreItem) => {
                  const isLowStock = item.trackStock && item.currentStock <= item.lowStockAlert && item.currentStock > 0;
                  const isOutOfStock = item.trackStock && item.currentStock <= 0;
                  const sizesArr = item.sizes ? item.sizes.split(',').map(s => s.trim()) : [];

                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {item.category.name}
                          </span>
                          {item.isKit && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                              Book Kit / Set
                            </span>
                          )}
                          {isOutOfStock && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700">
                              Out of Stock
                            </span>
                          )}
                          {isLowStock && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                              Low Stock ({item.currentStock})
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-slate-900 text-sm mt-2 line-clamp-1">{item.name}</h4>
                        {item.sku && <p className="text-[11px] font-mono text-slate-400">SKU: {item.sku}</p>}

                        {sizesArr.length > 0 && (
                          <div className="mt-2 text-xs text-slate-500">
                            Sizes: <span className="font-semibold text-slate-700">{item.sizes}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-base font-extrabold text-slate-900">
                            ₹{Number(item.price).toLocaleString('en-IN')}
                          </span>
                          {item.trackStock && (
                            <span className="text-[11px] text-slate-500 block">
                              Stock: <strong>{item.currentStock}</strong>
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => addToCart(item)}
                          disabled={isOutOfStock}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Cart & Checkout */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5 sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Counter Cart ({cart.length})</h3>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Customer Selector */}
            <div className="space-y-3">
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerType('STUDENT');
                    setAddToStudentDues(false);
                  }}
                  className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                    customerType === 'STUDENT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Enrolled Student
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerType('WALK_IN');
                    setSelectedStudentId('');
                    setAddToStudentDues(false);
                  }}
                  className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                    customerType === 'WALK_IN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Walk-in Buyer
                </button>
              </div>

              {customerType === 'STUDENT' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Student *</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Student --</option>
                    {studentsList.map((st: any) => (
                      <option key={st.id} value={st.id}>
                        {st.admissionNumber} - {st.firstName} {st.lastName} ({st.academicRecords?.[0]?.class?.name || 'Class'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Buyer Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                    <input
                      type="text"
                      placeholder="+91 9876543210"
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Cart is empty. Click "+ Add" on items above to start a sale.
                </div>
              ) : (
                cart.map((line, idx) => {
                  const sizesArr = line.item.sizes ? line.item.sizes.split(',').map(s => s.trim()) : [];

                  return (
                    <div key={`${line.item.id}-${line.size}-${idx}`} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-xs">
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="font-semibold text-slate-900 truncate">{line.item.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>₹{line.unitPrice} each</span>
                          {sizesArr.length > 0 && (
                            <select
                              value={line.size || ''}
                              onChange={(e) => updateCartSize(idx, e.target.value)}
                              className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-medium"
                            >
                              {sizesArr.map(s => (
                                <option key={s} value={s}>Size: {s}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-slate-200 rounded bg-white overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateCartQty(idx, -1)}
                            className="px-2 py-0.5 hover:bg-slate-100 text-slate-600 font-bold"
                          >
                            -
                          </button>
                          <span className="px-2 font-semibold text-slate-900">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(idx, 1)}
                            className="px-2 py-0.5 hover:bg-slate-100 text-slate-600 font-bold"
                          >
                            +
                          </button>
                        </div>

                        <span className="font-bold text-slate-900 w-16 text-right">
                          ₹{line.totalPrice.toLocaleString('en-IN')}
                        </span>

                        <button
                          type="button"
                          onClick={() => removeFromCart(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Billing Summary */}
            <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Discount / Concession:</span>
                <div className="flex items-center gap-1">
                  <span>₹</span>
                  <input
                    type="number"
                    min="0"
                    value={overallDiscount}
                    onChange={(e) => setOverallDiscount(e.target.value)}
                    className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-right font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount:</span>
                <span className="text-indigo-600">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Payment Mode */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700">Payment Mode</label>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {['CASH', 'UPI', 'CARD', 'ONLINE', 'CHEQUE'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(m);
                      setAddToStudentDues(false);
                    }}
                    className={`py-1.5 rounded-lg border font-semibold transition-all ${
                      paymentMethod === m && !addToStudentDues
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {customerType === 'STUDENT' && (
                <div className="pt-2">
                  <label className="flex items-center gap-2 p-2 bg-amber-50/70 border border-amber-200 rounded-lg text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addToStudentDues}
                      onChange={(e) => setAddToStudentDues(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 rounded border-slate-300"
                    />
                    <span className="text-amber-900 font-medium">
                      Add to Student Fee Dues (Pay later with fee bill)
                    </span>
                  </label>
                </div>
              )}

              {paymentMethod !== 'CASH' && !addToStudentDues && (
                <input
                  type="text"
                  placeholder="Txn Ref / UPI Ref / Cheque No"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs mt-2"
                />
              )}
            </div>

            {/* Submit Checkout Button */}
            <button
              onClick={() => {
                if (cart.length === 0) {
                  toast.error('Cart is empty');
                  return;
                }
                if (customerType === 'STUDENT' && !selectedStudentId) {
                  toast.error('Please select a student');
                  return;
                }
                if (customerType === 'WALK_IN' && !walkInName.trim()) {
                  toast.error('Please enter buyer name');
                  return;
                }

                createSaleMutation.mutate({
                  studentId: customerType === 'STUDENT' ? selectedStudentId : undefined,
                  walkInName: customerType === 'WALK_IN' ? walkInName : undefined,
                  walkInPhone: customerType === 'WALK_IN' ? walkInPhone : undefined,
                  items: cart.map(c => ({
                    itemId: c.item.id,
                    size: c.size,
                    quantity: c.quantity,
                    unitPrice: c.unitPrice,
                    discount: c.discount
                  })),
                  discountAmount: parseFloat(overallDiscount) || 0,
                  paymentMethod: addToStudentDues ? 'CASH' : paymentMethod,
                  transactionRef: transactionRef.trim() || undefined,
                  addToStudentDues,
                  notes: saleNotes.trim() || undefined
                });
              }}
              disabled={createSaleMutation.isPending || cart.length === 0}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-sm text-sm transition-colors flex items-center justify-center gap-2"
            >
              {createSaleMutation.isPending ? 'Generating Receipt...' : `Collect ₹${grandTotal.toLocaleString('en-IN')} & Print Receipt`}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: Catalog & Inventory */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Available Sizes</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-center">Stock</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it: StoreItem) => {
                    const isLow = it.trackStock && it.currentStock <= it.lowStockAlert;
                    return (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-indigo-600">
                          {it.sku || 'N/A'}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {it.name}
                          {it.isKit && (
                            <span className="ml-2 text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                              Kit
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {it.category.name}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {it.sizes || 'Universal'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          ₹{Number(it.price).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          {it.trackStock ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              it.currentStock <= 0
                                ? 'bg-rose-50 text-rose-700'
                                : isLow
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {it.currentStock} units
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Untracked</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            it.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {it.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {hasPermission('store.manage') && (
                            <button
                              onClick={() => {
                                setSelectedItemForAdjust(it);
                                setAdjustQty('');
                                setAdjustReason('');
                                setIsAdjustModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded"
                            >
                              Adjust Stock
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Sales History & Returns */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Buyer / Student</th>
                    <th className="py-3 px-4">Items Sold</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No store sales records found yet.
                      </td>
                    </tr>
                  ) : (
                    salesData.map((sale: any) => (
                      <tr key={sale.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-600 text-xs">
                          {sale.receiptNumber}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {new Date(sale.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {sale.student
                            ? `${sale.student.firstName} ${sale.student.lastName} (${sale.student.admissionNumber})`
                            : `${sale.walkInName || 'Walk-in Customer'} ${sale.walkInPhone ? `(${sale.walkInPhone})` : ''}`}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {sale.items?.map((it: any) => `${it.itemName} (${it.quantity})`).join(', ')}
                        </td>
                        <td className="py-3 px-4 font-extrabold text-slate-900">
                          ₹{Number(sale.netAmount).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-700">
                            {sale.isAddedToDues ? 'ADDED TO DUES' : sale.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            sale.isCancelled
                              ? 'bg-rose-50 text-rose-700'
                              : sale.paymentStatus === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {sale.isCancelled ? 'CANCELLED' : sale.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={`/api/store/sales/${sale.id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded"
                            >
                              <Printer className="h-3 w-3" />
                              PDF
                            </a>

                            {!sale.isCancelled && hasPermission('store.return') && (
                              <button
                                onClick={() => {
                                  setSelectedSaleForReturn(sale);
                                  setReturnItemId(sale.items?.[0]?.id || '');
                                  setReturnQty('1');
                                  setReturnRefund(sale.items?.[0]?.unitPrice?.toString() || '');
                                  setReturnReason('');
                                  setIsReturnModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 rounded"
                              >
                                Return
                              </button>
                            )}

                            {!sale.isCancelled && hasPermission('store.manage') && (
                              <button
                                onClick={() => {
                                  const reason = prompt(`Reason for cancelling sale #${sale.receiptNumber}:`);
                                  if (reason) {
                                    cancelSaleMutation.mutate({ id: sale.id, reason });
                                  }
                                }}
                                className="px-2 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded"
                              >
                                Cancel
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

      {/* MODAL: Add Item */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Add Store Item / Kit</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createItemMutation.mutate({
                  ...itemForm,
                  price: parseFloat(itemForm.price),
                  costPrice: itemForm.costPrice ? parseFloat(itemForm.costPrice) : 0,
                  currentStock: parseInt(itemForm.currentStock, 10) || 0,
                  lowStockAlert: parseInt(itemForm.lowStockAlert, 10) || 5
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Item / Set Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class V Textbook Set or Boys School Shirt"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU / Item Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UNIF-SHT-32"
                    value={itemForm.sku}
                    onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    required
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="450"
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="350"
                    value={itemForm.costPrice}
                    onChange={(e) => setItemForm({ ...itemForm, costPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Available Sizes (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. 28, 30, 32, 34 or S, M, L"
                  value={itemForm.sizes}
                  onChange={(e) => setItemForm({ ...itemForm, sizes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Opening Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={itemForm.currentStock}
                    onChange={(e) => setItemForm({ ...itemForm, currentStock: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Low Stock Alert Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={itemForm.lowStockAlert}
                    onChange={(e) => setItemForm({ ...itemForm, lowStockAlert: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={itemForm.trackStock}
                    onChange={(e) => setItemForm({ ...itemForm, trackStock: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 rounded border-slate-300"
                  />
                  Track Stock Inventory
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={itemForm.isKit}
                    onChange={(e) => setItemForm({ ...itemForm, isKit: e.target.checked })}
                    className="h-4 w-4 text-purple-600 rounded border-slate-300"
                  />
                  Is Book Kit / Bundle
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createItemMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {createItemMutation.isPending ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adjust Stock */}
      {isAdjustModalOpen && selectedItemForAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Adjust Inventory Stock</h3>
            <p className="text-xs text-slate-500 mb-4">
              Item: <strong>{selectedItemForAdjust.name}</strong> (Current Stock: {selectedItemForAdjust.currentStock})
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                adjustStockMutation.mutate({
                  itemId: selectedItemForAdjust.id,
                  adjustmentQty: parseInt(adjustQty, 10),
                  reason: adjustReason
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity (+ to Add, - to Deduct) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 25 or -5"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Received new shipment from vendor"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustStockMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {adjustStockMutation.isPending ? 'Adjusting...' : 'Confirm Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Process Return */}
      {isReturnModalOpen && selectedSaleForReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Process Sale Return</h3>
            <p className="text-xs text-slate-500 mb-4">
              Receipt: <strong>#{selectedSaleForReturn.receiptNumber}</strong>
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                processReturnMutation.mutate({
                  saleItemId: returnItemId,
                  quantityReturned: parseInt(returnQty, 10),
                  refundAmount: returnRefund ? parseFloat(returnRefund) : undefined,
                  reason: returnReason
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Item to Return *</label>
                <select
                  required
                  value={returnItemId}
                  onChange={(e) => {
                    const itId = e.target.value;
                    setReturnItemId(itId);
                    const it = selectedSaleForReturn.items?.find((x: any) => x.id === itId);
                    if (it) {
                      setReturnRefund((Number(it.unitPrice) * parseInt(returnQty || '1', 10)).toString());
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {selectedSaleForReturn.items?.map((it: any) => (
                    <option key={it.id} value={it.id}>
                      {it.itemName} ({it.quantity} purchased at ₹{it.unitPrice})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Return Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={returnQty}
                    onChange={(e) => {
                      const q = e.target.value;
                      setReturnQty(q);
                      const it = selectedSaleForReturn.items?.find((x: any) => x.id === returnItemId);
                      if (it) {
                        setReturnRefund((Number(it.unitPrice) * parseInt(q || '1', 10)).toString());
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Refund Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={returnRefund}
                    onChange={(e) => setReturnRefund(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Return Reason *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Size mismatch / Defective print"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processReturnMutation.isPending}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {processReturnMutation.isPending ? 'Processing...' : 'Confirm Return & Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
