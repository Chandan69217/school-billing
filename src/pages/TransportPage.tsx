import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bus,
  MapPin,
  Users,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  Calendar,
  History,
  Phone,
  ArrowRight,
  Check,
  ChevronsUpDown,
  X,
  User,
  GraduationCap,
  RefreshCw,
  Shield,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.js';

interface RouteItem {
  id: string;
  name: string;
  code: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  description?: string;
  isActive: boolean;
  stops: Array<{
    id: string;
    name: string;
    order: number;
    orderNumber?: number;
    monthlyFee: number;
    oneWayFee?: number | null;
    isActive: boolean;
    _count?: { studentAssignments: number };
  }>;
  _count?: {
    studentAssignments: number;
  };
}

interface StudentAssignment {
  id: string;
  studentId: string;
  serviceType: string;
  startMonth: number;
  startYear: number;
  stopMonth?: number;
  stopYear?: number;
  pickupPoint?: string;
  monthlyFee: number;
  isActive: boolean;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    academicRecords?: Array<{ class: { name: string }; section?: { name: string } }>;
  };
  route: { id: string; name: string; code: string };
  stop: { id: string; name: string };
}

export const TransportPage: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'routes' | 'students' | 'report' | 'audit'>('routes');

  // Search & Filter state
  const [routeSearch, setRouteSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState('');

  // Audit Log State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);

  // Modals state
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null);

  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [selectedRouteForStop, setSelectedRouteForStop] = useState<string>('');
  const [editingStop, setEditingStop] = useState<any | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [isStopTransportModalOpen, setIsStopTransportModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<StudentAssignment | null>(null);

  // Form states
  const [routeForm, setRouteForm] = useState({
    name: '',
    code: '',
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    description: '',
    isActive: true
  });

  const [stopForm, setStopForm] = useState({
    name: '',
    order: 1,
    monthlyFee: ''
  });

  const [assignForm, setAssignForm] = useState({
    studentId: '',
    routeId: '',
    stopId: '',
    serviceType: 'TWO_WAY',
    startMonth: new Date().getMonth() + 1,
    pickupPoint: ''
  });

  // Searchable student selection state for Assign Transport Modal
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [selectedStudentObj, setSelectedStudentObj] = useState<any | null>(null);
  const [remoteStudents, setRemoteStudents] = useState<any[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const studentDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target as Node)) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [changeForm, setChangeForm] = useState({
    newRouteId: '',
    newStopId: '',
    effectiveMonth: new Date().getMonth() + 1,
    reason: ''
  });

  const [stopTransportForm, setStopTransportForm] = useState({
    effectiveMonth: new Date().getMonth() + 1,
    reason: ''
  });

  // Queries
  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['transportRoutes'],
    queryFn: async () => {
      const res = await apiClient.get('/transport/routes');
      return res.data?.data || [];
    }
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['transportReport'],
    queryFn: async () => {
      const res = await apiClient.get('/transport/report');
      return res.data?.data || { routes: [], summary: { totalAssignedStudents: 0, totalMonthlyDemand: 0 } };
    }
  });

  const { data: studentsList } = useQuery({
    queryKey: ['studentsCompact'],
    queryFn: async () => {
      const res = await apiClient.get('/students?limit=500');
      if (Array.isArray(res.data?.data)) {
        return res.data.data;
      }
      return res.data?.data?.students || [];
    }
  });

  const { data: auditLogs = [], isLoading: auditLogsLoading, refetch: refetchAuditLogs } = useQuery({
    queryKey: ['transportAuditLogs', auditSearch, auditActionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (auditSearch.trim()) params.append('search', auditSearch.trim());
      if (auditActionFilter && auditActionFilter !== 'ALL') params.append('action', auditActionFilter);
      params.append('limit', '100');
      const res = await apiClient.get(`/transport/audit-logs?${params.toString()}`);
      return res.data?.data || [];
    }
  });

  // Debounced search for students from backend (for large databases / search as you type)
  useEffect(() => {
    const term = studentSearchTerm.trim();
    if (!term || term.length < 2) {
      setRemoteStudents([]);
      setIsSearchingStudents(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingStudents(true);
      try {
        const res = await apiClient.get(`/students?search=${encodeURIComponent(term)}&limit=30`);
        if (res.data?.success && Array.isArray(res.data.data)) {
          setRemoteStudents(res.data.data);
        }
      } catch (err) {
        console.error('Failed to search students:', err);
      } finally {
        setIsSearchingStudents(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [studentSearchTerm]);

  // Merge preloaded students with remote search results
  const combinedStudents = useMemo(() => {
    const map = new Map<string, any>();
    if (Array.isArray(studentsList)) {
      studentsList.forEach((s: any) => {
        if (s?.id) map.set(s.id, s);
      });
    }
    if (Array.isArray(remoteStudents)) {
      remoteStudents.forEach((s: any) => {
        if (s?.id) map.set(s.id, s);
      });
    }
    return Array.from(map.values());
  }, [studentsList, remoteStudents]);

  // Filter students based on studentSearchTerm (name, admission number, class, section, phone)
  const filteredStudentsForAssign = useMemo(() => {
    const term = studentSearchTerm.trim().toLowerCase();
    if (!term) return combinedStudents.slice(0, 50);

    return combinedStudents.filter((s: any) => {
      const adm = (s.admissionNumber || '').toLowerCase();
      const first = (s.firstName || '').toLowerCase();
      const last = (s.lastName || '').toLowerCase();
      const full = (s.fullName || `${first} ${last}`).toLowerCase();
      const cls = (s.academicRecords?.[0]?.class?.name || s.className || '').toLowerCase();
      const sec = (s.academicRecords?.[0]?.section?.name || s.sectionName || '').toLowerCase();
      const phone = (s.parents?.[0]?.parent?.primaryPhone || s.primaryPhone || '').toLowerCase();

      return (
        adm.includes(term) ||
        first.includes(term) ||
        last.includes(term) ||
        full.includes(term) ||
        cls.includes(term) ||
        sec.includes(term) ||
        phone.includes(term)
      );
    });
  }, [combinedStudents, studentSearchTerm]);

  // Extract all active assignments from report
  const allAssignments: StudentAssignment[] = React.useMemo(() => {
    // If reportData has routes with nested students
    if (Array.isArray(reportData?.routes) && reportData.routes.length > 0) {
      const list: StudentAssignment[] = [];
      for (const r of reportData.routes) {
        if (Array.isArray(r.students)) {
          for (const st of r.students) {
            list.push({
              id: st.id,
              studentId: st.studentId,
              serviceType: st.serviceType,
              startMonth: st.startMonth,
              startYear: st.startYear,
              stopMonth: st.stopMonth,
              stopYear: st.stopYear,
              pickupPoint: st.pickupPoint,
              monthlyFee: st.monthlyFee,
              isActive: st.isActive ?? true,
              student: {
                id: st.studentId,
                admissionNumber: st.admissionNumber,
                firstName: st.studentName ? st.studentName.split(' ')[0] : (st.firstName || ''),
                lastName: st.studentName ? st.studentName.split(' ').slice(1).join(' ') : (st.lastName || ''),
                academicRecords: [{ class: { name: st.className || 'N/A' }, section: { name: st.sectionName || '' } }]
              },
              route: { id: r.id || st.routeId, name: r.name || st.routeName, code: r.code || st.routeCode },
              stop: { id: st.stopId || '', name: st.stopName }
            });
          }
        }
      }
      if (list.length > 0) return list;
    }

    // Fallback: If reportData has a flat students array
    if (Array.isArray(reportData?.students) && reportData.students.length > 0) {
      return reportData.students.map((st: any) => ({
        id: st.id,
        studentId: st.studentId,
        serviceType: st.serviceType,
        startMonth: st.startMonth,
        startYear: st.startYear,
        stopMonth: st.stopMonth,
        stopYear: st.stopYear,
        pickupPoint: st.pickupPoint,
        monthlyFee: st.monthlyFee,
        isActive: st.isActive ?? true,
        student: {
          id: st.studentId,
          admissionNumber: st.admissionNumber,
          firstName: st.studentName ? st.studentName.split(' ')[0] : (st.firstName || ''),
          lastName: st.studentName ? st.studentName.split(' ').slice(1).join(' ') : (st.lastName || ''),
          academicRecords: [{ class: { name: st.className || 'N/A' }, section: { name: st.sectionName || '' } }]
        },
        route: { id: st.routeId || '', name: st.routeName || '', code: st.routeCode || '' },
        stop: { id: st.stopId || '', name: st.stopName || '' }
      }));
    }

    return [];
  }, [reportData]);

  // Mutations
  const createOrUpdateRouteMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingRoute) {
        return apiClient.put(`/transport/routes/${editingRoute.id}`, payload);
      }
      return apiClient.post('/transport/routes', payload);
    },
    onSuccess: () => {
      toast.success(editingRoute ? 'Route updated successfully' : 'Route created successfully');
      queryClient.invalidateQueries({ queryKey: ['transportRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['transportReport'] });
      queryClient.invalidateQueries({ queryKey: ['transportAuditLogs'] });
      setIsRouteModalOpen(false);
      setEditingRoute(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save route');
    }
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/transport/routes/${id}`);
    },
    onSuccess: () => {
      toast.success('Route removed successfully');
      queryClient.invalidateQueries({ queryKey: ['transportRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['transportReport'] });
      queryClient.invalidateQueries({ queryKey: ['transportAuditLogs'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Cannot delete route with assigned students');
    }
  });

  const createOrUpdateStopMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingStop) {
        return apiClient.put(`/transport/stops/${editingStop.id}`, payload);
      }
      return apiClient.post('/transport/stops', { ...payload, routeId: selectedRouteForStop });
    },
    onSuccess: () => {
      toast.success(editingStop ? 'Stop updated' : 'Stop added');
      queryClient.invalidateQueries({ queryKey: ['transportRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['transportReport'] });
      queryClient.invalidateQueries({ queryKey: ['transportAuditLogs'] });
      setIsStopModalOpen(false);
      setEditingStop(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save stop');
    }
  });

  const assignTransportMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post(`/transport/students/${payload.studentId}/assign`, payload);
    },
    onSuccess: () => {
      toast.success('Student assigned to transport');
      queryClient.invalidateQueries({ queryKey: ['transportReport'] });
      queryClient.invalidateQueries({ queryKey: ['transportRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['studentsCompact'] });
      queryClient.invalidateQueries({ queryKey: ['transportAuditLogs'] });
      setIsAssignModalOpen(false);
      setSelectedStudentObj(null);
      setStudentSearchTerm('');
      setIsStudentDropdownOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Assignment failed');
    }
  });

  const changeTransportMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.put(`/transport/students/${selectedAssignment?.studentId}/change`, payload);
    },
    onSuccess: () => {
      toast.success('Transport route/stop updated');
      queryClient.invalidateQueries({ queryKey: ['transportReport'] });
      queryClient.invalidateQueries({ queryKey: ['transportRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['transportAuditLogs'] });
      setIsChangeModalOpen(false);
      setSelectedAssignment(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Change failed');
    }
  });

  const stopTransportMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.put(`/transport/students/${selectedAssignment?.studentId}/stop`, payload);
    },
    onSuccess: () => {
      toast.success('Transport service stopped');
      queryClient.invalidateQueries({ queryKey: ['transportReport'] });
      queryClient.invalidateQueries({ queryKey: ['transportRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['transportAuditLogs'] });
      setIsStopTransportModalOpen(false);
      setSelectedAssignment(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to stop service');
    }
  });

  const routes: RouteItem[] = routesData || [];
  const filteredRoutes = routes.filter(r =>
    r.name.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.code.toLowerCase().includes(routeSearch.toLowerCase()) ||
    (r.vehicleNumber && r.vehicleNumber.toLowerCase().includes(routeSearch.toLowerCase()))
  );

  const filteredStudents = allAssignments.filter(a => {
    const nameMatch = `${a.student.firstName} ${a.student.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
      a.student.admissionNumber.toLowerCase().includes(studentSearch.toLowerCase());
    const routeMatch = !selectedRouteFilter || a.route.id === selectedRouteFilter;
    return nameMatch && routeMatch;
  });

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Bus className="h-7 w-7 text-indigo-600" />
            Transport Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dynamic routes, stops, vehicle tracking, student monthly transport fees, and dues collection.
          </p>
        </div>

        {hasPermission('transport.manage') && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setEditingRoute(null);
                setRouteForm({
                  name: '',
                  code: '',
                  vehicleNumber: '',
                  driverName: '',
                  driverPhone: '',
                  description: '',
                  isActive: true
                });
                setIsRouteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add New Route
            </button>
            <button
              onClick={() => {
                setAssignForm({
                  studentId: '',
                  routeId: routes[0]?.id || '',
                  stopId: routes[0]?.stops[0]?.id || '',
                  serviceType: 'TWO_WAY',
                  startMonth: new Date().getMonth() + 1,
                  pickupPoint: ''
                });
                setSelectedStudentObj(null);
                setStudentSearchTerm('');
                setIsStudentDropdownOpen(false);
                setIsAssignModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Users className="h-4 w-4 text-slate-500" />
              Assign Student
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Routes</span>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Bus className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">{routes.filter(r => r.isActive).length}</span>
            <span className="text-xs text-slate-500 ml-2">of {routes.length} total</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Designated Stops</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <MapPin className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {routes.reduce((sum, r) => sum + (r.stops?.length || 0), 0)}
            </span>
            <span className="text-xs text-slate-500 ml-2">across all routes</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Transport Students</span>
            <span className="p-2 bg-sky-50 text-sky-600 rounded-lg">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              {reportData?.summary?.totalAssignedStudents ?? reportData?.totalStudents ?? allAssignments.length}
            </span>
            <span className="text-xs text-emerald-600 font-medium ml-2">active riders</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Transport Demand</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Calendar className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">
              ₹{(reportData?.summary?.totalMonthlyDemand ?? reportData?.totalMonthlyBilling ?? 0).toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-slate-500 ml-2">per month</span>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('routes')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'routes'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Bus className="h-4 w-4" />
            Routes & Stops Master
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'students'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="h-4 w-4" />
            Enrolled Students ({allAssignments.length})
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'report'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <FileText className="h-4 w-4" />
            Route Collection & Dues Report
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <History className="h-4 w-4" />
            Audit Trail & History
            {auditLogs.length > 0 && (
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                activeTab === 'audit' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {auditLogs.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* TAB 1: Routes & Stops Master */}
      {activeTab === 'routes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search routes or vehicle..."
                value={routeSearch}
                onChange={(e) => setRouteSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredRoutes.map((route) => (
              <div key={route.id} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg mt-0.5">
                      <Bus className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base">{route.name}</h3>
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs font-semibold">
                          {route.code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${route.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {route.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {route.vehicleNumber && <span>Vehicle: <strong className="text-slate-700">{route.vehicleNumber}</strong></span>}
                        {route.driverName && (
                          <span className="flex items-center gap-1">
                            Driver: <strong className="text-slate-700">{route.driverName}</strong>
                            {route.driverPhone && <Phone className="h-3 w-3 text-slate-400 ml-1" />}
                            {route.driverPhone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {hasPermission('transport.manage') && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingRoute(route);
                          setRouteForm({
                            name: route.name,
                            code: route.code,
                            vehicleNumber: route.vehicleNumber || '',
                            driverName: route.driverName || '',
                            driverPhone: route.driverPhone || '',
                            description: route.description || '',
                            isActive: route.isActive
                          });
                          setIsRouteModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                        title="Edit Route"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete route "${route.name}"? If students are assigned, it will be blocked.`)) {
                            deleteRouteMutation.mutate(route.id);
                          }
                        }}
                        className="p-1.5 text-rose-400 hover:text-rose-600 rounded-md hover:bg-rose-50"
                        title="Delete Route"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Stops list inside Route Card */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Designated Stops ({route.stops?.length || 0})
                      </span>
                      {hasPermission('transport.manage') && (
                        <button
                          onClick={() => {
                            setSelectedRouteForStop(route.id);
                            setEditingStop(null);
                            setStopForm({
                              name: '',
                              order: (route.stops?.length || 0) + 1,
                              monthlyFee: ''
                            });
                            setIsStopModalOpen(true);
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Stop
                        </button>
                      )}
                    </div>

                    {(!route.stops || route.stops.length === 0) ? (
                      <p className="text-xs text-slate-400 italic py-3 text-center bg-slate-50 rounded-lg">
                        No stops configured yet for this route.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {route.stops.map((stop) => (
                          <div
                            key={stop.id}
                            className="flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100/70 rounded-lg text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                                {stop.order}
                              </span>
                              <span className="font-medium text-slate-800">{stop.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                ₹{Number(stop.monthlyFee).toLocaleString('en-IN')}/mo
                              </span>
                              {hasPermission('transport.manage') && (
                                <button
                                  onClick={() => {
                                    setSelectedRouteForStop(route.id);
                                    setEditingStop(stop);
                                    setStopForm({
                                      name: stop.name,
                                      order: stop.order,
                                      monthlyFee: stop.monthlyFee.toString()
                                    });
                                    setIsStopModalOpen(true);
                                  }}
                                  className="text-slate-400 hover:text-slate-600"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Assigned Students: <strong>{route._count?.studentAssignments || 0}</strong></span>
                    <span>Total Monthly: <strong>₹{route.stops.reduce((sum, s) => sum + Number(s.monthlyFee), 0).toLocaleString('en-IN')}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Enrolled Students */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search student or admission number..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedRouteFilter}
                onChange={(e) => setSelectedRouteFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Routes</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Adm No</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Route & Stop</th>
                    <th className="py-3 px-4">Service Type</th>
                    <th className="py-3 px-4">Monthly Fee</th>
                    <th className="py-3 px-4">Effective Since</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No students found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((assign) => (
                      <tr key={assign.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-indigo-600 text-xs">
                          {assign.student.admissionNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {assign.student.firstName} {assign.student.lastName}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {assign.student.academicRecords?.[0]?.class?.name || 'Class'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-900 font-medium">{assign.route.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {assign.stop.name}
                            {assign.pickupPoint && ` (${assign.pickupPoint})`}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            assign.serviceType === 'ONE_WAY' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {assign.serviceType === 'ONE_WAY' ? 'One-Way' : 'Two-Way (Pick & Drop)'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          ₹{Number(assign.monthlyFee).toLocaleString('en-IN')}/mo
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {monthNames[assign.startMonth]} {assign.startYear}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {hasPermission('transport.assign') && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedAssignment(assign);
                                  setChangeForm({
                                    newRouteId: assign.route.id,
                                    newStopId: assign.stop.id,
                                    effectiveMonth: new Date().getMonth() + 1,
                                    reason: ''
                                  });
                                  setIsChangeModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded"
                              >
                                Change Stop
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAssignment(assign);
                                  setStopTransportForm({
                                    effectiveMonth: new Date().getMonth() + 1,
                                    reason: ''
                                  });
                                  setIsStopTransportModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded"
                              >
                                Stop
                              </button>
                            </div>
                          )}
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

      {/* TAB 3: Route Collection & Dues Report */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Route & Stop-wise Financial Demand Report</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Print / Save PDF
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Route Name</th>
                  <th className="py-3 px-4">Vehicle / Driver</th>
                  <th className="py-3 px-4 text-center">Stops</th>
                  <th className="py-3 px-4 text-center">Riders</th>
                  <th className="py-3 px-4 text-right">Monthly Demand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData?.routes?.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {r.name} ({r.code})
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {r.vehicleNumber || 'No vehicle'} {r.driverName ? `• ${r.driverName}` : ''}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-slate-700">
                      {r.stops?.length || 0}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-bold text-xs">
                        {r.studentCount || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      ₹{(r.monthlyDemand || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100/70 font-bold text-slate-900 border-t border-slate-200">
                  <td colSpan={3} className="py-3 px-4">Total Fleet Demand</td>
                  <td className="py-3 px-4 text-center">
                    {reportData?.summary?.totalAssignedStudents ?? reportData?.totalStudents ?? allAssignments.length} students
                  </td>
                  <td className="py-3 px-4 text-right text-indigo-600">
                    ₹{(reportData?.summary?.totalMonthlyDemand ?? reportData?.totalMonthlyBilling ?? 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL & HISTORY */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Header Controls & Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-600" />
                  Transportation Audit Trail & History Log
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete immutable record of all route adjustments, stop fee revisions, student transport enrollments, transfers, and discontinuations.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refetchAuditLogs()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                  title="Refresh Audit Logs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${auditLogsLoading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3 border-t border-slate-100">
              <div className="relative sm:col-span-6 md:col-span-7">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by student name, admission no, route, stop, officer, or keyword..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white"
                />
                {auditSearch && (
                  <button
                    type="button"
                    onClick={() => setAuditSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="sm:col-span-4 md:col-span-3">
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="ALL">All Event Types</option>
                  <option value="ASSIGN_STUDENT_TRANSPORT">Student Enrolled</option>
                  <option value="CHANGE_STUDENT_STOP">Stop / Route Changed</option>
                  <option value="STOP_STUDENT_TRANSPORT">Transport Stopped</option>
                  <option value="CREATE_ROUTE">Route Created</option>
                  <option value="UPDATE_ROUTE">Route Updated</option>
                  <option value="DELETE_ROUTE">Route Deleted</option>
                  <option value="CREATE_STOP">Stop Added</option>
                  <option value="UPDATE_STOP">Stop Updated</option>
                </select>
              </div>

              <div className="sm:col-span-2 md:col-span-2 flex items-center justify-end">
                {(auditSearch || auditActionFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuditSearch('');
                      setAuditActionFilter('ALL');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold inline-flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Activity Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Recorded Events</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{auditLogs.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Across entire transport system</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
              <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Enrollments</div>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {auditLogs.filter((l: any) => l.action.includes('ASSIGN') || l.action.includes('ENROLL')).length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Active transport assignments</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
              <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Fleet & Route Changes</div>
              <div className="text-xl font-bold text-indigo-700 mt-1">
                {auditLogs.filter((l: any) => l.action.includes('ROUTE') || l.action.includes('STOP_CHANGED') || l.action.includes('CREATE_STOP')).length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Master & student adjustments</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
              <div className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Discontinuations</div>
              <div className="text-xl font-bold text-rose-700 mt-1">
                {auditLogs.filter((l: any) => l.action.includes('STOPPED') || l.action.includes('DISCONTINUE')).length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Students withdrew from service</div>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {auditLogsLoading ? (
              <div className="py-20 text-center">
                <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Loading transportation audit trail...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <History className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">No transport audit logs found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    {auditSearch || auditActionFilter !== 'ALL'
                      ? 'No audit entries match the current search filters. Try clearing your filters.'
                      : 'Transport operations and modifications will be automatically audited and recorded here.'}
                  </p>
                </div>
                {(auditSearch || auditActionFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuditSearch('');
                      setAuditActionFilter('ALL');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    Clear Search Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4 whitespace-nowrap">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Performed By</th>
                      <th className="py-3 px-4">Target Resource</th>
                      <th className="py-3 px-4 min-w-[280px]">Activity Description</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log: any) => {
                      const isEnroll = log.action.includes('ASSIGN') || log.action.includes('ENROLL');
                      const isStop = log.action.includes('STOPPED') || log.action.includes('DISCONTINUE') || log.action.includes('DELETE');
                      const isChange = log.action.includes('CHANGE') || log.action.includes('UPDATE');

                      const badgeStyle = isEnroll
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isStop
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : isChange
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200';

                      const readableAction = log.action
                        .replace('ASSIGN_STUDENT_TRANSPORT', 'STUDENT ENROLLED')
                        .replace('ENROLL_STUDENT', 'STUDENT ENROLLED')
                        .replace('CHANGE_STUDENT_STOP', 'STOP / ROUTE CHANGED')
                        .replace('STOP_STUDENT_TRANSPORT', 'SERVICE DISCONTINUED')
                        .replace('DISCONTINUE_STUDENT', 'SERVICE DISCONTINUED')
                        .replace('CREATE_ROUTE', 'ROUTE CREATED')
                        .replace('UPDATE_ROUTE', 'ROUTE UPDATED')
                        .replace('DELETE_ROUTE', 'ROUTE DELETED')
                        .replace('CREATE_STOP', 'STOP CREATED')
                        .replace('UPDATE_STOP', 'STOP UPDATED')
                        .replace('_', ' ');

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                            {new Date(log.timestamp).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                            <div className="text-[10px] text-slate-400">
                              {new Date(log.timestamp).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeStyle}`}>
                              {readableAction}
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                {log.userName?.[0] || 'U'}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-800">{log.userName || 'System'}</span>
                                {log.ipAddress && log.ipAddress !== '127.0.0.1' && (
                                  <div className="text-[9px] text-slate-400 font-mono">{log.ipAddress}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {log.studentName ? (
                              <div>
                                <span className="font-semibold text-slate-900">{log.studentName}</span>
                                {log.admissionNumber && (
                                  <span className="ml-1.5 font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                    {log.admissionNumber}
                                  </span>
                                )}
                                {log.routeName && (
                                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                    {log.routeName} {log.stopName ? `· ${log.stopName}` : ''}
                                  </div>
                                )}
                              </div>
                            ) : log.routeName ? (
                              <div>
                                <span className="font-semibold text-slate-900">{log.routeName}</span>
                                {log.stopName && (
                                  <div className="text-[10px] text-slate-500">Stop: {log.stopName}</div>
                                )}
                              </div>
                            ) : log.recordId ? (
                              <span className="font-mono text-[10px] text-slate-500 truncate block max-w-[120px]" title={log.recordId}>
                                {log.recordId}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Transport Fleet</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-700 leading-relaxed">
                            <div>{log.details || 'Activity logged in transport system'}</div>
                            {log.reason && (
                              <div className="text-[10px] text-slate-500 mt-0.5 italic">
                                Reason: {log.reason}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedAuditLog(log)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                            >
                              <Eye className="h-3 w-3" />
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Route */}
      {isRouteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingRoute ? 'Edit Transport Route' : 'Add New Transport Route'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createOrUpdateRouteMutation.mutate(routeForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Route Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Route A - Bailey Road"
                  value={routeForm.name}
                  onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Route Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RT-A"
                  value={routeForm.code}
                  onChange={(e) => setRouteForm({ ...routeForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Number</label>
                  <input
                    type="text"
                    placeholder="BR-01-PB-1234"
                    value={routeForm.vehicleNumber}
                    onChange={(e) => setRouteForm({ ...routeForm, vehicleNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    placeholder="Driver Name"
                    value={routeForm.driverName}
                    onChange={(e) => setRouteForm({ ...routeForm, driverName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Driver Phone</label>
                <input
                  type="text"
                  placeholder="+91 9876543210"
                  value={routeForm.driverPhone}
                  onChange={(e) => setRouteForm({ ...routeForm, driverPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="routeActive"
                  checked={routeForm.isActive}
                  onChange={(e) => setRouteForm({ ...routeForm, isActive: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 rounded border-slate-300"
                />
                <label htmlFor="routeActive" className="text-xs font-medium text-slate-700">
                  Route is currently active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRouteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createOrUpdateRouteMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {createOrUpdateRouteMutation.isPending ? 'Saving...' : 'Save Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Stop */}
      {isStopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingStop ? 'Edit Stop' : 'Add Stop to Route'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createOrUpdateStopMutation.mutate({
                  name: stopForm.name,
                  order: parseInt(stopForm.order.toString(), 10),
                  monthlyFee: parseFloat(stopForm.monthlyFee)
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stop Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Saguna More"
                  value={stopForm.name}
                  onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stop Order</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={stopForm.order}
                    onChange={(e) => setStopForm({ ...stopForm, order: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Fee (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    placeholder="800"
                    value={stopForm.monthlyFee}
                    onChange={(e) => setStopForm({ ...stopForm, monthlyFee: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStopModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createOrUpdateStopMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {createOrUpdateStopMutation.isPending ? 'Saving...' : 'Save Stop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Assign Transport to Student */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">Assign Student to Transport</h3>
                  <p className="text-xs text-slate-500">Search student and configure their route and pickup stop</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!assignForm.studentId) {
                  toast.error('Please search and select a student to assign transport');
                  setIsStudentDropdownOpen(true);
                  return;
                }
                if (!assignForm.routeId || !assignForm.stopId) {
                  toast.error('Please select both a route and a stop');
                  return;
                }
                assignTransportMutation.mutate(assignForm);
              }}
              className="space-y-4"
            >
              {/* Searchable Student Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Select Student <span className="text-rose-500">*</span>
                  </label>
                  {selectedStudentObj && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentObj(null);
                        setAssignForm(prev => ({ ...prev, studentId: '' }));
                        setStudentSearchTerm('');
                        setIsStudentDropdownOpen(true);
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
                    >
                      <Search className="h-3 w-3" />
                      Search another student
                    </button>
                  )}
                </div>

                {selectedStudentObj ? (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200/90 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {selectedStudentObj.firstName?.[0] || 'S'}{selectedStudentObj.lastName?.[0] || ''}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-2">
                          <span>{selectedStudentObj.fullName || `${selectedStudentObj.firstName} ${selectedStudentObj.lastName}`}</span>
                          <span className="font-mono text-xs px-2 py-0.5 bg-white text-indigo-700 border border-indigo-200 rounded font-semibold shrink-0">
                            {selectedStudentObj.admissionNumber}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>
                            Class: <strong>{selectedStudentObj.academicRecords?.[0]?.class?.name || selectedStudentObj.className || 'N/A'}{selectedStudentObj.academicRecords?.[0]?.section?.name ? ` (${selectedStudentObj.academicRecords[0].section.name})` : ''}</strong>
                          </span>
                          {allAssignments.some(a => a.studentId === selectedStudentObj.id) && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-semibold flex items-center gap-1">
                              <AlertCircle className="h-2.5 w-2.5" />
                              Currently Enrolled (will transfer)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentObj(null);
                        setAssignForm(prev => ({ ...prev, studentId: '' }));
                        setStudentSearchTerm('');
                        setIsStudentDropdownOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors shrink-0"
                      title="Clear Selection"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative" ref={studentDropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search student by name, admission no, or class..."
                        value={studentSearchTerm}
                        onChange={(e) => {
                          setStudentSearchTerm(e.target.value);
                          setIsStudentDropdownOpen(true);
                        }}
                        onFocus={() => setIsStudentDropdownOpen(true)}
                        className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs placeholder:text-slate-400"
                      />
                      {studentSearchTerm ? (
                        <button
                          type="button"
                          onClick={() => setStudentSearchTerm('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <ChevronsUpDown
                          onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 cursor-pointer"
                        />
                      )}
                    </div>

                    {isStudentDropdownOpen && (
                      <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                        {isSearchingStudents && (
                          <div className="p-3 text-xs text-indigo-600 flex items-center justify-center gap-2">
                            <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            Searching students across records...
                          </div>
                        )}

                        <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 flex justify-between items-center sticky top-0 z-10 border-b border-slate-100">
                          <span>
                            {filteredStudentsForAssign.length > 0
                              ? `Matching Students (${filteredStudentsForAssign.length})`
                              : 'No matching students'}
                          </span>
                          <span className="text-[10px] text-slate-400">Select to assign</span>
                        </div>

                        {filteredStudentsForAssign.length === 0 && !isSearchingStudents ? (
                          <div className="p-4 text-center text-xs text-slate-500 italic">
                            No students found matching "{studentSearchTerm}". Try another name or admission number.
                          </div>
                        ) : (
                          filteredStudentsForAssign.map((st: any) => {
                            const isAssigned = allAssignments.some(a => a.studentId === st.id);
                            return (
                              <button
                                type="button"
                                key={st.id}
                                onClick={() => {
                                  setSelectedStudentObj(st);
                                  setAssignForm(prev => ({ ...prev, studentId: st.id }));
                                  setIsStudentDropdownOpen(false);
                                  setStudentSearchTerm('');
                                }}
                                className="w-full text-left p-2.5 hover:bg-indigo-50/70 transition-colors flex items-center justify-between gap-2 border-b border-slate-50 last:border-b-0"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100">
                                    {st.firstName?.[0] || 'S'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-900 truncate">
                                      {st.fullName || `${st.firstName} ${st.lastName}`}
                                    </div>
                                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                      <span className="font-mono text-indigo-600 font-semibold">{st.admissionNumber}</span>
                                      <span>•</span>
                                      <span>Class {st.academicRecords?.[0]?.class?.name || st.className || 'N/A'}{st.academicRecords?.[0]?.section?.name ? `-${st.academicRecords[0].section.name}` : ''}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-1.5">
                                  {isAssigned && (
                                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-semibold">
                                      Enrolled
                                    </span>
                                  )}
                                  <span className="text-xs text-indigo-600 font-semibold hover:underline px-2 py-1 rounded hover:bg-indigo-100/50">
                                    Choose
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Route *</label>
                  <select
                    required
                    value={assignForm.routeId}
                    onChange={(e) => {
                      const rId = e.target.value;
                      const r = routes.find(x => x.id === rId);
                      setAssignForm({
                        ...assignForm,
                        routeId: rId,
                        stopId: r?.stops[0]?.id || ''
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Route</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stop *</label>
                  <select
                    required
                    value={assignForm.stopId}
                    onChange={(e) => setAssignForm({ ...assignForm, stopId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Stop</option>
                    {routes.find(r => r.id === assignForm.routeId)?.stops?.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} (₹{s.monthlyFee}/mo)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Route & Stop Preview Banner */}
              {assignForm.routeId && assignForm.stopId && (() => {
                const selRoute = routes.find(r => r.id === assignForm.routeId);
                const selStop = selRoute?.stops?.find(s => s.id === assignForm.stopId);
                if (!selRoute || !selStop) return null;
                const fee = assignForm.serviceType === 'ONE_WAY' && selStop.oneWayFee ? Number(selStop.oneWayFee) : Number(selStop.monthlyFee);
                return (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between shadow-2xs">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Bus className="h-3.5 w-3.5 text-indigo-600" />
                        <span>{selRoute.name}</span>
                        <span className="text-slate-400">•</span>
                        <MapPin className="h-3 w-3 text-emerald-600" />
                        <span>{selStop.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {selRoute.vehicleNumber ? `Vehicle: ${selRoute.vehicleNumber}` : 'No vehicle specified'}
                        {selRoute.driverName ? ` | Driver: ${selRoute.driverName}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs font-mono">
                        ₹{fee.toLocaleString('en-IN')}/mo
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Service Type</label>
                  <select
                    value={assignForm.serviceType}
                    onChange={(e) => setAssignForm({ ...assignForm, serviceType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="TWO_WAY">Two-Way (Pick & Drop)</option>
                    <option value="ONE_WAY">One-Way Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Month *</label>
                  <select
                    value={assignForm.startMonth}
                    onChange={(e) => setAssignForm({ ...assignForm, startMonth: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                      <option key={m} value={m}>{monthNames[m]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pickup Point Note</label>
                <input
                  type="text"
                  placeholder="e.g. Near Shiv Mandir Gate"
                  value={assignForm.pickupPoint}
                  onChange={(e) => setAssignForm({ ...assignForm, pickupPoint: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  disabled={assignTransportMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {assignTransportMutation.isPending ? 'Assigning...' : 'Assign Transport'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Change Route/Stop */}
      {isChangeModalOpen && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Change Transport Route/Stop</h3>
            <p className="text-xs text-slate-500 mb-4">
              Student: <strong>{selectedAssignment.student.firstName} {selectedAssignment.student.lastName}</strong> ({selectedAssignment.student.admissionNumber})
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                changeTransportMutation.mutate(changeForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Route *</label>
                <select
                  required
                  value={changeForm.newRouteId}
                  onChange={(e) => {
                    const rId = e.target.value;
                    const r = routes.find(x => x.id === rId);
                    setChangeForm({
                      ...changeForm,
                      newRouteId: rId,
                      newStopId: r?.stops[0]?.id || ''
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Stop *</label>
                <select
                  required
                  value={changeForm.newStopId}
                  onChange={(e) => setChangeForm({ ...changeForm, newStopId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {routes.find(r => r.id === changeForm.newRouteId)?.stops?.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (₹{s.monthlyFee}/mo)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Month *</label>
                <select
                  value={changeForm.effectiveMonth}
                  onChange={(e) => setChangeForm({ ...changeForm, effectiveMonth: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <option key={m} value={m}>{monthNames[m]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Change</label>
                <input
                  type="text"
                  placeholder="e.g. Relocated to new residence"
                  value={changeForm.reason}
                  onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsChangeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changeTransportMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {changeTransportMutation.isPending ? 'Updating...' : 'Confirm Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Stop Transport Service */}
      {isStopTransportModalOpen && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Stop Transport Service</h3>
            <p className="text-xs text-slate-500 mb-4">
              Stop bus service for <strong>{selectedAssignment.student.firstName} {selectedAssignment.student.lastName}</strong>.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                stopTransportMutation.mutate(stopTransportForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Effective Month *</label>
                <select
                  value={stopTransportForm.effectiveMonth}
                  onChange={(e) => setStopTransportForm({ ...stopTransportForm, effectiveMonth: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <option key={m} value={m}>{monthNames[m]}</option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Months already billed or paid will not be altered.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Student shifting to bicycle or parent pick-up"
                  value={stopTransportForm.reason}
                  onChange={(e) => setStopTransportForm({ ...stopTransportForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsStopTransportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stopTransportMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {stopTransportMutation.isPending ? 'Stopping...' : 'Stop Transport'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Inspect Audit Event Payload */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Transportation Audit Event</h3>
                  <div className="text-[11px] text-slate-500 font-mono">
                    ID: {selectedAuditLog.id}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 overflow-y-auto text-xs">
              {/* Event Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Action Type</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {selectedAuditLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Logged Time</span>
                  <span className="font-semibold text-slate-800 text-xs">
                    {new Date(selectedAuditLog.timestamp).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Performed By</span>
                  <span className="font-semibold text-slate-800 text-xs">
                    {selectedAuditLog.userName || 'System'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Source</span>
                  <span className="font-mono text-[11px] text-indigo-600 font-semibold">
                    {selectedAuditLog.source}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Client IP</span>
                  <span className="font-mono text-[11px] text-slate-600">
                    {selectedAuditLog.ipAddress || '127.0.0.1'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Record ID</span>
                  <span className="font-mono text-[10px] text-slate-600 truncate block" title={selectedAuditLog.recordId}>
                    {selectedAuditLog.recordId || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Activity Narrative */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Activity Narrative</label>
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-800 leading-relaxed shadow-2xs font-medium">
                  {selectedAuditLog.details || 'No extended narrative provided.'}
                </div>
              </div>

              {/* Student or Target Context if present */}
              {(selectedAuditLog.studentName || selectedAuditLog.routeName) && (
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-indigo-600" />
                    Target Context
                  </div>
                  {selectedAuditLog.studentName && (
                    <div className="text-slate-700">
                      Student: <strong>{selectedAuditLog.studentName}</strong> {selectedAuditLog.admissionNumber ? `(${selectedAuditLog.admissionNumber})` : ''}
                    </div>
                  )}
                  {selectedAuditLog.routeName && (
                    <div className="text-slate-700">
                      Route: <strong>{selectedAuditLog.routeName}</strong> {selectedAuditLog.stopName ? `· Stop: ${selectedAuditLog.stopName}` : ''}
                    </div>
                  )}
                  {selectedAuditLog.monthlyFee !== undefined && (
                    <div className="text-slate-700">
                      Monthly Fee: <strong>₹{Number(selectedAuditLog.monthlyFee).toLocaleString('en-IN')}/mo</strong>
                    </div>
                  )}
                  {selectedAuditLog.effectiveMonth && (
                    <div className="text-slate-700">
                      Effective Period: <strong>Month {selectedAuditLog.effectiveMonth}/{selectedAuditLog.effectiveYear}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* State Changes & Payload (Old vs New Data) */}
              {(selectedAuditLog.oldData || selectedAuditLog.newData) && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">Payload & Field Data</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedAuditLog.oldData && (
                      <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/70">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Previous Values (Before)</span>
                        <pre className="text-[11px] font-mono text-slate-700 whitespace-pre-wrap break-all max-h-40 overflow-y-auto bg-white p-2 rounded border border-slate-200">
                          {typeof selectedAuditLog.oldData === 'string'
                            ? selectedAuditLog.oldData
                            : JSON.stringify(selectedAuditLog.oldData, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedAuditLog.newData && (
                      <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/70">
                        <span className="text-[10px] font-bold uppercase text-emerald-600 block mb-1">New Values (After)</span>
                        <pre className="text-[11px] font-mono text-slate-700 whitespace-pre-wrap break-all max-h-40 overflow-y-auto bg-white p-2 rounded border border-slate-200">
                          {typeof selectedAuditLog.newData === 'string'
                            ? selectedAuditLog.newData
                            : JSON.stringify(selectedAuditLog.newData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
