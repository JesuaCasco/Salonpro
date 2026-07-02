import React, { Suspense, createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  closeCashSession,
  cancelPosSaleWithReversal,
  createCashAuditMovement,
  createCashMovement,
  createPayrollPayment,
  createManagedUser,
  createPosSale,
  assignProfileSalon,
  deleteStylistRecord,
  deleteClientRecord,
  deleteServiceRecord,
  deleteInventoryProduct,
  fetchAccessControlSnapshot,
  fetchSalonSnapshot,
  fetchClientDirectorySnapshot,
  fetchScopedStylists,
  fetchScopedClients,
  openCashSession,
  resetManagedUserPassword,
  replaceUserRoles,
  syncServiceComboItems,
  upsertBranch,
  upsertSalon,
  upsertAppointments,
  upsertStylists,
  upsertClients,
  upsertServices,
  upsertInventoryProducts,
  updateManagedUserProfile,
} from './lib/salonApi';
import {
  hasSupabaseConfig,
  isLocalDevModeEnabled,
  shouldBlockWithoutSupabase,
  shouldSeedLocalDevMode,
  supabase,
} from './lib/supabase';
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Users, 
  Scissors, 
  ShoppingBag, 
  BarChart3, 
  Plus, 
  Search,
  Clock,
  X,
  Loader2, 
  CalendarDays,
  Trash2,
  Package,
  Tags,
  Save,
  ChevronDown,
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Check,
  Edit2,
  UserPlus,
  Info,
  Star,
  Zap,
  Phone,
  User,
  CreditCard,
  Medal,
  Award,
  Crown,
  CalendarCheck,
  Layers,
  Sparkles,
  UserCheck,
  Target,
  Gift,
  ArrowUpRight,
  Filter,
  Briefcase,
  IdCard,
  Smartphone,
  MapPin,
  History,
  MessageSquare,
  Menu,
  Timer,
  UserX,
  Wallet,
  Activity,
  Repeat,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

import {
  CATEGORY_LABELS,
  STYLIST_THEME_PALETTE,
  STYLIST_PAYMENT_MODE_OPTIONS,
  BUSINESS_PLANS,
  CATEGORIES,
  DEFAULT_SALON_CLOSE_TIME,
  DEFAULT_SALON_OPEN_TIME,
  HOURS,
  MOCK_STYLISTS,
  LOYALTY_REWARD_VISITS,
  PASSWORD_MIN_LENGTH,
  ROLE_META,
  ensureStylistTheme,
  findClientByPhone,
  stylistHasBasePay,
  stylistHasCommissionPay,
  formatPhoneNumber,
  formatLocalDateYmd,
  formatTime12h,
  generateBusinessHours,
  getStylistNominaData,
  getStylistPaymentModeLabel,
  getCurrentTimeHHmm,
  getPhoneDigits,
  getPrimaryRole,
  getTodayString,
  isValidPhoneNumber,
  formatPromotionValue,
  normalizeFavoriteServiceName,
  normalizeBusinessTime,
  clampPromotionDiscountValue,
  isPromotionService,
  makeId,
  mergeEntitiesById,
  parseLocalDate,
  standardizeDate,
  styleTag,
} from './features/app/shared';
import {
  DelayTimer,
  ServiceTimer,
  WaitTimer,
} from './features/app/sharedComponents';
import { DashboardView, POSView } from './features/app/dashboardPosViews';
import { ClientDetailModal, ClientsTableView } from './features/app/clientViews';
import { FinalizeModal } from './features/app/finalizeModal';
import { ServiceEditorModal } from './features/app/serviceEditorModal';
import { CashClosureReceiptModal, PaymentReceiptModal, PosSaleReceiptModal, StaffSettlementModal } from './features/app/receiptModals';
import { LoginScreen, PasswordActionModal, UserEditorModal } from './features/system/accessUi';

const { useCallback } = React;

const accessUiFallback = (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm">
    <div className="rounded-2xl border border-white/10 bg-slate-950 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300">
      Cargando interfaz...
    </div>
  </div>
);

const UiFeedbackContext = createContext({
  notify: () => {},
  confirmAction: async () => false,
});

const useUiFeedback = () => useContext(UiFeedbackContext);
const AUTH_RUNTIME_CACHE_KEY = 'sp_auth_runtime_cache_v1';

const inventoryProductToService = (item) => ({
  id: item.serviceId || `inventory:${item.id}`,
  inventoryItemId: item.id,
  name: item.productName || item.name || 'Producto sin nombre',
  price: Number(item.salePrice || 0),
  category: 'Producto',
  inventoryCategory: item.productCategory || 'Otros',
  usageType: item.usageType || 'retail',
  currentStock: Number(item.currentStock || 0),
  costPrice: Number(item.costPrice || 0),
  unitName: item.unitName || 'unidad',
  sku: item.sku || '',
  barcode: item.barcode || '',
  isInventoryProduct: true,
  items: [],
  appliesTo: 'General',
  discountType: 'percentage',
  discountValue: 0,
  targetServiceIds: [],
  isOptional: true,
});

const mergeInventoryProductIntoServices = (currentServices, item) => {
  const nextServices = (currentServices || []).filter(
    (service) => String(service.inventoryItemId || '') !== String(item.id || '')
      && String(service.id || '') !== String(item.serviceId || ''),
  );

  if (!['retail', 'both'].includes(item.usageType || 'retail')) return nextServices;

  return [...nextServices, inventoryProductToService(item)];
};

const NETWORK_ERROR_PATTERNS = [
  'failed to fetch',
  'load failed',
  'networkerror',
  'network request failed',
  'err_name_not_resolved',
  'dns_hostname_not_found',
  'fetch failed',
];

const isNetworkOrDnsError = (error) => {
  const rawMessage = String(error?.message || error || '').toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => rawMessage.includes(pattern));
};

const getMeaningfulErrorMessage = (error) => {
  const rawMessage = error?.message;

  if (typeof rawMessage === 'string') {
    const normalized = rawMessage.trim();
    if (normalized && normalized !== '{}' && normalized !== '[]' && normalized !== 'null' && normalized !== 'undefined') {
      return normalized;
    }
  }

  if (typeof error === 'string') {
    const normalized = error.trim();
    if (normalized && normalized !== '{}' && normalized !== '[]' && normalized !== 'null' && normalized !== 'undefined') {
      return normalized;
    }
  }

  if (typeof error?.error_description === 'string' && error.error_description.trim()) {
    return error.error_description.trim();
  }

  if (typeof error?.details === 'string' && error.details.trim()) {
    return error.details.trim();
  }

  return '';
};

const getFriendlySupabaseErrorMessage = (error, context = 'general') => {
  const meaningfulMessage = getMeaningfulErrorMessage(error);

  if (!isNetworkOrDnsError(error)) {
    return meaningfulMessage || 'Ocurri\u00f3 un problema inesperado al conectar con Supabase.';
  }

  if (context === 'login') {
    return 'No se pudo conectar con Supabase desde esta red m\u00f3vil. Verifica tu conexi\u00f3n o intenta con otra red para iniciar sesi\u00f3n.';
  }

  if (context === 'dashboard') {
    return 'No se pudo conectar con Supabase desde esta red m\u00f3vil. No pude actualizar los datos operativos en este momento.';
  }

  return 'No se pudo conectar con Supabase desde esta red m\u00f3vil. Intenta nuevamente cuando la conexi\u00f3n est\u00e9 estable.';
};

const BUSINESS_TIME_OPTIONS = generateBusinessHours('00:00', '23:30');

const formatCedula = (value) => {
  const compact = `${value || ''}`.replace(/[^0-9a-zA-Z]+/g, '');
  const digits = compact.replace(/\D+/g, '').slice(0, 13);
  const suffix = digits.length >= 13 ? compact.replace(/[^a-zA-Z]+/g, '').slice(0, 1).toUpperCase() : '';
  const first = digits.slice(0, 3);
  const second = digits.slice(3, 9);
  const third = digits.slice(9, 13);
  const parts = [];
  if (first) parts.push(first);
  if (second) parts.push(second);
  if (third || suffix) parts.push(`${third}${suffix}`);
  return parts.join('-');
};

const resolveWalkinQueueTime = ({ appointments = [], stylistId, date = getTodayString(), businessHours = HOURS }) => {
  const toMinutes = (time = '00:00') => {
    if (!time || typeof time !== 'string') return 0;
    const [hours, minutes] = time.split(':').map((value) => Number(value));
    return hours * 60 + minutes;
  };

  const toHHmm = (minutes) => {
    const safeMinutes = Math.min(23 * 60 + 59, Math.max(0, Number(minutes) || 0));
    const h = Math.floor(safeMinutes / 60);
    const m = safeMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const firstBusinessSlot = businessHours?.[0] || DEFAULT_SALON_OPEN_TIME;
  const lastBusinessSlot = businessHours?.[businessHours.length - 1] || DEFAULT_SALON_CLOSE_TIME;
  const firstBusinessMinutes = toMinutes(firstBusinessSlot);
  const lastBusinessMinutes = toMinutes(lastBusinessSlot);
  if (!stylistId || !date) return firstBusinessSlot;

  const activeStatuses = new Set(['Confirmada', 'En Espera', 'En Servicio']);
  const sameStylistDay = (appointments || []).filter((appointment) => (
    standardizeDate(appointment.date) === standardizeDate(date)
    && String(appointment.stylistId) === String(stylistId)
    && activeStatuses.has(appointment.status || 'Confirmada')
  ));

  const latestEnd = sameStylistDay.reduce((latest, appointment) => {
    const start = toMinutes(appointment.time);
    const duration = Number(appointment.durationMinutes) > 0 ? Number(appointment.durationMinutes) : 30;
    return Math.max(latest, start + duration);
  }, 0);

  const isToday = standardizeDate(date) === getTodayString();
  if (isToday) {
    const nowMinutes = toMinutes(getCurrentTimeHHmm());
    return toHHmm(Math.min(Math.max(latestEnd, nowMinutes, firstBusinessMinutes), lastBusinessMinutes));
  }

  if (latestEnd > 0) return toHHmm(Math.min(Math.max(latestEnd, firstBusinessMinutes), lastBusinessMinutes));
  return firstBusinessSlot;
};

const appointmentTimeToMinutes = (time = '00:00') => {
  if (!time || typeof time !== 'string') return 0;
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
};

const hasAppointmentStylistConflict = ({ appointments = [], appointment, targetStylistId, targetDate, targetTime }) => {
  if (!appointment || !targetStylistId) return false;

  const activeStatuses = new Set(['Confirmada', 'En Espera', 'En Servicio']);
  const normalizedTargetDate = standardizeDate(targetDate || appointment.date);
  const start = appointmentTimeToMinutes(targetTime || appointment.time);
  const duration = Number(appointment.durationMinutes) > 0 ? Number(appointment.durationMinutes) : 30;
  const end = start + duration;

  return (appointments || []).some((candidate) => {
    if (String(candidate.id) === String(appointment.id)) return false;
    if (standardizeDate(candidate.date) !== normalizedTargetDate) return false;
    if (String(candidate.stylistId) !== String(targetStylistId)) return false;
    if (!activeStatuses.has(candidate.status || 'Confirmada')) return false;

    const candidateStart = appointmentTimeToMinutes(candidate.time);
    const candidateDuration = Number(candidate.durationMinutes) > 0 ? Number(candidate.durationMinutes) : 30;
    const candidateEnd = candidateStart + candidateDuration;
    return start < candidateEnd && candidateStart < end;
  });
};

function SystemView({
  currentUser,
  accessControl,
  savingUserId,
  creatingUser,
  resettingPasswordUserId,
  onboardingBusy,
  onCreateSystemUser,
  onResetUserPassword,
  onUpdateUserProfile,
  onCreateSalon,
  onCreateBranch,
  isAdmin,
  isSuperAdmin,
}) {
  const { notify } = useUiFeedback();
  const [search, setSearch] = useState('');
  const [activeSystemPanel, setActiveSystemPanel] = useState('users');
  const [showCreateSalon, setShowCreateSalon] = useState(false);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedBranchesSalonId, setSelectedBranchesSalonId] = useState('all');
  const [selectedUsersSalonId, setSelectedUsersSalonId] = useState('all');
  const [selectedUsersBranchId, setSelectedUsersBranchId] = useState('all');
  const [onboarding, setOnboarding] = useState({ id: '', name: '', ownerEmail: '', phone: '', city: '', plan: BUSINESS_PLANS[0], adminUserId: '', openTime: DEFAULT_SALON_OPEN_TIME, closeTime: DEFAULT_SALON_CLOSE_TIME });
  const [branchForm, setBranchForm] = useState({ id: '', name: '', code: '', city: '', address: '', salonId: '' });
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', roleName: 'admin', salonId: '', branchId: '' });

  const roleCatalog = accessControl.roles.length
    ? accessControl.roles.filter((role) => ['super_admin', 'admin', 'cashier'].includes(role.roleName))
    : [
        { roleName: 'super_admin', description: 'Control total de la plataforma SaaS' },
        { roleName: 'admin', description: 'Administra el salón y su configuración' },
        { roleName: 'cashier', description: 'Caja / recepción' },
      ];
  const editableRoleCatalog = roleCatalog.filter((role) => isSuperAdmin || role.roleName !== 'super_admin');
  const salons = useMemo(() => accessControl.salons || [], [accessControl.salons]);
  const branches = useMemo(() => accessControl.branches || [], [accessControl.branches]);
  const currentSalon = salons.find((shop) => String(shop.id) === String(accessControl.currentSalonId || ''))
    || (!isSuperAdmin ? salons[0] || null : null);
  const effectiveCurrentSalonId = accessControl.currentSalonId || currentSalon?.id || salons[0]?.id || '';
  const currentBranch = branches.find((branch) => String(branch.id) === String(accessControl.currentBranchId || '')) || null;
  const defaultSalonId = effectiveCurrentSalonId;
  const branchesForCurrentSalon = branches.filter((branch) => String(branch.salonId || '') === String(effectiveCurrentSalonId));
  const effectiveUsersSalonId = !isSuperAdmin
    ? (defaultSalonId || 'all')
    : (
        selectedUsersSalonId === 'all'
          ? 'all'
          : (salons.some((shop) => String(shop.id) === String(selectedUsersSalonId)) ? selectedUsersSalonId : 'all')
      );
  const branchesForSelectedUsersSalon = effectiveUsersSalonId === 'all'
    ? []
    : branches.filter((branch) => String(branch.salonId || '') === String(effectiveUsersSalonId));
  const effectiveBranchesSalonId = !isSuperAdmin
    ? (defaultSalonId || 'all')
    : (
        selectedBranchesSalonId === 'all'
          ? 'all'
          : (salons.some((shop) => String(shop.id) === String(selectedBranchesSalonId)) ? selectedBranchesSalonId : 'all')
      );
  const effectiveUsersBranchId = effectiveUsersSalonId === 'all'
    ? 'all'
    : (
        selectedUsersBranchId !== 'all' && branchesForSelectedUsersSalon.some((branch) => String(branch.id) === String(selectedUsersBranchId))
          ? selectedUsersBranchId
          : 'all'
      );
  const effectiveBranchFormSalonId = isSuperAdmin
    ? (branchForm.salonId || defaultSalonId)
    : (defaultSalonId || accessControl.currentSalonId || '');
  const effectiveNewUserRole = isSuperAdmin ? newUser.roleName : 'cashier';
  const effectiveNewUserSalonId = isSuperAdmin
    ? (newUser.salonId || defaultSalonId)
    : (defaultSalonId || accessControl.currentSalonId || '');
  const filteredBranches = useMemo(() => {
    if (!isSuperAdmin) {
      return branchesForCurrentSalon;
    }

    if (effectiveBranchesSalonId === 'all') {
      return branches;
    }

    return branches.filter((branch) => String(branch.salonId || '') === String(effectiveBranchesSalonId));
  }, [isSuperAdmin, branches, branchesForCurrentSalon, effectiveBranchesSalonId]);
  const branchCountBySalonId = useMemo(
    () => branches.reduce((accumulator, branch) => {
      const key = String(branch.salonId || '');
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {}),
    [branches],
  );
  const availableBranchOptionsForNewUser = isSuperAdmin
    ? branches.filter((branch) => String(branch.salonId || '') === String(effectiveNewUserSalonId))
    : branchesForCurrentSalon;
  const effectiveNewUserBranchId = !newUser.branchId
    ? (!isSuperAdmin ? (currentBranch?.id || '') : '')
    : (availableBranchOptionsForNewUser.some((branch) => String(branch.id) === String(newUser.branchId)) ? newUser.branchId : '');
  const canCreateUsers = isAdmin;
  const onboardingCandidates = useMemo(
    () => (accessControl.users || []).filter((user) => !user.roles.includes('super_admin')),
    [accessControl.users],
  );
  const effectiveOnboardingAdminUserId = onboarding.adminUserId || onboardingCandidates[0]?.id || '';
  const isEditingSalon = Boolean(onboarding.id);

  const resetBranchForm = () => {
    setBranchForm({
      id: '',
      name: '',
      code: '',
      city: '',
      address: '',
      salonId: '',
    });
  };

  const resetSalonForm = () => {
    setOnboarding({ id: '', name: '', ownerEmail: '', phone: '', city: '', plan: BUSINESS_PLANS[0], adminUserId: '', openTime: DEFAULT_SALON_OPEN_TIME, closeTime: DEFAULT_SALON_CLOSE_TIME });
  };

  const startSalonEdit = (shop) => {
    setActiveSystemPanel('salons');
    setOnboarding({
      id: shop.id,
      name: shop.name || '',
      ownerEmail: shop.ownerEmail || '',
      phone: shop.phone || '',
      city: shop.city || '',
      plan: shop.plan || BUSINESS_PLANS[0],
      adminUserId: '',
      openTime: shop.openTime || DEFAULT_SALON_OPEN_TIME,
      closeTime: shop.closeTime || DEFAULT_SALON_CLOSE_TIME,
    });
    setShowCreateSalon(true);
  };

  const startBranchEdit = (branch) => {
    setActiveSystemPanel('branches');
    setShowBranchForm(true);
    setBranchForm({
      id: branch.id,
      name: branch.name || '',
      code: branch.code || '',
      city: branch.city || '',
      address: branch.address || '',
      salonId: branch.salonId || currentSalon?.id || '',
    });
  };

  const users = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const base = (accessControl.users || []).filter((user) => {
      if (!isSuperAdmin) return true;
      if (effectiveUsersSalonId === 'all') return true;
      if (String(user.salonId || '') !== String(effectiveUsersSalonId)) return false;
      if (effectiveUsersBranchId === 'all') return true;
      return String(user.branchId || '') === String(effectiveUsersBranchId);
    });
    if (!normalized) return base;

    return base.filter((user) =>
      (user.fullName || '').toLowerCase().includes(normalized) ||
      (user.email || '').toLowerCase().includes(normalized) ||
      (user.salonName || '').toLowerCase().includes(normalized) ||
      (user.roles || []).some((role) => role.toLowerCase().includes(normalized)),
    );
  }, [accessControl.users, isSuperAdmin, search, effectiveUsersSalonId, effectiveUsersBranchId]);

  const formatUserCreatedAt = (value) => {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
    return parsed.toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const canResetPasswordForUser = (user) => {
    if (!isAdmin || !user) return false;
    if (String(user.id) === String(currentUser?.id)) return false;
    const primaryRole = getPrimaryRole(user);
    if (isSuperAdmin) return primaryRole !== 'super_admin';
    return primaryRole === 'cashier';
  };
  const canEditUser = (user) => {
    if (!isAdmin || !user) return false;
    const primaryRole = getPrimaryRole(user);
    if (primaryRole === 'super_admin') return false;
    if (isSuperAdmin) return true;
    return String(user.salonId || '') === String(effectiveCurrentSalonId || '') && primaryRole === 'cashier';
  };
  const getEditableRoleOptionsForUser = (user) => {
    if (!user) return [];
    if (isSuperAdmin) {
      return editableRoleCatalog.filter((role) => role.roleName !== 'super_admin');
    }
    return editableRoleCatalog.filter((role) => role.roleName === 'cashier');
  };

  const handleSubmitOnboarding = async (event) => {
    event.preventDefault();
    if (!onboarding.name.trim()) {
      notify('Ingresa el nombre del salón para completar el onboarding.', 'warning');
      return;
    }
    const openTime = normalizeBusinessTime(onboarding.openTime, DEFAULT_SALON_OPEN_TIME);
    const closeTime = normalizeBusinessTime(onboarding.closeTime, DEFAULT_SALON_CLOSE_TIME);
    if (appointmentTimeToMinutes(closeTime) <= appointmentTimeToMinutes(openTime)) {
      notify('La hora de cierre debe ser posterior a la hora de apertura.', 'warning');
      return;
    }

    const created = await onCreateSalon({
      ...onboarding,
      openTime,
      closeTime,
      adminUserId: effectiveOnboardingAdminUserId || '',
    });
    if (created) {
      resetSalonForm();
      setShowCreateSalon(false);
    }
  };

  const handleSubmitNewUser = async (event) => {
    event.preventDefault();

    if (!newUser.fullName.trim() || !newUser.email.trim()) {
      notify('Completa nombre y correo para crear la cuenta.', 'warning');
      return;
    }

    if (newUser.password.trim().length < PASSWORD_MIN_LENGTH) {
      notify(`Define una contraseña temporal de al menos ${PASSWORD_MIN_LENGTH} caracteres.`, 'warning');
      return;
    }

    const resolvedSalonId = isSuperAdmin
      ? effectiveNewUserSalonId
      : (defaultSalonId || accessControl.currentSalonId || '');
    const resolvedBranchId = isSuperAdmin
      ? (effectiveNewUserBranchId || null)
      : (effectiveNewUserBranchId || currentBranch?.id || null);
    const resolvedPassword = newUser.password.trim();

    if (!resolvedSalonId) {
      notify(
        isSuperAdmin
          ? 'Selecciona el salón al que pertenecerá este usuario.'
          : 'Tu cuenta de administrador todavía no está vinculada a un salón.',
        'warning',
      );
      return;
    }

    const created = await onCreateSystemUser({
      fullName: newUser.fullName.trim(),
      email: newUser.email.trim().toLowerCase(),
      password: resolvedPassword,
      roleName: effectiveNewUserRole,
      salonId: resolvedSalonId,
      branchId: resolvedBranchId,
    });

    if (created) {
      notify(`Usuario ${newUser.email.trim().toLowerCase()} creado correctamente.`, 'success');
      setNewUser({
        fullName: '',
        email: '',
        password: '',
        roleName: isSuperAdmin ? 'admin' : 'cashier',
        salonId: '',
        branchId: '',
      });
      setShowCreateUser(false);
    }
  };

  const handleSubmitBranch = async (event) => {
    event.preventDefault();

    const resolvedSalonId = isSuperAdmin
      ? effectiveBranchFormSalonId
      : (defaultSalonId || accessControl.currentSalonId || '');

    if (!resolvedSalonId || !branchForm.name.trim()) {
      notify('Completa el nombre de la sucursal y el salón correspondiente.', 'warning');
      return;
    }

    const created = await onCreateBranch({
      id: branchForm.id || undefined,
      name: branchForm.name.trim(),
      code: branchForm.code.trim(),
      city: branchForm.city.trim(),
      address: branchForm.address.trim(),
      salonId: resolvedSalonId,
    });

    if (created) {
      resetBranchForm();
      setShowBranchForm(false);
    }
  };

  const handleSubmitEditUser = async (payload) => {
    if (!editingUser) return false;
    const targetSalonId = isSuperAdmin
      ? (payload.salonId || null)
      : (currentSalon?.id || accessControl.currentSalonId || null);
    const targetBranchId = payload.branchId || null;
    const nextRoleName = isSuperAdmin ? payload.roleName : 'cashier';

    await onUpdateUserProfile(editingUser, {
      fullName: payload.fullName,
      roleName: nextRoleName,
      salonId: targetSalonId,
      branchId: targetBranchId,
    });
    setEditingUser(null);
    return true;
  };

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-8 animate-in fade-in text-white no-print">
      {isSuperAdmin && (
        <section className="flex flex-wrap gap-3">
          {[{ id: 'salons', label: 'Salones' }, { id: 'branches', label: 'Sucursales' }, { id: 'users', label: 'Usuarios' }].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSystemPanel(item.id)}
              className={`w-full sm:w-auto px-6 py-3 rounded-[1.4rem] text-[10px] font-black uppercase tracking-[0.22em] transition-all border ${
                activeSystemPanel === item.id
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_20px_rgba(201,111,141,0.24)]'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </section>
      )}

      {isSuperAdmin && showCreateSalon && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-5xl bg-slate-950 border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative text-white max-h-[88vh] overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                setShowCreateSalon(false);
                resetSalonForm();
              }}
              className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20"
            >
              <X size={20} />
            </button>

            <form onSubmit={handleSubmitOnboarding}>
              <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Configuración comercial</p>
                  <h3 className="mt-3 text-[2rem] font-black uppercase italic tracking-tighter text-white leading-none">
                    {isEditingSalon ? 'Editar salón' : 'Nuevo salón'}
                  </h3>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Nombre del negocio</label>
                  <input
                    value={onboarding.name}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej. Salón Central"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Correo del dueño</label>
                  <input
                    value={onboarding.ownerEmail}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, ownerEmail: e.target.value }))}
                    placeholder="dueño@salonpro.com"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Teléfono</label>
                  <input
                    value={onboarding.phone}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="0000-0000"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Ciudad</label>
                  <input
                    value={onboarding.city}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Managua"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Plan comercial</label>
                  <select
                    value={onboarding.plan}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, plan: e.target.value }))}
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    {BUSINESS_PLANS.map((plan) => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </select>
                </div>
                {!isEditingSalon && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Admin principal</label>
                  <select
                    value={effectiveOnboardingAdminUserId}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, adminUserId: e.target.value }))}
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    <option value="">Asignar después</option>
                    {onboardingCandidates.map((user) => (
                      <option key={user.id} value={user.id}>
                        {(user.fullName || user.email)}{user.email ? ` - ${user.email}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                )}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Hora de apertura</label>
                  <select
                    value={onboarding.openTime}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, openTime: e.target.value }))}
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    {BUSINESS_TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{formatTime12h(time)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Hora de cierre</label>
                  <select
                    value={onboarding.closeTime}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, closeTime: e.target.value }))}
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    {BUSINESS_TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>{formatTime12h(time)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={onboardingBusy}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all flex items-center justify-center gap-3 shadow-[0_12px_30px_rgba(201,111,141,0.24)]"
                >
                  {onboardingBusy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {isEditingSalon ? 'Guardar salón' : 'Crear salón'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateSalon(false);
                    resetSalonForm();
                  }}
                  className="sm:w-56 bg-white/5 hover:bg-white/10 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBranchForm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-4xl bg-slate-950 border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative text-white max-h-[88vh] overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                setShowBranchForm(false);
                resetBranchForm();
              }}
              className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20"
            >
              <X size={20} />
            </button>

            <form onSubmit={handleSubmitBranch}>
              <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Cobertura operativa</p>
                  <h3 className="mt-3 text-[2rem] font-black uppercase italic tracking-tighter text-white leading-none">
                    {branchForm.id ? 'Editar sucursal' : 'Nueva sucursal'}
                  </h3>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {isSuperAdmin && (
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Salón</label>
                    <select
                      value={effectiveBranchFormSalonId}
                      onChange={(e) => setBranchForm((prev) => ({ ...prev, salonId: e.target.value }))}
                      className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                    >
                      <option value="">Selecciona un salón</option>
                      {salons.map((shop) => (
                        <option key={shop.id} value={shop.id}>{shop.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Nombre de sucursal</label>
                  <input
                    value={branchForm.name}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej. Sucursal Metrocentro"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Código interno</label>
                  <input
                    value={branchForm.code}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="Ej. BR-01"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Ciudad</label>
                  <input
                    value={branchForm.city}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Managua"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Dirección</label>
                  <input
                    value={branchForm.address}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Centro comercial, local 12"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
              </div>

              <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={onboardingBusy}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all flex items-center justify-center gap-3 shadow-[0_12px_30px_rgba(201,111,141,0.24)]"
                >
                  {onboardingBusy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {branchForm.id ? 'Guardar cambios' : 'Crear sucursal'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBranchForm(false);
                    resetBranchForm();
                  }}
                  className="sm:w-56 bg-white/5 hover:bg-white/10 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isSuperAdmin && (
        <section className="flex flex-wrap gap-3">
          {[{ id: 'branches', label: 'Sucursales' }, { id: 'users', label: 'Usuarios' }].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSystemPanel(item.id)}
              className={`w-full sm:w-auto px-6 py-3 rounded-[1.4rem] text-[10px] font-black uppercase tracking-[0.22em] transition-all border ${
                activeSystemPanel === item.id
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_20px_rgba(201,111,141,0.24)]'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </section>
      )}

      {activeSystemPanel === 'salons' && (
        <section className="rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="px-5 md:px-8 py-6 md:py-7 border-b border-slate-800 bg-black/40">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">Negocios activos</p>
                <h4 className="mt-3 text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Salones registrados</h4>
              </div>

              <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-3">
                <div className="rounded-[1.6rem] border border-white/5 bg-slate-950 px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {salons.length} salones
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetSalonForm();
                    setShowCreateSalon(true);
                  }}
                  className="px-5 py-4 rounded-[1.6rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Nuevo salón
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8">
            {salons.length > 0 ? (
              <>
                <div className="grid gap-4 md:hidden">
                  {salons.map((shop) => (
                    <div key={shop.id} className="rounded-[2rem] border border-white/5 bg-black/25 p-5">
                      <p className="text-lg font-black uppercase italic tracking-tighter text-white break-words">{shop.name || 'Sin nombre'}</p>
                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Ciudad</p>
                          <p className="mt-1 font-bold text-slate-300">{shop.city || 'Sin ciudad'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Propietario</p>
                          <p className="mt-1 font-bold text-slate-300 break-all">{shop.ownerEmail || 'Sin correo del dueño'}</p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex px-3 py-2 rounded-xl border border-white/10 bg-slate-950 text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">
                            {shop.plan || 'Sin plan'}
                          </span>
                          <span className="text-sm font-black text-white">{branchCountBySalonId[String(shop.id)] || 0} suc.</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-950 px-3 py-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Horario</span>
                          <span className="text-[11px] font-black text-slate-200">{formatTime12h(shop.openTime || DEFAULT_SALON_OPEN_TIME)} - {formatTime12h(shop.closeTime || DEFAULT_SALON_CLOSE_TIME)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => startSalonEdit(shop)}
                          className="mt-1 w-full rounded-2xl border border-[#d94f83] bg-[#d94f83] px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-[0_10px_22px_rgba(217,79,131,0.22)] transition-all hover:bg-[#c83f75]"
                        >
                          Editar salón
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block rounded-[2.4rem] border border-white/5 bg-black/35 overflow-x-auto">
                <div className="min-w-[1180px]">
                  <div className="grid grid-cols-[minmax(250px,1.2fr)_150px_minmax(280px,1.1fr)_130px_170px_150px_150px] gap-4 px-6 py-5 border-b border-white/5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                    <span className="whitespace-nowrap">Salón</span>
                    <span className="whitespace-nowrap">Ciudad</span>
                    <span className="whitespace-nowrap">Propietario</span>
                    <span className="whitespace-nowrap">Plan</span>
                    <span className="whitespace-nowrap">Horario</span>
                    <span className="whitespace-nowrap">Sucursales</span>
                    <span></span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {salons.map((shop) => (
                      <div
                        key={shop.id}
                        className="grid grid-cols-[minmax(250px,1.2fr)_150px_minmax(280px,1.1fr)_130px_170px_150px_150px] gap-4 px-6 py-5 items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate whitespace-nowrap text-base font-black uppercase italic tracking-tighter text-white">
                            {shop.name || 'Sin nombre'}
                          </p>
                        </div>
                        <div>
                          <p className="truncate whitespace-nowrap text-sm font-bold text-slate-300">
                            {shop.city || 'Sin ciudad'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate whitespace-nowrap text-sm font-bold text-slate-300">
                            {shop.ownerEmail || 'Sin correo del dueño'}
                          </p>
                          {shop.phone && (
                            <p className="mt-2 truncate whitespace-nowrap text-[11px] text-slate-500">
                              {shop.phone}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="inline-flex whitespace-nowrap px-3 py-2 rounded-xl border border-white/10 bg-slate-950 text-[10px] font-black uppercase tracking-[0.14em] text-slate-200">
                            {shop.plan || 'Sin plan'}
                          </span>
                        </div>
                        <div>
                          <p className="whitespace-nowrap text-[11px] font-black text-slate-200">
                            {formatTime12h(shop.openTime || DEFAULT_SALON_OPEN_TIME)} - {formatTime12h(shop.closeTime || DEFAULT_SALON_CLOSE_TIME)}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-black text-white">
                            {branchCountBySalonId[String(shop.id)] || 0}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => startSalonEdit(shop)}
                          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#d94f83] bg-[#d94f83] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-[0_10px_22px_rgba(217,79,131,0.20)] transition-all hover:bg-[#c83f75]"
                        >
                          <Edit2 size={13} /> Editar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </>
            ) : (
              <div className="rounded-[2.4rem] border border-white/5 bg-black/20 px-6 py-16 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Todavía no hay salones registrados</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeSystemPanel === 'branches' && (
        <section className="rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="px-5 md:px-8 py-6 md:py-7 border-b border-slate-800 bg-black/40">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">Cobertura</p>
                <h4 className="mt-3 text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Sucursales registradas</h4>
              </div>

              <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-3">
                {isSuperAdmin && (
                  <div className="w-full sm:w-[260px]">
                    <select
                      value={effectiveBranchesSalonId}
                      onChange={(e) => setSelectedBranchesSalonId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] px-5 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                    >
                      <option value="all">Todos los salones</option>
                      {salons.map((shop) => (
                        <option key={shop.id} value={shop.id}>{shop.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    resetBranchForm();
                    setShowBranchForm(true);
                  }}
                  className="px-5 py-4 rounded-[1.6rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Nueva sucursal
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8">
            {filteredBranches.length > 0 ? (
              <>
                <div className="grid gap-4 md:hidden">
                  {filteredBranches.map((branch) => (
                    <div key={branch.id} className="rounded-[2rem] border border-white/5 bg-black/25 p-5">
                      <p className="text-lg font-black uppercase italic tracking-tighter text-white break-words">{branch.name || 'Sin nombre'}</p>
                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Salón</p>
                          <p className="mt-1 font-bold text-slate-300 break-words">{branch.salonName || currentSalon?.name || 'Sin salón'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Código</p>
                            <p className="mt-1 font-bold text-slate-300">{branch.code || 'Sin código'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Ciudad</p>
                            <p className="mt-1 font-bold text-slate-300">{branch.city || 'Sin ciudad'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Dirección</p>
                          <p className="mt-1 font-bold text-slate-300 break-words">{branch.address || 'Sin dirección'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startBranchEdit(branch)}
                          className="mt-2 w-full px-4 py-3 rounded-[1.3rem] border border-[#d94f83] bg-[#d94f83] hover:bg-[#c83f75] text-white font-black uppercase italic text-[10px] tracking-[0.18em] transition-all flex items-center justify-center gap-2 shadow-[0_10px_22px_rgba(217,79,131,0.22)]"
                        >
                          <Edit2 size={14} />
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block rounded-[2.4rem] border border-white/5 bg-black/35 overflow-x-auto">
                <div className="min-w-[1180px]">
                  <div className="grid grid-cols-[minmax(250px,1.1fr)_minmax(250px,1fr)_150px_160px_minmax(270px,1.3fr)_150px] gap-4 px-6 py-5 border-b border-white/5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                    <span className="whitespace-nowrap">Sucursal</span>
                    <span className="whitespace-nowrap">Salón</span>
                    <span className="whitespace-nowrap">Código</span>
                    <span className="whitespace-nowrap">Ciudad</span>
                    <span className="whitespace-nowrap">Dirección</span>
                    <span className="whitespace-nowrap">Acciones</span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {filteredBranches.map((branch) => (
                      <div
                        key={branch.id}
                        className="grid grid-cols-[minmax(250px,1.1fr)_minmax(250px,1fr)_150px_160px_minmax(270px,1.3fr)_150px] gap-4 px-6 py-5 items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate whitespace-nowrap text-base font-black uppercase italic tracking-tighter text-white">
                            {branch.name || 'Sin nombre'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate whitespace-nowrap text-sm font-bold text-slate-300">
                            {branch.salonName || currentSalon?.name || 'Sin salón'}
                          </p>
                        </div>
                        <div>
                          <p className="truncate whitespace-nowrap text-sm font-bold text-slate-300">
                            {branch.code || 'Sin código'}
                          </p>
                        </div>
                        <div>
                          <p className="truncate whitespace-nowrap text-sm font-bold text-slate-300">
                            {branch.city || 'Sin ciudad'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate whitespace-nowrap text-sm font-bold text-slate-300">
                            {branch.address || 'Sin dirección'}
                          </p>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => startBranchEdit(branch)}
                            className="px-4 py-3 rounded-[1.3rem] border border-[#d94f83] bg-[#d94f83] hover:bg-[#c83f75] text-white font-black uppercase italic text-[10px] tracking-[0.18em] transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_10px_22px_rgba(217,79,131,0.20)]"
                          >
                            <Edit2 size={14} />
                            Editar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </>
            ) : (
              <div className="rounded-[2.4rem] border border-white/5 bg-black/20 px-6 py-16 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Todavía no hay sucursales registradas</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeSystemPanel === 'users' && (
      <section className="rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-5 md:px-8 py-6 md:py-7 border-b border-slate-800 bg-black/40">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div>
              <h4 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Usuarios del sistema</h4>
            </div>

              <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-3">
              {canCreateUsers && (
                <button
                  type="button"
                  onClick={() => setShowCreateUser((prev) => !prev)}
                  className="px-5 py-4 rounded-[1.6rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} /> {showCreateUser ? 'Cerrar alta' : 'Nuevo usuario'}
                </button>
              )}
              {isSuperAdmin && (
                <div className="w-full sm:w-[260px]">
                  <select
                    value={effectiveUsersSalonId}
                    onChange={(e) => {
                      setSelectedUsersSalonId(e.target.value);
                      setSelectedUsersBranchId('all');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] px-5 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    <option value="all">Todos los salones</option>
                    {salons.map((shop) => (
                      <option key={shop.id} value={shop.id}>{shop.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {(isSuperAdmin ? effectiveUsersSalonId !== 'all' : branchesForCurrentSalon.length > 0) && (
                <div className="w-full sm:w-[240px]">
                  <select
                    value={effectiveUsersBranchId}
                    onChange={(e) => setSelectedUsersBranchId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] px-5 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    <option value="all">Todas las sucursales</option>
                    {(isSuperAdmin ? branchesForSelectedUsersSalon : branchesForCurrentSalon).map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="w-full xl:w-[360px] relative">
                <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, correo, rol, salón o sucursal"
                  className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] pl-5 pr-12 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8 space-y-5">
          {canCreateUsers && showCreateUser && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
              <div className="w-full max-w-4xl bg-slate-950 border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative text-white max-h-[88vh] overflow-y-auto custom-scrollbar">
                <button
                  type="button"
                  onClick={() => setShowCreateUser(false)}
                  className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20"
                >
                  <X size={20} />
                </button>

                <form onSubmit={handleSubmitNewUser}>
                  <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-5 min-w-0">
                      <div className="w-14 h-14 rounded-[1.6rem] bg-indigo-600 flex items-center justify-center text-white shadow-[0_0_30px_rgba(201,111,141,0.32)] shrink-0">
                        <ShieldCheck size={24} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[2rem] font-black uppercase italic tracking-tighter text-white leading-none">
                          Nuevo usuario
                        </h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300 mt-2 leading-none">
                          Control de accesos
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Nombre completo</label>
                      <input
                        value={newUser.fullName}
                        onChange={(e) => setNewUser((prev) => ({ ...prev, fullName: e.target.value }))}
                        placeholder="Ej. Administrador Sistema"
                        className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Correo de acceso</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="Ej. admin@salonpro.com"
                        className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Contraseña temporal</label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
                        className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                      />
                    </div>

                    <div className={`grid grid-cols-1 ${isSuperAdmin ? 'md:grid-cols-[1fr_1fr_1.2fr_1.2fr]' : 'md:grid-cols-[1fr_1fr_1.2fr]'} gap-6`}>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Rol de acceso</label>
                        <select
                          value={effectiveNewUserRole}
                          onChange={(e) => setNewUser((prev) => ({ ...prev, roleName: e.target.value }))}
                          disabled={!isSuperAdmin}
                          className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic disabled:opacity-60"
                        >
                          {isSuperAdmin && <option value="admin">Administrador</option>}
                          <option value="cashier">Caja</option>
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Estado de cuenta</label>
                        <div className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white italic">
                          Activo
                        </div>
                      </div>

                      {isSuperAdmin && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Salón</label>
                          <select
                            value={effectiveNewUserSalonId}
                            onChange={(e) => setNewUser((prev) => ({ ...prev, salonId: e.target.value, branchId: '' }))}
                            className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                          >
                            <option value="">Selecciona un salón</option>
                            {salons.map((shop) => (
                              <option key={shop.id} value={shop.id}>{shop.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(isSuperAdmin ? availableBranchOptionsForNewUser.length > 0 : branchesForCurrentSalon.length > 0) && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Sucursal</label>
                          <select
                            value={effectiveNewUserBranchId}
                            onChange={(e) => setNewUser((prev) => ({ ...prev, branchId: e.target.value }))}
                            className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                          >
                            <option value="">General / sin sucursal</option>
                            {(isSuperAdmin ? availableBranchOptionsForNewUser : branchesForCurrentSalon).map((branch) => (
                              <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={creatingUser}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all flex items-center justify-center gap-3 shadow-[0_12px_30px_rgba(201,111,141,0.24)]"
                    >
                      {creatingUser ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Guardar configuración de acceso
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
{users.length > 0 && (
            <>
            <div className="grid gap-4 md:hidden">
              {users.map((user) => {
                const primaryRole = getPrimaryRole(user);
                const roleMeta = primaryRole
                  ? (ROLE_META[primaryRole] || { label: primaryRole, badge: 'bg-slate-700 text-white border-slate-500' })
                  : { label: 'Sin rol', badge: 'bg-slate-950 text-slate-400 border-slate-700' };
                const displayName = user.fullName || user.email || 'Usuario sin nombre';
                const scopeLabel = isSuperAdmin
                  ? [user.salonName, user.branchName].filter(Boolean).join(' • ')
                  : (user.branchName || '');
                return (
                  <div key={user.id} className="rounded-[2rem] border border-white/5 bg-black/25 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-lg font-black uppercase italic tracking-tighter text-white break-words">{displayName}</p>
                        <p className="mt-2 text-sm font-bold text-slate-300 break-all">{user.email || 'Sin correo'}</p>
                      </div>
                      <span className={`inline-flex shrink-0 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] ${roleMeta.badge}`}>
                        {roleMeta.label}
                      </span>
                    </div>
                    {scopeLabel && (
                      <p className="mt-4 text-[11px] font-bold text-slate-500 break-words">{scopeLabel}</p>
                    )}
                    {canResetPasswordForUser(user) && (
                      <button
                        type="button"
                        onClick={() => setResetPasswordTarget(user)}
                        className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400 hover:text-indigo-300 transition-all"
                      >
                        Restablecer contraseña
                      </button>
                    )}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-300">{formatUserCreatedAt(user.createdAt)}</span>
                      {canEditUser(user) ? (
                        <button
                          type="button"
                          onClick={() => setEditingUser(user)}
                          disabled={savingUserId === user.id}
                          className="px-4 py-3 rounded-[1rem] bg-slate-950 border border-slate-800 hover:border-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.18em] transition-all flex items-center gap-2 disabled:opacity-60"
                        >
                          <Edit2 size={14} />
                          Editar
                        </button>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Sin edición</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block rounded-[2.4rem] border border-white/5 bg-black/35 overflow-hidden">
              <div className="grid grid-cols-[minmax(170px,1.15fr)_minmax(230px,1.45fr)_minmax(120px,0.7fr)_115px_112px] gap-3 px-5 py-5 border-b border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                <span>Nombre de usuario</span>
                <span>Correo</span>
                <span>Rol</span>
                <span>Fecha de alta</span>
                <span>Acciones</span>
              </div>

              <div className="divide-y divide-white/5">
                {users.map((user) => {
                  const primaryRole = getPrimaryRole(user);
                  const roleMeta = primaryRole
                    ? (ROLE_META[primaryRole] || { label: primaryRole, badge: 'bg-slate-700 text-white border-slate-500' })
                    : { label: 'Sin rol', badge: 'bg-slate-950 text-slate-400 border-slate-700' };
                  const displayName = user.fullName || user.email || 'Usuario sin nombre';

                  return (
                    <div
                      key={user.id}
                      className="grid grid-cols-[minmax(170px,1.15fr)_minmax(230px,1.45fr)_minmax(120px,0.7fr)_115px_112px] gap-3 px-5 py-5 items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black uppercase italic tracking-tighter text-white break-words">
                          {displayName}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-300 break-all leading-relaxed">
                          {user.email || 'Sin correo'}
                        </p>
                        {(() => {
                          const scopeLabel = isSuperAdmin
                            ? [user.salonName, user.branchName].filter(Boolean).join(' • ')
                            : (user.branchName || '');
                          return scopeLabel ? (
                            <p className="mt-1 text-[10px] text-slate-500 truncate">
                              {scopeLabel}
                            </p>
                          ) : null;
                        })()}
                        {canResetPasswordForUser(user) && (
                          <button
                            type="button"
                            onClick={() => setResetPasswordTarget(user)}
                            className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-indigo-400 hover:text-indigo-300 transition-all"
                          >
                            Restablecer contraseña
                          </button>
                        )}
                      </div>

                      <div>
                        <span className={`inline-flex max-w-full px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-[0.16em] ${roleMeta.badge}`}>
                          {roleMeta.label}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-300">
                        {formatUserCreatedAt(user.createdAt)}
                      </div>

                      <div className="flex items-center justify-end">
                        {canEditUser(user) ? (
                          <button
                            type="button"
                            onClick={() => setEditingUser(user)}
                            disabled={savingUserId === user.id}
                            className="w-full px-3 py-2.5 rounded-[1rem] bg-slate-950 border border-slate-800 hover:border-indigo-500 text-white font-black uppercase italic text-[9px] tracking-[0.14em] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            <Edit2 size={14} />
                            Editar
                          </button>
                        ) : (
                          <span className="text-right text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                            Sin edición
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
          )}

          {!users.length && (
            <div className="rounded-[2.4rem] border border-dashed border-slate-800 bg-black/20 px-8 py-16 text-center">
              <p className="text-[11px] font-black uppercase italic tracking-[0.24em] text-slate-500">
            No encontramos usuarios con ese criterio de búsqueda
              </p>
            </div>
          )}

          {resetPasswordTarget && (
            <Suspense fallback={accessUiFallback}>
                <PasswordActionModal
              title="Contraseña temporal"
              subtitle={resetPasswordTarget.fullName || resetPasswordTarget.email}
              submitLabel="Guardar contraseña temporal"
              busy={resettingPasswordUserId === resetPasswordTarget.id}
                  onClose={() => setResetPasswordTarget(null)}
                  onSubmit={async ({ nextPassword }) => {
                    const success = await onResetUserPassword(resetPasswordTarget, nextPassword);
                    if (success) {
                      notify(`Contraseña temporal actualizada para ${resetPasswordTarget.email}.`, 'success');
                      setResetPasswordTarget(null);
                      return true;
                    }
                    return false;
                  }}
                  nextLabel="Nueva contraseña temporal"
                  nextPlaceholder="Mínimo 6 caracteres"
                  initialNextPassword=""
                  initialConfirmPassword=""
                  nextInputType="password"
                  confirmInputType="password"
                />
            </Suspense>
              )}

          {editingUser && (
            <Suspense fallback={accessUiFallback}>
            <UserEditorModal
              key={editingUser.id}
              user={editingUser}
              roleOptions={getEditableRoleOptionsForUser(editingUser)}
              salons={isSuperAdmin ? salons : [currentSalon].filter(Boolean)}
              branches={isSuperAdmin ? branches : branchesForCurrentSalon}
              isSuperAdmin={isSuperAdmin}
              busy={savingUserId === editingUser.id}
              onClose={() => setEditingUser(null)}
              onSubmit={handleSubmitEditUser}
            />
            </Suspense>
          )}
        </div>
      </section>
      )}
    </div>
  );
}

export default function App() {
  const getScopedActiveTabStorageKey = React.useCallback(
    (userId) => `${AUTH_RUNTIME_CACHE_KEY}:activeTab:${userId}`,
    [],
  );

  const readRuntimeCache = React.useCallback(() => {
    if (typeof window === 'undefined') return null;

    try {
      const raw = window.localStorage.getItem(AUTH_RUNTIME_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.error('No se pudo leer el cache local de SalonPro:', error);
      return null;
    }
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(hasSupabaseConfig);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [showSelfPasswordModal, setShowSelfPasswordModal] = useState(false);
  const [accessControl, setAccessControl] = useState({ roles: [], users: [], currentUserRoles: [], currentSalonId: null, currentBranchId: null, salons: [], branches: [] });
  const [accessLoading, setAccessLoading] = useState(false);
  const [clientDirectoryData, setClientDirectoryData] = useState({ clients: [], appointments: [], stylists: [] });
  const [clientDirectoryLoaded, setClientDirectoryLoaded] = useState(false);
  const [clientDirectoryWarnings, setClientDirectoryWarnings] = useState([]);
  const [operationalWarnings, setOperationalWarnings] = useState([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [savingUserId, setSavingUserId] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [superAdminViewSalonId, setSuperAdminViewSalonId] = useState('');
  const [feedbackToast, setFeedbackToast] = useState(null);
  const [feedbackToastQueue, setFeedbackToastQueue] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const feedbackTimerRef = useRef(null);
  const reservationNearExpiryAlertsRef = useRef(new Set());
  const reservationExpiredAlertsRef = useRef(new Set());
  const reservationProcessingAlertsRef = useRef(new Set());
  
  const useBrowserCache = isLocalDevModeEnabled && !hasSupabaseConfig && !shouldBlockWithoutSupabase;
  const localDevStorage = useBrowserCache ? globalThis.sessionStorage : null;
  const [appointments, setAppointments] = useState(() => {
    const saved = localDevStorage?.getItem('sp_dev_appointments') || null;
    const list = saved ? JSON.parse(saved) : [];
    return list.map(a => ({
      ...a,
      type: a.type || 'reserva',
      status: a.status || 'Confirmada',
      durationMinutes: Number(a.durationMinutes) > 0 ? Number(a.durationMinutes) : 30,
      isPaid: !!a.isPaid
    }));
  });
  
  const [services, setServices] = useState(() => {
    const saved = localDevStorage?.getItem('sp_dev_services') || null;
    if (saved) return JSON.parse(saved);
    if (!shouldSeedLocalDevMode) return [];
    return [
      { id: '1', name: 'Corte y brushing', price: 450, category: 'Cabello' },
      { id: '2', name: 'Manicure spa', price: 380, category: 'Uñas' },
      { id: '3', name: 'Tinte global', price: 1200, category: 'Cabello' },
      { id: '4', name: 'Tratamiento hidratante', price: 650, category: 'Tratamientos' },
      { id: '5', name: 'Serum capilar premium', price: 350, category: 'Producto' },
      { id: '6', name: 'Paquete Belleza Total', price: 1750, category: 'Combo', items: ['1', '2', '4'] },
      {
        id: '7',
        name: 'Servicio gratis por fidelidad',
        price: 0,
        category: 'Promocion',
        appliesTo: 'Servicio',
        discountType: 'percentage',
        discountValue: 100,
        targetServiceIds: ['1'],
        isOptional: true,
      },
    ];
  });
  
  const [clients, setClients] = useState(() => {
    const saved = localDevStorage?.getItem('sp_dev_clients') || null;
    const list = saved ? JSON.parse(saved) : (
      !shouldSeedLocalDevMode
        ? []
        : [{ id: 'c1', name: 'Carlos Mendoza', phone: '8888-0001', notes: 'Prefiere servicio con tijera arriba.', points: 5, createdAt: new Date().toISOString() }]
    );
    return list.map(client => ({ ...client, phone: formatPhoneNumber(client.phone || '') }));
  });

  const [stylists, setStylists] = useState(() => {
    const saved = localDevStorage?.getItem('sp_dev_stylists') || null;
    const list = saved ? JSON.parse(saved) : (!shouldSeedLocalDevMode ? [] : MOCK_STYLISTS.map(b => ({ ...b, salary: 0, phone: '', email: '' })));
    return list.map((b, idx) => ensureStylistTheme(b, idx));
  });
  const [posSales, setPosSales] = useState(() => {
    const saved = localDevStorage?.getItem('sp_dev_pos_sales') || null;
    return saved ? JSON.parse(saved) : [];
  });
  const [cashSessions, setCashSessions] = useState(() => {
    const saved = localDevStorage?.getItem('sp_dev_cash_sessions') || null;
    return saved ? JSON.parse(saved) : [];
  });
  const [cashMovements, setCashMovements] = useState(() => {
    const saved = localDevStorage?.getItem('sp_dev_cash_movements') || null;
    return saved ? JSON.parse(saved) : [];
  });
  const [payrollPayments, setPayrollPayments] = useState(() => {
    const saved = localDevStorage?.getItem('sp_dev_payroll_payments') || null;
    return saved ? JSON.parse(saved) : [];
  });
  const [inventoryItems, setInventoryItems] = useState([]);
  
  const [viewDate, setViewDate] = useState(getTodayString());
  const bootstrapCompletedRef = useRef(false);
  const hydratedFromCacheRef = useRef(false);
  const cacheRestoreAttemptedRef = useRef(false);
  const activeTabHydratedRef = useRef(false);
  const lastSessionUserIdRef = useRef(null);
  const currentUserRoles = useMemo(() => accessControl.currentUserRoles || [], [accessControl.currentUserRoles]);
  const isSuperAdmin = currentUserRoles.includes('super_admin');
  const availableSalons = useMemo(() => accessControl.salons || [], [accessControl.salons]);
  const availableBranches = useMemo(() => accessControl.branches || [], [accessControl.branches]);
  const effectiveOperationalSalonId = isSuperAdmin
    ? (superAdminViewSalonId || availableSalons[0]?.id || null)
    : (accessControl.currentSalonId || null);
  const resolvedOperationalSalonId = effectiveOperationalSalonId || availableSalons[0]?.id || null;
  const effectiveOperationalBranchId = isSuperAdmin
    ? (
        availableBranches.find((branch) => String(branch.salonId || '') === String(resolvedOperationalSalonId || ''))?.id
        || null
      )
    : (accessControl.currentBranchId || null);
  const resolvedOperationalBranchId = effectiveOperationalBranchId
    || availableBranches.find((branch) => String(branch.salonId || '') === String(resolvedOperationalSalonId || ''))?.id
    || null;
  const superAdminScopeOverride = useMemo(() => (
    isSuperAdmin && resolvedOperationalSalonId
      ? { currentSalonId: resolvedOperationalSalonId, currentBranchId: resolvedOperationalBranchId }
      : {}
  ), [isSuperAdmin, resolvedOperationalSalonId, resolvedOperationalBranchId]);

  const dismissFeedbackToast = React.useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    setFeedbackToast(null);
  }, []);

  const notify = React.useCallback((message, tone = 'info') => {
    const nextToast = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      tone,
    };

    setFeedbackToastQueue((currentQueue) => [...currentQueue, nextToast]);
  }, []);

  useEffect(() => {
    if (feedbackToast || feedbackToastQueue.length === 0) return;

    const [nextToast, ...remainingQueue] = feedbackToastQueue;
    setFeedbackToast(nextToast);
    setFeedbackToastQueue(remainingQueue);
  }, [feedbackToast, feedbackToastQueue]);

  const renderPersistentWarningBanner = (title, messages = []) => (
    <div className="mx-8 mt-6 rounded-[1.8rem] border border-amber-500/25 bg-amber-500/10 px-6 py-5 text-amber-100 shadow-[0_12px_30px_rgba(245,158,11,0.08)]">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
          <Info size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300 leading-none">{title}</p>
          <div className="mt-3 space-y-2">
            {messages.map((message, index) => (
              <p key={`${title}-${index}`} className="text-sm font-bold leading-relaxed text-amber-50">
                {message}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const confirmAction = (options) => new Promise((resolve) => {
    setConfirmState({
      title: options?.title || 'Confirmar acción',
      message: options?.message || '',
      confirmLabel: options?.confirmLabel || 'Confirmar',
      cancelLabel: options?.cancelLabel || 'Cancelar',
      tone: options?.tone || 'danger',
      resolve,
    });
  });

  const feedbackContextValue = useMemo(() => ({
    notify,
    confirmAction,
  }), [notify]);

  const clearScopedOperationalState = () => {
    setAppointments([]);
    setServices([]);
    setClients([]);
    setStylists([]);
    setPosSales([]);
    setCashSessions([]);
    setCashMovements([]);
    setPayrollPayments([]);
    setInventoryItems([]);
    setOperationalWarnings([]);
    setClientDirectoryData({ clients: [], appointments: [], stylists: [] });
    setClientDirectoryLoaded(false);
    setClientDirectoryWarnings([]);
  };

  const restoreRuntimeCache = React.useCallback((userId) => {
    if (!userId || cacheRestoreAttemptedRef.current) return false;

    const cached = readRuntimeCache();
    if (!cached || String(cached.userId || '') !== String(userId)) {
      cacheRestoreAttemptedRef.current = true;
      hydratedFromCacheRef.current = false;
      return false;
    }

    setServices(Array.isArray(cached.services) ? cached.services : []);
    setClients(
      Array.isArray(cached.clients)
        ? cached.clients.map((client) => ({ ...client, phone: formatPhoneNumber(client.phone || '') }))
        : [],
    );
    setStylists(
      Array.isArray(cached.stylists)
        ? cached.stylists.map((stylist, index) => ensureStylistTheme(stylist, index))
        : [],
    );
    setAppointments(Array.isArray(cached.appointments) ? cached.appointments : []);
    setPosSales(Array.isArray(cached.posSales) ? cached.posSales : []);
    setCashSessions(Array.isArray(cached.cashSessions) ? cached.cashSessions : []);
    setCashMovements(Array.isArray(cached.cashMovements) ? cached.cashMovements : []);
    setPayrollPayments(Array.isArray(cached.payrollPayments) ? cached.payrollPayments : []);
    setInventoryItems(Array.isArray(cached.inventoryItems) ? cached.inventoryItems : []);
    setOperationalWarnings(Array.isArray(cached.operationalWarnings) ? cached.operationalWarnings : []);
    setClientDirectoryData(cached.clientDirectoryData || { clients: [], appointments: [], stylists: [] });
    setClientDirectoryLoaded(Boolean(cached.clientDirectoryLoaded));
    setClientDirectoryWarnings(Array.isArray(cached.clientDirectoryWarnings) ? cached.clientDirectoryWarnings : []);
    setSuperAdminViewSalonId(cached.superAdminViewSalonId || '');

    hydratedFromCacheRef.current = true;
    cacheRestoreAttemptedRef.current = true;
    bootstrapCompletedRef.current = true;
    return true;
  }, [readRuntimeCache]);

  useEffect(() => () => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    if (confirmState?.resolve) {
      confirmState.resolve(false);
    }
  }, [confirmState]);

  useEffect(() => {
    if (typeof window === 'undefined' || !session?.user?.id) return undefined;

    window.localStorage.setItem(getScopedActiveTabStorageKey(session.user.id), activeTab);
    return undefined;
  }, [activeTab, getScopedActiveTabStorageKey, session?.user?.id]);

  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('sp_dev_appointments', JSON.stringify(appointments));
  }, [appointments, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('sp_dev_services', JSON.stringify(services));
  }, [services, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('sp_dev_clients', JSON.stringify(clients));
  }, [clients, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('sp_dev_stylists', JSON.stringify(stylists));
  }, [stylists, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('sp_dev_pos_sales', JSON.stringify(posSales));
  }, [posSales, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('sp_dev_cash_sessions', JSON.stringify(cashSessions));
  }, [cashSessions, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('sp_dev_cash_movements', JSON.stringify(cashMovements));
  }, [cashMovements, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('sp_dev_payroll_payments', JSON.stringify(payrollPayments));
  }, [payrollPayments, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.removeItem('sp_dev_revenue');
  }, [useBrowserCache, localDevStorage]);
  const [modals, setModals] = useState({ 
    appointment: false, service: false, finalize: false, client: false, clientDetail: false, appointmentActions: false, rescheduleAppointment: false, transferAppointment: false, paymentReceipt: false, staffSettlement: false, posSaleReceipt: false, cashClosureReceipt: false
  });
  
  const [selectedData, setSelectedData] = useState({ 
    appointment: null, service: null, finalize: null, client: null, appointmentActions: null, rescheduleAppointment: null, transferAppointment: null, paymentReceipt: null, staffSettlement: null, posSaleReceipt: null, cashClosureReceipt: null
  });

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;
    let authBootstrapTimedOut = false;
    const authBootstrapTimeout = window.setTimeout(() => {
      if (!mounted) return;
      authBootstrapTimedOut = true;
      console.error('La restauración de sesión tardó demasiado y se canceló para mostrar el login.');
      setSession(null);
      setAuthError('La sesión guardada tardó demasiado en responder. Ingresa de nuevo.');
      setAuthLoading(false);
    }, 6000);

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!mounted || authBootstrapTimedOut) return;
        window.clearTimeout(authBootstrapTimeout);
        if (error) {
          console.error('No se pudo restaurar la sesión:', error);
          setAuthError('No pude restaurar la sesión guardada.');
        }
        const restoredSession = data.session ?? null;
        const restoredUserId = restoredSession?.user?.id || null;
        lastSessionUserIdRef.current = restoredUserId;
        cacheRestoreAttemptedRef.current = false;
        if (restoredUserId) {
          restoreRuntimeCache(restoredUserId);
        }
        setSession(restoredSession);
        setAuthLoading(false);
      })
      .catch((error) => {
        if (!mounted || authBootstrapTimedOut) return;
        window.clearTimeout(authBootstrapTimeout);
        console.error('Falló la verificación de sesión:', error);
        setSession(null);
        setAuthError('No pude verificar la sesión guardada. Ingresa de nuevo.');
        setAuthLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      const previousUserId = lastSessionUserIdRef.current;
      const nextUserId = nextSession?.user?.id || null;
      const userChanged = previousUserId !== nextUserId;

      if (userChanged) {
        bootstrapCompletedRef.current = false;
        hydratedFromCacheRef.current = false;
        cacheRestoreAttemptedRef.current = false;
        activeTabHydratedRef.current = false;
        clearScopedOperationalState();
        setActiveTab('dashboard');
        if (nextUserId) {
          restoreRuntimeCache(nextUserId);
          setLoading(!hydratedFromCacheRef.current);
        } else {
          setLoading(false);
        }
      } else if (event === 'SIGNED_IN' && nextUserId && !cacheRestoreAttemptedRef.current) {
        restoreRuntimeCache(nextUserId);
      }
      lastSessionUserIdRef.current = nextUserId;
      setSession(nextSession ?? null);
      setAuthError('');
    });

    return () => {
      mounted = false;
      window.clearTimeout(authBootstrapTimeout);
      subscription.unsubscribe();
    };
  }, [restoreRuntimeCache]);

  useEffect(() => {
    if (typeof window === 'undefined' || !session?.user?.id || accessLoading || activeTabHydratedRef.current) {
      return undefined;
    }

    const cachedTab = window.localStorage.getItem(getScopedActiveTabStorageKey(session.user.id));
    if (cachedTab) {
      setActiveTab(cachedTab);
    }

    activeTabHydratedRef.current = true;
    return undefined;
  }, [accessLoading, getScopedActiveTabStorageKey, session?.user?.id]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setSuperAdminViewSalonId('');
      return;
    }

    const hasSelectedSalon = availableSalons.some(
      (shop) => String(shop.id) === String(superAdminViewSalonId || ''),
    );

    if (!hasSelectedSalon && availableSalons.length) {
      setSuperAdminViewSalonId(String(availableSalons[0].id));
    }
  }, [isSuperAdmin, availableSalons, superAdminViewSalonId]);
  
  useEffect(() => {
    let ignore = false;

    const bootstrap = async () => {
      try {
        if (hasSupabaseConfig) {
          if (!session) {
            if (!ignore) {
              clearScopedOperationalState();
              setLoading(false);
            }
            return;
          }
          if (!ignore && !bootstrapCompletedRef.current) setLoading(true);
          const snapshot = await fetchSalonSnapshot(session.user.id, superAdminScopeOverride);
          if (ignore) return;

          setServices(snapshot.services);
          setClients(snapshot.clients);
          setStylists(snapshot.stylists.map((stylist, index) => ensureStylistTheme(stylist, index)));
          setAppointments(snapshot.appointments);
          setPosSales(snapshot.posSales || []);
          setCashSessions(snapshot.cashSessions || []);
          setCashMovements(snapshot.cashMovements || []);
          setPayrollPayments(snapshot.payrollPayments || []);
          setInventoryItems(snapshot.inventoryItems || []);
          const nextOperationalWarnings = [
            snapshot.posSalesLoadError,
            snapshot.cashLoadError,
            snapshot.payrollLoadError,
            snapshot.inventoryLoadError,
          ].filter(Boolean);
          setOperationalWarnings(nextOperationalWarnings);
          if (nextOperationalWarnings.length) {
            notify(`Advertencia operativa\n\n${nextOperationalWarnings.join('\n')}`, 'warning');
          }
        }
      } catch (error) {
        console.error('No se pudo cargar Supabase:', error);
        if (!ignore) {
          const friendlyErrorMessage = getFriendlySupabaseErrorMessage(error, 'dashboard');
          clearScopedOperationalState();
          setOperationalWarnings([
            friendlyErrorMessage,
          ]);
          notify(
            `${friendlyErrorMessage}\n\nMostr\u00e9 el estado vac\u00edo para evitar que se mezclen datos anteriores con informaci\u00f3n incompleta.`,
            'error',
          );
        }
      } finally {
        if (!ignore) {
          bootstrapCompletedRef.current = true;
          if (!hydratedFromCacheRef.current) {
            setLoading(false);
          }
        }
      }
    };

    bootstrap();

    return () => {
      ignore = true;
    };
  }, [session, effectiveOperationalSalonId, superAdminScopeOverride, notify]);

  useEffect(() => {
    if (!hasSupabaseConfig || !session?.user?.id || typeof window === 'undefined') return undefined;

    const runtimeCache = {
      userId: session.user.id,
      services,
      clients,
      stylists,
      appointments,
      posSales,
      cashSessions,
      cashMovements,
      payrollPayments,
      inventoryItems,
      operationalWarnings,
      clientDirectoryData,
      clientDirectoryLoaded,
      clientDirectoryWarnings,
      superAdminViewSalonId,
      savedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(AUTH_RUNTIME_CACHE_KEY, JSON.stringify(runtimeCache));
    } catch (error) {
      console.error('No se pudo guardar el cache local de SalonPro:', error);
    }

    return undefined;
  }, [
    session,
    services,
    clients,
    stylists,
    appointments,
    posSales,
    cashSessions,
    cashMovements,
    payrollPayments,
    inventoryItems,
    operationalWarnings,
    clientDirectoryData,
    clientDirectoryLoaded,
    clientDirectoryWarnings,
    superAdminViewSalonId,
  ]);

  useEffect(() => {
    if (!hasSupabaseConfig || !session?.user?.id) {
      setAccessControl({ roles: [], users: [], currentUserRoles: [], currentSalonId: null, currentBranchId: null, salons: [], branches: [] });
      return undefined;
    }

    let ignore = false;

    const loadAccessControl = async () => {
      setAccessLoading(true);
      try {
        const snapshot = await fetchAccessControlSnapshot(session.user.id);
        if (!ignore) {
          setAccessControl(snapshot);
          if (hydratedFromCacheRef.current) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('No se pudo cargar control de acceso:', error);
        if (!ignore) {
          const friendlyErrorMessage = getFriendlySupabaseErrorMessage(error, 'dashboard');
          setAccessControl({ roles: [], users: [], currentUserRoles: [], currentSalonId: null, currentBranchId: null, salons: [], branches: [] });
          notify(`No pude cargar usuarios/sucursales desde Supabase.\n\n${friendlyErrorMessage}`, 'error');
          if (hydratedFromCacheRef.current) {
            setLoading(false);
          }
        }
      } finally {
        if (!ignore) {
          setAccessLoading(false);
        }
      }
    };

    loadAccessControl();

    return () => {
      ignore = true;
    };
  }, [session, notify]);

  useEffect(() => {
    setClientDirectoryLoaded(false);
    setClientDirectoryData({ clients: [], appointments: [], stylists: [] });
    setClientDirectoryWarnings([]);
  }, [session?.user?.id, effectiveOperationalSalonId, superAdminScopeOverride]);

  useEffect(() => {
    if (!hasSupabaseConfig || !session?.user?.id || activeTab !== 'clientes' || clientDirectoryLoaded) return undefined;

    let ignore = false;

    const loadClientDirectoryData = async () => {
      try {
        const snapshot = await fetchClientDirectorySnapshot(session.user.id, superAdminScopeOverride);
        if (!ignore) {
          setClientDirectoryData({
            clients: snapshot.clients.map(client => ({ ...client, phone: formatPhoneNumber(client.phone || '') })),
            appointments: snapshot.appointments,
            stylists: snapshot.stylists.map((stylist, index) => ensureStylistTheme(stylist, index)),
          });
          setClientDirectoryWarnings(snapshot.warnings || []);
          if (snapshot.warnings?.length) {
            notify(`Clientes cargados con advertencias\n\n${snapshot.warnings.join('\n\n')}`, 'warning');
          }
          setClientDirectoryLoaded(true);
        }
      } catch (error) {
        console.error('No se pudo cargar el directorio de clientes:', error);
        if (!ignore) {
          setClientDirectoryData({ clients: [], appointments: [], stylists: [] });
          setClientDirectoryWarnings([
            error?.message || 'No se pudo cargar el directorio de clientes.',
          ]);
          setClientDirectoryLoaded(true);
          notify(
            'No pude cargar el directorio de clientes. Dejé la vista vacía para evitar métricas parciales o datos engañosos.',
            'error',
          );
        }
      }
    };

    loadClientDirectoryData();

    return () => {
      ignore = true;
    };
  }, [session, activeTab, clientDirectoryLoaded, effectiveOperationalSalonId, superAdminScopeOverride, notify]);

  const handleSignIn = async (email, password) => {
    if (!supabase) return;

    setAuthBusy(true);
    setAuthError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setAuthError(getFriendlySupabaseErrorMessage(error, 'login'));
      }
    } catch (error) {
      setAuthError(getFriendlySupabaseErrorMessage(error, 'login'));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabase) return;

    setAuthBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message || 'No pude cerrar sesión.');
    } else {
      bootstrapCompletedRef.current = false;
    }
    setAuthBusy(false);
  };

  const handleChangeOwnPassword = async ({ nextPassword }) => {
    if (!supabase) return false;
    setPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: nextPassword,
        data: {
          ...(session?.user?.user_metadata || {}),
          must_change_password: false,
        },
      });
      if (error) throw error;
      const { data: refreshedSession } = await supabase.auth.getSession();
      setSession(refreshedSession.session ?? session);
      notify('Tu contraseña se actualizó correctamente.', 'success');
      setShowSelfPasswordModal(false);
      return true;
    } catch (error) {
      handleSyncError(error, 'No pude actualizar tu contraseña.');
      return false;
    } finally {
      setPasswordBusy(false);
    }
  };

  useEffect(() => {
    if (session?.user?.user_metadata?.must_change_password) {
      setShowSelfPasswordModal(true);
    }
  }, [session]);

  const handleUpdateUserProfile = async (user, payload) => {
    if (!isAdmin || !user) {
      notify('Solo un administrador puede editar usuarios.', 'warning');
      return false;
    }

    const currentRole = getPrimaryRole(user);
    const nextRole = payload.roleName || currentRole || 'cashier';

    if (!isSuperAdmin) {
      if (currentRole !== 'cashier' || String(user.salonId || '') !== String(currentSalonId || '')) {
        notify('Solo puedes editar usuarios Caja de tu propio salón.', 'warning');
        return false;
      }
    }

    if (!isSuperAdmin && nextRole !== 'cashier') {
      notify('Un administrador de salón solo puede asignar el rol Caja.', 'warning');
      return false;
    }

    const targetSalonId = isSuperAdmin
      ? (payload.salonId || user.salonId || null)
      : (currentSalonId || user.salonId || null);
    const targetBranchId = payload.branchId || null;

    setSavingUserId(user.id);
    try {
      await updateManagedUserProfile(user.id, {
        fullName: payload.fullName,
        salonId: targetSalonId,
        branchId: targetBranchId,
      });

      if (nextRole !== currentRole) {
        await replaceUserRoles(user.id, [nextRole]);
      }

      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      setAccessControl(snapshot);
      return true;
    } catch (error) {
      throw new Error(error?.message || 'No pude actualizar el usuario.');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateSystemUser = async (payload) => {
    if (!isAdmin) {
      notify('Solo un administrador puede crear nuevas cuentas.', 'warning');
      return null;
    }

    if (!isSuperAdmin && payload.roleName !== 'cashier') {
      notify('Un administrador de salón solo puede crear usuarios de caja.', 'warning');
      return null;
    }

    if (!isSuperAdmin && !currentSalonId) {
      notify('Tu usuario administrador no tiene un salón asignado.', 'error');
      return null;
    }

    const normalizedPayload = !isSuperAdmin
      ? {
          ...payload,
          roleName: 'cashier',
          salonId: currentSalonId,
          branchId: payload.branchId || accessControl.currentBranchId || null,
        }
      : payload;

    setCreatingUser(true);
    try {
      const createdUser = await createManagedUser(normalizedPayload, session?.user?.id);
      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      const createdSalon =
        accessControl.salons.find((shop) => String(shop.id) === String(createdUser.salonId || normalizedPayload.salonId || ''))
        || currentSalon
        || availableSalons[0]
        || null;
      const createdBranch =
        accessControl.branches.find((branch) => String(branch.id) === String(createdUser.branchId || normalizedPayload.branchId || ''))
        || currentBranch
        || null;
      const optimisticUser = {
        id: createdUser.id,
        email: createdUser.email,
        fullName: createdUser.fullName || createdUser.email,
        createdAt: new Date().toISOString(),
        roles: [createdUser.roleName || normalizedPayload.roleName],
        salonId: createdUser.salonId || normalizedPayload.salonId || null,
        salonName: createdSalon?.name || '',
        branchId: createdUser.branchId || normalizedPayload.branchId || null,
        branchName: createdBranch?.name || '',
      };
      const nextSnapshot = snapshot?.users?.some((user) => String(user.id) === String(createdUser.id))
        ? snapshot
        : {
            ...snapshot,
            users: [...(snapshot?.users || []), optimisticUser],
          };
      setAccessControl(nextSnapshot);
      notify(`Usuario ${createdUser.fullName || createdUser.email} creado correctamente.`, 'success');
      return createdUser;
    } catch (error) {
      handleSyncError(error, 'No pude crear el usuario del sistema.');
      return null;
    } finally {
      setCreatingUser(false);
    }
  };

  const handleResetUserPassword = async (user, password) => {
    if (!isAdmin) {
      notify('Solo un administrador puede restablecer contraseñas.', 'warning');
      return false;
    }

    if (!isSuperAdmin && getPrimaryRole(user) !== 'cashier') {
      notify('Un administrador de salón solo puede restablecer contraseñas de usuarios Caja.', 'warning');
      return false;
    }

    setResettingPasswordUserId(user.id);
    try {
      await resetManagedUserPassword({ userId: user.id, password });
      return true;
    } catch (error) {
      throw new Error(error?.message || 'No pude restablecer la contraseña de este usuario.');
    } finally {
      setResettingPasswordUserId(null);
    }
  };

  const handleCreateBranch = async (payload) => {
    if (!isAdmin) {
      notify('Solo un administrador puede crear sucursales.', 'warning');
      return null;
    }

    setOnboardingBusy(true);
    try {
      const resolvedSalonId = isSuperAdmin
        ? payload.salonId
        : (currentSalonId || currentSalon?.id || '');

      if (!resolvedSalonId) {
        notify('Selecciona un salón para crear la sucursal.', 'warning');
        return null;
      }

      const createdBranch = await upsertBranch({
        id: payload.id || makeId(),
        name: payload.name,
        code: payload.code,
        city: payload.city,
        address: payload.address,
        salonId: resolvedSalonId,
        isActive: payload.isActive ?? true,
      });

      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      setAccessControl(snapshot);
      notify(`Sucursal ${payload.id ? 'actualizada' : 'creada'} correctamente.`, 'success');
      return createdBranch;
    } catch (error) {
      handleSyncError(error, 'No pude crear la sucursal.');
      return null;
    } finally {
      setOnboardingBusy(false);
    }
  };

  const handleCreateSalon = async (payload) => {
    if (!isSuperAdmin) {
      notify('Solo el super usuario puede administrar negocios.', 'warning');
      return null;
    }

    setOnboardingBusy(true);
    try {
      const isUpdate = Boolean(payload.id);
      const createdSalon = await upsertSalon({
        id: payload.id || makeId(),
        name: payload.name,
        ownerEmail: payload.ownerEmail,
        phone: payload.phone,
        city: payload.city,
        plan: payload.plan,
        openTime: payload.openTime || DEFAULT_SALON_OPEN_TIME,
        closeTime: payload.closeTime || DEFAULT_SALON_CLOSE_TIME,
        isActive: true,
      });

      if (!isUpdate && payload.adminUserId) {
        await assignProfileSalon(payload.adminUserId, createdSalon.id);
        const targetUser = (accessControl.users || []).find((user) => String(user.id) === String(payload.adminUserId));
        const preservedRoles = new Set((targetUser?.roles || []).filter((role) => role === 'super_admin'));
        preservedRoles.add('admin');
        await replaceUserRoles(payload.adminUserId, [...preservedRoles]);
      }

      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      setAccessControl(snapshot);
      notify(`Negocio ${createdSalon.name} ${isUpdate ? 'actualizado' : 'creado'} correctamente.`, 'success');
      return createdSalon;
    } catch (error) {
      handleSyncError(error, 'No pude completar el onboarding del negocio.');
      return null;
    } finally {
      setOnboardingBusy(false);
    }
  };
  const defaultStylistId = stylists[0]?.id || '';
  const currentSalonId = resolvedOperationalSalonId;
  const currentBranchId = resolvedOperationalBranchId;
  const currentSalon = availableSalons.find((shop) => String(shop.id) === String(currentSalonId || ''))
    || availableSalons[0]
    || null;
  const currentSalonOpenTime = currentSalon?.openTime || DEFAULT_SALON_OPEN_TIME;
  const currentSalonCloseTime = currentSalon?.closeTime || DEFAULT_SALON_CLOSE_TIME;
  const currentSalonHours = useMemo(
    () => generateBusinessHours(currentSalonOpenTime, currentSalonCloseTime),
    [currentSalonOpenTime, currentSalonCloseTime],
  );
  const currentBranch = availableBranches.find((branch) => String(branch.id) === String(currentBranchId || '')) || null;
  const activeCashSession = useMemo(() => (
    (cashSessions || []).find((cashSession) => (
      cashSession.status !== 'closed'
      && !cashSession.closedAt
      && String(cashSession.salonId || '') === String(currentSalonId || '')
      && String(cashSession.branchId || '') === String(currentBranchId || '')
    )) || null
  ), [cashSessions, currentSalonId, currentBranchId]);
  const activeCashMovements = useMemo(() => (
    activeCashSession
      ? (cashMovements || []).filter((movement) => String(movement.cashSessionId || '') === String(activeCashSession.id || ''))
      : []
  ), [cashMovements, activeCashSession]);
  const activeCashPosSales = useMemo(() => (
    activeCashSession
      ? (posSales || []).filter((sale) => (
        String(sale.cashSessionId || '') === String(activeCashSession.id || '')
        && !sale.canceledAt
      ))
      : []
  ), [posSales, activeCashSession]);
  const activePosSales = useMemo(
    () => (posSales || []).filter((sale) => !sale.canceledAt),
    [posSales],
  );
  const isAdmin = isSuperAdmin || currentUserRoles.includes('admin');
  const isCashier = currentUserRoles.includes('cashier');
  const effectiveClientDirectory = useMemo(() => ({
    clients: clientDirectoryLoaded
      ? mergeEntitiesById(clients, clientDirectoryData.clients)
      : clients,
    appointments: clientDirectoryLoaded
      ? mergeEntitiesById(clientDirectoryData.appointments, appointments)
      : appointments,
    stylists: clientDirectoryLoaded
      ? mergeEntitiesById(clientDirectoryData.stylists, stylists)
      : stylists,
  }), [clientDirectoryLoaded, clientDirectoryData, clients, appointments, stylists]);
  const roleFilterEnabled = hasSupabaseConfig && !accessLoading && currentUserRoles.length > 0;
  const navItems = [
    { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard, allow: true },
    { id: 'agenda', label: 'Calendario', icon: CalendarIcon, allow: isAdmin || isCashier },
    { id: 'clientes', label: 'Clientes', icon: Users, allow: isAdmin || isCashier },
    { id: 'estilistas', label: 'Estilista', icon: UserCheck, allow: isAdmin },
    { id: 'services', label: 'Servicios', icon: Scissors, allow: isAdmin },
    { id: 'inventario', label: 'Inventario', icon: Package, allow: isAdmin },
    { id: 'caja', label: 'Caja', icon: ShoppingBag, allow: isAdmin || isCashier },
    { id: 'reportes', label: 'Reportes', icon: BarChart3, allow: isAdmin },
    { id: 'sistema', label: 'Sistema', icon: Layers, allow: isAdmin },
  ].filter((item) => {
    return !roleFilterEnabled || item.allow;
  });
  const accessibleTabIds = useMemo(() => {
    const nextIds = new Set(navItems.map((item) => item.id));
    if (isAdmin) {
      nextIds.add('nomina');
    }
    return nextIds;
  }, [navItems, isAdmin]);
  const handleSyncError = useCallback((error, fallbackMessage) => {
    console.error(error);
    const details = error?.message ? `\n\n${error.message}` : '';
    notify(`${fallbackMessage}${details}`, 'error');
  }, [notify]);
  const refreshClientsAfterAppointmentSync = useCallback(async () => {
    if (!hasSupabaseConfig || !session?.user?.id) return;

    const nextClients = await fetchScopedClients(session.user.id, superAdminScopeOverride);
    setClients(nextClients);

    if (clientDirectoryLoaded) {
      setClientDirectoryData((prev) => ({
        ...prev,
        clients: mergeEntitiesById(nextClients, prev.clients),
      }));
    }
  }, [clientDirectoryLoaded, session, superAdminScopeOverride]);

  const getReservationAlertKey = (appointment) => (
    `${String(appointment?.id || '')}:${standardizeDate(appointment?.date || '')}:${String(appointment?.time || '')}`
  );

  const getAppointmentScheduledAt = (appointment) => {
    const localDate = parseLocalDate(appointment?.date);
    if (!localDate) return null;

    const [hours, minutes] = String(appointment?.time || '00:00')
      .split(':')
      .map((value) => Number(value));

    localDate.setHours(
      Number.isFinite(hours) ? hours : 0,
      Number.isFinite(minutes) ? minutes : 0,
      0,
      0,
    );

    return localDate;
  };

  const markReservationAsLost = useCallback(async (appointment) => {
    if (!appointment || appointment.status === 'Cita Perdida') return;

    const updatedAppointment = {
      ...appointment,
      status: 'Cita Perdida',
      cancelledAt: appointment.cancelledAt || new Date().toISOString(),
    };

    setAppointments((prev) => prev.map((item) => (
      item.id === appointment.id ? updatedAppointment : item
    )));

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertAppointments(
          [updatedAppointment],
          services,
          currentSalonId,
          currentBranchId,
          stylists,
          clients,
        );
        await refreshClientsAfterAppointmentSync();
      } catch (error) {
        handleSyncError(error, 'No pude guardar la cita vencida en Supabase.');
      }
    }
  }, [
    stylists,
    clients,
    currentSalonId,
    currentBranchId,
    handleSyncError,
    refreshClientsAfterAppointmentSync,
    services,
  ]);

  useEffect(() => {
    const activeReservationKeys = new Set(
      (appointments || [])
        .filter((appointment) => appointment?.type === 'reserva' && appointment?.status === 'Confirmada')
        .map(getReservationAlertKey),
    );

    reservationNearExpiryAlertsRef.current.forEach((key) => {
      if (!activeReservationKeys.has(key)) {
        reservationNearExpiryAlertsRef.current.delete(key);
      }
    });

    reservationExpiredAlertsRef.current.forEach((key) => {
      if (!activeReservationKeys.has(key)) {
        reservationExpiredAlertsRef.current.delete(key);
      }
    });

    reservationProcessingAlertsRef.current.forEach((key) => {
      if (!activeReservationKeys.has(key)) {
        reservationProcessingAlertsRef.current.delete(key);
      }
    });
  }, [appointments]);

  useEffect(() => {
    let cancelled = false;

    const checkReservationAlerts = async () => {
      const now = new Date();
      const pendingReservations = (appointments || []).filter(
        (appointment) => appointment?.type === 'reserva' && appointment?.status === 'Confirmada',
      );

      for (const appointment of pendingReservations) {
        if (cancelled) return;

        const scheduledAt = getAppointmentScheduledAt(appointment);
        if (!scheduledAt) continue;

        const delayMs = now.getTime() - scheduledAt.getTime();
        if (delayMs < 0) continue;

        const alertKey = getReservationAlertKey(appointment);
        const clientName = clients.find((client) => String(client.id) === String(appointment.clientId))?.name || appointment.clientName || 'Cliente genérico';
        const stylistName = stylists.find((stylist) => String(stylist.id) === String(appointment.stylistId))?.name || 'estilista asignado';

        if (
          delayMs >= 10 * 60 * 1000
          && delayMs < 15 * 60 * 1000
          && !reservationNearExpiryAlertsRef.current.has(alertKey)
        ) {
          const remainingMinutes = Math.max(1, Math.ceil((15 * 60 * 1000 - delayMs) / 60000));
          reservationNearExpiryAlertsRef.current.add(alertKey);
          notify(
            `La cita de "${clientName}" está por vencerse\n\nSucursal / estilista: ${stylistName}\nHora reservada: ${formatTime12h(appointment.time)}\nTiempo restante: ${remainingMinutes} minuto${remainingMinutes === 1 ? '' : 's'}\n\nMarca la llegada del cliente antes de que se venza la reserva.`,
            'reservation-warning',
          );
        }

        if (
          delayMs >= 15 * 60 * 1000
          && !reservationExpiredAlertsRef.current.has(alertKey)
          && !reservationProcessingAlertsRef.current.has(alertKey)
        ) {
          reservationProcessingAlertsRef.current.add(alertKey);
          reservationExpiredAlertsRef.current.add(alertKey);

          notify(
            `La cita de "${clientName}" ya se venció\n\nSucursal / estilista: ${stylistName}\nHora reservada: ${formatTime12h(appointment.time)}\n\nLa reserva se marcó como cita perdida.`,
            'reservation-expired',
          );

          try {
            await markReservationAsLost(appointment);
          } finally {
            reservationProcessingAlertsRef.current.delete(alertKey);
          }
        }
      }
    };

    void checkReservationAlerts();
    const interval = setInterval(() => {
      void checkReservationAlerts();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [appointments, stylists, clients, markReservationAsLost, notify]);

  useEffect(() => {
    if (!accessibleTabIds.has(activeTab)) {
      setActiveTab(navItems[0]?.id || 'dashboard');
    }
  }, [activeTab, accessibleTabIds, navItems]);

  if (authLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black gap-4 text-white">
        <style>{styleTag}</style>
        <Loader2 className="animate-spin text-indigo-500" size={48} />
        <span className="text-[10px] font-black uppercase tracking-widest italic">Verificando sesión...</span>
      </div>
    );
  }

  if (shouldBlockWithoutSupabase) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <style>{styleTag}</style>
        <div className="w-full max-w-2xl rounded-[2rem] border border-rose-500/20 bg-slate-950 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <ShieldCheck size={26} className="text-rose-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter">Configuración requerida</h1>
              <p className="mt-2 text-sm text-slate-300">
                Esta instalación está en modo producción y requiere una conexión válida a Supabase.
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-black/40 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Variables faltantes</p>
            <div className="mt-4 space-y-2 text-sm font-mono text-rose-200">
              {!import.meta.env.VITE_SUPABASE_URL && <p>VITE_SUPABASE_URL</p>}
              {!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && <p>VITE_SUPABASE_PUBLISHABLE_KEY</p>}
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-400 leading-relaxed">
            La aplicación fue bloqueada para evitar que opere con datos locales aislados en cada navegador. Configura las variables de entorno del servidor y vuelve a desplegar.
          </p>
        </div>
      </div>
    );
  }

  if (!hasSupabaseConfig && !useBrowserCache) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <style>{styleTag}</style>
        <div className="w-full max-w-2xl rounded-[2rem] border border-amber-500/20 bg-slate-950 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Info size={26} className="text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter">Configuración pendiente</h1>
              <p className="mt-2 text-sm text-slate-300">
                No hay una conexión válida a Supabase y el modo local está desactivado para evitar datos de prueba confusos.
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-black/40 p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cómo continuar</p>
            <p className="text-sm text-slate-300">Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` para trabajar con datos reales.</p>
            <p className="text-sm text-slate-300">Si necesitas una prueba local intencional, activa `VITE_ENABLE_LOCAL_MODE=true`.</p>
            <p className="text-sm text-slate-500">Para sembrar datos demo en ese modo, agrega también `VITE_SEED_LOCAL_MODE=true`.</p>
          </div>
        </div>
      </div>
    );
  }

  if (hasSupabaseConfig && !session) {
    return (
      <Suspense fallback={accessUiFallback}>
        <LoginScreen onSignIn={handleSignIn} authBusy={authBusy} authError={authError} />
      </Suspense>
    );
  }

  const handleUpdateStatus = async (id, status, extra = null) => {
    const apt = appointments.find(a => a.id === id);
    if (!apt) return;

    if (status === 'Finalizada' && !extra) {
      setSelectedData({ ...selectedData, finalize: apt });
      setModals({ ...modals, finalize: true });
      return;
    }
    if (status === 'Finalizada' && apt.status !== 'Finalizada' && extra && !activeCashSession) {
      notify('Debes abrir caja antes de cobrar y finalizar servicios.', 'warning');
      return;
    }

    const updatedAppointment = {
      ...apt,
      status,
      service: extra ? extra.serviceName : apt.service,
      price: extra ? extra.price : apt.price,
      rating: extra ? extra.rating : apt.rating,
      grossAmount: extra
        ? Number(extra.grossAmount ?? extra.price ?? 0)
        : Number(apt.grossAmount ?? apt.price ?? 0),
      discountAmount: extra
        ? Number(extra.discountAmount || 0)
        : Number(apt.discountAmount || 0),
      promotionName: extra ? (extra.promotionName || '') : (apt.promotionName || ''),
    };

    if (status === 'En Espera' && !apt.checkInAt) {
      updatedAppointment.checkInAt = new Date().toISOString();
    }

    if (status === 'En Servicio' && !apt.startedAt) {
      updatedAppointment.startedAt = new Date().toISOString();
      if (!updatedAppointment.checkInAt) updatedAppointment.checkInAt = apt.createdAt;
    }

    if (status === 'Finalizada' && !updatedAppointment.finishedAt) {
      updatedAppointment.finishedAt = new Date().toISOString();
    }

    if ((status === 'Cita Perdida' || status === 'Cancelada') && !updatedAppointment.cancelledAt) {
      updatedAppointment.cancelledAt = new Date().toISOString();
    }

    setAppointments(prev => prev.map(a => (a.id === id ? updatedAppointment : a)));

    if (status === 'Finalizada') {
      setModals((prev) => ({ ...prev, finalize: false }));
    }

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertAppointments([updatedAppointment], services, currentSalonId, currentBranchId, stylists, clients);
        await refreshClientsAfterAppointmentSync();
      } catch (error) {
        handleSyncError(error, 'No pude guardar el cambio de estado en Supabase.');
        setAppointments(prev => prev.map(a => (a.id === id ? apt : a)));
        return;
      }
    }

    let serviceSaleRecord = null;
    if (status === 'Finalizada' && apt.status !== 'Finalizada' && extra) {
      const appointmentClient = clients.find((client) => String(client.id) === String(updatedAppointment.clientId || ''));
      const appointmentStylist = stylists.find((stylist) => String(stylist.id) === String(updatedAppointment.stylistId || ''));
      const normalizeChargedItem = (item) => {
        const matchedService = (services || []).find((service) => (
          String(service.id || '') === String(item.id || '')
          || String(service.name || '').toLowerCase() === String(item.name || '').toLowerCase()
        ));
        return {
          id: item.id,
          name: item.name,
          category: item.category || matchedService?.category || 'Servicio',
          price: Number(item.price) || 0,
          qty: Number(item.qty) || 1,
          source: 'appointment',
          appointmentId: updatedAppointment.id,
          stylistId: updatedAppointment.stylistId || null,
          stylistName: appointmentStylist?.name || updatedAppointment.stylistName || '',
          clientName: appointmentClient?.name || updatedAppointment.clientName || 'Cliente genérico',
        };
      };
      serviceSaleRecord = await handleRegisterPosSale({
        clientId: updatedAppointment.clientId || null,
        clientName: appointmentClient?.name || updatedAppointment.clientName || 'Cliente genérico',
        items: Array.isArray(extra.items) && extra.items.length
          ? extra.items.map(normalizeChargedItem)
          : [normalizeChargedItem({
            id: updatedAppointment.serviceId || updatedAppointment.id,
            name: updatedAppointment.service || 'Servicio',
            category: 'Servicio',
            price: Number(updatedAppointment.grossAmount || updatedAppointment.price || 0),
            qty: 1,
          })],
        rawSubtotal: Number(extra.grossAmount ?? extra.price ?? 0),
        discountTotal: Number(extra.discountAmount || 0),
        subtotal: Number(extra.price || 0),
        paymentMethod: extra.paymentMethod || 'cash',
        promotion: extra.promotionName ? { id: null, name: extra.promotionName } : null,
        notes: extra.notes || null,
      });
      if (!serviceSaleRecord) {
        setAppointments(prev => prev.map(a => (a.id === id ? apt : a)));
      }
    }
  };

  const handleAgendaAppointmentClick = async (appointment) => {
    if (!appointment) return;

    const normalizedDate = standardizeDate(appointment.date);
    const today = getTodayString();

    if (appointment.status === 'Cita Perdida') {
      notify('Esta cita ya está marcada como perdida.', 'info');
      return;
    }

    if (appointment.status === 'Finalizada') {
      notify('Esta cita ya fue finalizada.', 'info');
      return;
    }

    if (appointment.status === 'Confirmada') {
      if (normalizedDate && normalizedDate < today) {
        const shouldMarkLost = await confirmAction({
          title: 'Cita vencida',
          message: 'Esta cita quedó en un día anterior y nunca se inició. ¿Deseas marcarla como cita perdida?',
          confirmLabel: 'Marcar perdida',
          cancelLabel: 'Cerrar',
          tone: 'danger',
        });

        if (shouldMarkLost) {
          await handleUpdateStatus(appointment.id, 'Cita Perdida');
        }
        return;
      }

      const shouldCheckIn = await confirmAction({
        title: 'Cita pendiente',
        message: 'Esta cita todavía no ha iniciado. ¿Deseas marcar la llegada del cliente para pasarla a espera?',
        confirmLabel: 'Marcar llegada',
        cancelLabel: 'Cerrar',
        tone: 'info',
      });

      if (shouldCheckIn) {
        await handleUpdateStatus(appointment.id, 'En Espera');
      }
      return;
    }

    setSelectedData((prev) => ({ ...prev, finalize: appointment }));
    setModals((prev) => ({ ...prev, finalize: true }));
  };

  const openTransferAppointment = (appointment) => {
    if (!appointment) return;

    if (appointment.status === 'Finalizada' || appointment.status === 'Cita Perdida') {
      notify('Esta cita ya está cerrada y no se puede trasladar.', 'info');
      return;
    }

    setSelectedData((prev) => ({ ...prev, transferAppointment: appointment }));
    setModals((prev) => ({ ...prev, transferAppointment: true }));
  };

  const openAppointmentActions = (appointment) => {
    if (!appointment) return;
    setSelectedData((prev) => ({ ...prev, appointmentActions: appointment }));
    setModals((prev) => ({ ...prev, appointmentActions: true }));
  };

  const openRescheduleAppointment = (appointment) => {
    if (!appointment) return;

    if (appointment.status === 'Finalizada' || appointment.status === 'Cita Perdida' || appointment.status === 'Cancelada') {
      notify('Esta cita ya está cerrada y no se puede mover.', 'info');
      return;
    }

    setSelectedData((prev) => ({ ...prev, rescheduleAppointment: appointment }));
    setModals((prev) => ({ ...prev, rescheduleAppointment: true }));
  };

  const handleRescheduleAppointment = async (appointmentId, targetDate, targetTime) => {
    const appointment = appointments.find((item) => String(item.id) === String(appointmentId));
    if (!appointment || !targetDate || !targetTime) return;

    if (hasAppointmentStylistConflict({
      appointments,
      appointment,
      targetStylistId: appointment.stylistId,
      targetDate,
      targetTime,
    })) {
      notify('Ese horario ya está ocupado para este estilista.', 'warning');
      return;
    }

    const updatedAppointment = {
      ...appointment,
      date: targetDate,
      time: targetTime,
      updatedAt: new Date().toISOString(),
    };

    setAppointments((prev) => prev.map((item) => (
      String(item.id) === String(appointmentId) ? updatedAppointment : item
    )));
    setSelectedData((prev) => ({ ...prev, rescheduleAppointment: null }));
    setModals((prev) => ({ ...prev, rescheduleAppointment: false }));
    notify(`Turno movido a las ${formatTime12h(targetTime)}.`, 'success');

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertAppointments([updatedAppointment], services, currentSalonId, currentBranchId, stylists, clients);
        await refreshClientsAfterAppointmentSync();
      } catch (error) {
        handleSyncError(error, 'No pude guardar el cambio de horario en Supabase.');
      }
    }
  };

  const handleCancelAppointment = async (appointment) => {
    if (!appointment) return;
    const confirmed = await confirmAction({
      title: appointment.type === 'walkin' ? 'Cancelar servicio' : 'Cancelar cita',
      message: 'Esta acción retirará el turno de la operación activa. ¿Deseas continuar?',
      confirmLabel: 'Cancelar turno',
      cancelLabel: 'Volver',
      tone: 'danger',
    });

    if (confirmed) {
      setModals((prev) => ({ ...prev, appointmentActions: false }));
      await handleUpdateStatus(appointment.id, 'Cancelada');
    }
  };

  const handleMarkAppointmentLost = async (appointment) => {
    if (!appointment) return;
    const confirmed = await confirmAction({
      title: 'Marcar cita perdida',
      message: 'Se usará el mismo estado que aplica el sistema cuando una reservación excede el tiempo de espera desde su hora agendada.',
      confirmLabel: 'Marcar perdida',
      cancelLabel: 'Volver',
      tone: 'danger',
    });

    if (confirmed) {
      setModals((prev) => ({ ...prev, appointmentActions: false }));
      await handleUpdateStatus(appointment.id, 'Cita Perdida');
    }
  };

  const handleTransferAppointment = async (appointmentId, targetStylistId) => {
    const appointment = appointments.find((item) => String(item.id) === String(appointmentId));
    const targetStylist = stylists.find((item) => String(item.id) === String(targetStylistId));
    if (!appointment || !targetStylist) return;

    if (String(appointment.stylistId) === String(targetStylistId)) {
      notify('La cita ya está asignada a ese estilista.', 'info');
      return;
    }

    if (hasAppointmentStylistConflict({ appointments, appointment, targetStylistId })) {
      notify('Ese estilista ya tiene una cita en ese horario.', 'warning');
      return;
    }

    const updatedAppointment = {
      ...appointment,
      stylistId: targetStylist.id,
      stylistName: targetStylist.name,
      updatedAt: new Date().toISOString(),
    };

    setAppointments((prev) => prev.map((item) => (
      String(item.id) === String(appointmentId) ? updatedAppointment : item
    )));
    setSelectedData((prev) => ({ ...prev, transferAppointment: null }));
    setModals((prev) => ({ ...prev, transferAppointment: false }));
    notify(`Cita trasladada a ${targetStylist.name}.`, 'success');

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertAppointments([updatedAppointment], services, currentSalonId, currentBranchId, stylists, clients);
        await refreshClientsAfterAppointmentSync();
      } catch (error) {
        handleSyncError(error, 'No pude guardar el traslado de estilista en Supabase.');
      }
    }
  };

  const buildPayrollPaymentDraft = (stylist, pendingAppointments, paidAt, paymentScope = 'individual') => {
    const sortedDates = pendingAppointments
      .map((appointment) => appointment.date)
      .filter(Boolean)
      .sort();
    const salesTotal = pendingAppointments.reduce((sum, appointment) => sum + Number(appointment.price || 0), 0);
    const commissionRate = Number(stylist.commission || 0);
    const baseAmount = stylistHasBasePay(stylist.paymentMode) ? Number(stylist.salary || 0) : 0;
    const commissionAmount = stylistHasCommissionPay(stylist.paymentMode) ? salesTotal * (commissionRate / 100) : 0;
    const items = pendingAppointments.map((appointment) => ({
      appointmentId: appointment.id,
      stylistId: stylist.id,
      serviceName: appointment.service || 'Servicio',
      serviceAmount: Number(appointment.price || 0),
      commissionRate,
      commissionAmount: stylistHasCommissionPay(stylist.paymentMode)
        ? Number(appointment.price || 0) * (commissionRate / 100)
        : 0,
    }));

    return {
      id: globalThis.crypto?.randomUUID?.() || `payroll-${Date.now()}-${stylist.id}`,
      salonId: currentSalonId,
      branchId: currentBranchId,
      stylistId: stylist.id,
      paymentScope,
      periodStart: sortedDates[0] || null,
      periodEnd: sortedDates[sortedDates.length - 1] || null,
      paymentDate: paidAt,
      paymentMethod: 'cash',
      baseAmount,
      commissionAmount,
      totalAmount: baseAmount + commissionAmount,
      servicesCount: pendingAppointments.length,
      salesTotal,
      commissionRate,
      notes: paymentScope === 'batch' ? 'Liquidación general de equipo' : 'Liquidación individual de nómina',
      status: 'paid',
      createdBy: session?.user?.id || null,
      createdAt: paidAt,
      updatedAt: paidAt,
      appointmentIds: pendingAppointments.map((appointment) => appointment.id),
      items,
    };
  };

  const normalizePayrollPaymentMethod = (method) => (
    ['cash_box', 'transfer', 'external'].includes(method) ? method : 'cash_box'
  );

  const getPayrollPaymentMethodLabel = (method) => ({
    cash_box: 'Efectivo caja',
    transfer: 'Transferencia',
    external: 'Externo',
  }[normalizePayrollPaymentMethod(method)]);

  const toPayrollDbPaymentMethod = (method) => ({
    cash_box: 'cash',
    transfer: 'transfer',
    external: 'other',
  }[normalizePayrollPaymentMethod(method)]);

  const buildPayrollCashMovement = (payment, stylist, paidAt, referenceId = null) => ({
    id: globalThis.crypto?.randomUUID?.() || `cash-payroll-${Date.now()}-${stylist?.id || payment.id}`,
    cashSessionId: activeCashSession?.id || null,
    salonId: currentSalonId,
    branchId: currentBranchId,
    type: 'out',
    movementKind: 'payroll_payment',
    paymentMethod: 'cash',
    amount: Number(payment.totalAmount || 0),
    notes: `Pago de nómina - ${stylist?.fullName || stylist?.name || 'Personal'}`,
    referenceType: 'payroll_payment',
    referenceId: referenceId || payment.id,
    createdBy: session?.user?.id || null,
    createdAt: paidAt,
  });

  const handleConfirmPayment = async (stylistId, method = 'cash_box') => {
    const paymentMethod = normalizePayrollPaymentMethod(method);
    if (paymentMethod === 'cash_box' && !activeCashSession) {
      notify('Debes abrir caja antes de pagar nómina con efectivo de caja.', 'warning');
      return;
    }
    const paidAt = new Date().toISOString();
    const stylist = stylists.find((item) => String(item.id) === String(stylistId));
    const pendingAppointments = appointments.filter(a => String(a.stylistId) === String(stylistId) && a.status === 'Finalizada' && !a.isPaid);
    const updatedAppointments = pendingAppointments.map(a => ({ ...a, isPaid: true, paidAt, updatedAt: paidAt }));
    const paymentDraft = stylist && pendingAppointments.length
      ? {
          ...buildPayrollPaymentDraft(stylist, pendingAppointments, paidAt, 'individual'),
          paymentMethod: toPayrollDbPaymentMethod(paymentMethod),
          notes: `Liquidación individual de nómina - ${getPayrollPaymentMethodLabel(paymentMethod)}`,
        }
      : null;
    const cashMovementDraft = paymentDraft && paymentMethod === 'cash_box'
      ? buildPayrollCashMovement(paymentDraft, stylist, paidAt)
      : null;

    setAppointments(prev => prev.map(a =>
      String(a.stylistId) === String(stylistId) && a.status === 'Finalizada' && !a.isPaid ? { ...a, isPaid: true, paidAt, updatedAt: paidAt } : a
    ));
    if (paymentDraft) setPayrollPayments((prev) => [paymentDraft, ...prev]);
    if (cashMovementDraft) setCashMovements((prev) => [...prev, cashMovementDraft]);
    setModals({ ...modals, paymentReceipt: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current && paymentDraft) {
      try {
        const savedPayment = await createPayrollPayment(paymentDraft, session?.user?.id, superAdminScopeOverride);
        let savedMovement = null;
        if (paymentMethod === 'cash_box') {
          savedMovement = await createCashAuditMovement(
            {
              cashSessionId: activeCashSession.id,
              type: 'out',
              amount: paymentDraft.totalAmount,
              notes: `Pago de nómina - ${stylist?.fullName || stylist?.name || 'Personal'}`,
              movementKind: 'payroll_payment',
              paymentMethod: 'cash',
              referenceType: 'payroll_payment',
              referenceId: savedPayment.id,
              salonId: currentSalonId,
              branchId: currentBranchId,
            },
            session?.user?.id,
            superAdminScopeOverride,
          );
        }
        setPayrollPayments((prev) => prev.map((payment) => (
          String(payment.id) === String(paymentDraft.id) ? savedPayment : payment
        )));
        if (savedMovement && cashMovementDraft) {
          setCashMovements((prev) => prev.map((movement) => (
            String(movement.id) === String(cashMovementDraft.id) ? savedMovement : movement
          )));
        }
      } catch (error) {
        handleSyncError(error, 'No pude liquidar el pago y registrar la salida de caja en Supabase.');
      }
    } else if (hasSupabaseConfig && bootstrapCompletedRef.current && updatedAppointments.length) {
      try {
        await upsertAppointments(updatedAppointments, services, currentSalonId, currentBranchId, stylists, clients);
      } catch (error) {
        handleSyncError(error, 'No pude marcar los servicios como pagados en Supabase.');
      }
    }
  };

  const handleConfirmStaffSettlement = async (stylistIds = [], method = 'cash_box') => {
    const paymentMethod = normalizePayrollPaymentMethod(method);
    if (paymentMethod === 'cash_box' && !activeCashSession) {
      notify('Debes abrir caja antes de liquidar nómina con efectivo de caja.', 'warning');
      return;
    }
    const paidAt = new Date().toISOString();
    const normalizedIds = new Set((stylistIds || []).map(id => String(id)));
    const pendingAppointments = appointments.filter(a => normalizedIds.has(String(a.stylistId)) && a.status === 'Finalizada' && !a.isPaid);
    const updatedAppointments = pendingAppointments.map(a => ({ ...a, isPaid: true, paidAt, updatedAt: paidAt }));
    const paymentDrafts = stylists
      .filter((stylist) => normalizedIds.has(String(stylist.id)))
      .map((stylist) => {
        const stylistAppointments = pendingAppointments.filter((appointment) => String(appointment.stylistId) === String(stylist.id));
        return stylistAppointments.length
          ? {
              ...buildPayrollPaymentDraft(stylist, stylistAppointments, paidAt, 'batch'),
              paymentMethod: toPayrollDbPaymentMethod(paymentMethod),
              notes: `Liquidación general de equipo - ${getPayrollPaymentMethodLabel(paymentMethod)}`,
            }
          : null;
      })
      .filter(Boolean);
    const stylistById = new Map(stylists.map((stylist) => [String(stylist.id), stylist]));
    const cashMovementDrafts = paymentMethod === 'cash_box'
      ? paymentDrafts.map((paymentDraft) => buildPayrollCashMovement(paymentDraft, stylistById.get(String(paymentDraft.stylistId)), paidAt))
      : [];

    setAppointments(prev => prev.map(a =>
      normalizedIds.has(String(a.stylistId)) && a.status === 'Finalizada' && !a.isPaid
        ? { ...a, isPaid: true, paidAt, updatedAt: paidAt }
        : a
    ));
    if (paymentDrafts.length) setPayrollPayments((prev) => [...paymentDrafts, ...prev]);
    if (cashMovementDrafts.length) setCashMovements((prev) => [...prev, ...cashMovementDrafts]);
    setModals(prev => ({ ...prev, staffSettlement: false }));

    if (hasSupabaseConfig && bootstrapCompletedRef.current && paymentDrafts.length) {
      try {
        const savedPayments = [];
        const savedMovements = [];
        for (const paymentDraft of paymentDrafts) {
          const savedPayment = await createPayrollPayment(paymentDraft, session?.user?.id, superAdminScopeOverride);
          savedPayments.push(savedPayment);
          if (paymentMethod === 'cash_box') {
            const stylist = stylistById.get(String(paymentDraft.stylistId));
            const savedMovement = await createCashAuditMovement(
              {
                cashSessionId: activeCashSession.id,
                type: 'out',
                amount: paymentDraft.totalAmount,
                notes: `Pago de nómina - ${stylist?.fullName || stylist?.name || 'Personal'}`,
                movementKind: 'payroll_payment',
                paymentMethod: 'cash',
                referenceType: 'payroll_payment',
                referenceId: savedPayment.id,
                salonId: currentSalonId,
                branchId: currentBranchId,
              },
              session?.user?.id,
              superAdminScopeOverride,
            );
            savedMovements.push({ localPaymentId: paymentDraft.id, movement: savedMovement });
          }
        }
        const savedByLocalId = new Map(savedPayments.map((savedPayment, index) => [String(paymentDrafts[index].id), savedPayment]));
        setPayrollPayments((prev) => prev.map((payment) => savedByLocalId.get(String(payment.id)) || payment));
        if (savedMovements.length) {
          const savedMovementByReference = new Map(savedMovements.map((item) => [String(item.localPaymentId), item.movement]));
          setCashMovements((prev) => prev.map((movement) => savedMovementByReference.get(String(movement.referenceId)) || movement));
        }
      } catch (error) {
        handleSyncError(error, 'No pude liquidar la planilla y registrar las salidas de caja en Supabase.');
      }
    } else if (hasSupabaseConfig && bootstrapCompletedRef.current && updatedAppointments.length) {
      try {
        await upsertAppointments(updatedAppointments, services, currentSalonId, currentBranchId, stylists, clients);
      } catch (error) {
        handleSyncError(error, 'No pude marcar la planilla como pagada en Supabase.');
      }
    }
  };

  const handleSaveAppointment = async (aptData, clientData) => {
    const skipClientRegistration = Boolean(clientData?.skipRegistration);
    let finalClientId = skipClientRegistration ? null : clientData.id;
    const now = new Date().toISOString();
    const normalizedPhone = formatPhoneNumber(clientData.phone || '');
    let createdClient = null;

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      if (!currentSalonId) {
        notify('No se puede guardar la cita porque no hay un salón activo.', 'error');
        return;
      }
      if (!currentBranchId) {
        notify('Selecciona una sucursal antes de guardar la cita.', 'warning');
        return;
      }
    }

    if (!skipClientRegistration && clientData.isNew) {
      const duplicateClient = findClientByPhone(clients, normalizedPhone);
      if (duplicateClient) {
        notify(`Este número ya pertenece a ${duplicateClient.name}. Selecciona ese cliente existente.`, 'warning');
        return;
      }

      createdClient = {
        id: makeId(),
        name: clientData.name,
        phone: normalizedPhone,
        notes: '',
        points: 0,
        createdAt: now,
        completedVisits: 0,
        totalSpent: 0,
        lastVisitAt: null,
        favoriteStylistId: null,
        favoriteStylistName: '',
        favoriteServiceName: '',
        statsUpdatedAt: null,
      };
      setClients([...clients, createdClient]);
      finalClientId = createdClient.id;
    }

    const newApt = {
      id: makeId(),
      ...aptData,
      clientId: finalClientId,
      clientName: skipClientRegistration ? 'Cliente genérico' : undefined,
      type: aptData.type || 'reserva',
      durationMinutes: Number(aptData.durationMinutes) > 0 ? Number(aptData.durationMinutes) : 30,
      status: 'Confirmada',
      createdAt: now,
      checkInAt: aptData.type === 'walkin' ? now : null,
      isPaid: false
    };

    setAppointments([...appointments, newApt]);
    setModals({ ...modals, appointment: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        if (createdClient) {
          await upsertClients([createdClient], currentSalonId);
        }
        await upsertAppointments([newApt], services, currentSalonId, currentBranchId, stylists, clients);
      } catch (error) {
        handleSyncError(error, 'No pude guardar la cita en Supabase.');
      }
    }
  };

  const handleSaveClient = async (clientData) => {
    if (hasSupabaseConfig && bootstrapCompletedRef.current && !currentSalonId) {
      notify('No se puede guardar el cliente porque no hay un salón activo.', 'error');
      return;
    }

    const normalizedClient = {
      ...clientData,
      phone: formatPhoneNumber(clientData.phone || ''),
    };
    const duplicateClient = findClientByPhone(clients, normalizedClient.phone, selectedData.client?.id);

    if (duplicateClient) {
      notify(`Este número ya pertenece a ${duplicateClient.name}.`, 'warning');
      return;
    }

    let savedClient;
    if (selectedData.client) {
      savedClient = { ...selectedData.client, ...normalizedClient };
      setClients(prev => prev.map(c => c.id === selectedData.client.id ? savedClient : c));
      setSelectedData(prev => ({ ...prev, client: savedClient }));
    } else {
      savedClient = {
        id: makeId(),
        ...normalizedClient,
        points: 0,
        createdAt: new Date().toISOString(),
        completedVisits: 0,
        totalSpent: 0,
        lastVisitAt: null,
        favoriteStylistId: null,
        favoriteStylistName: '',
        favoriteServiceName: '',
        statsUpdatedAt: null,
      };
      setClients([...clients, savedClient]);
    }
    setModals({ ...modals, client: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current && savedClient) {
      try {
        await upsertClients([savedClient], currentSalonId);
      } catch (error) {
        handleSyncError(error, 'No pude guardar el cliente en Supabase.');
      }
    }
  };

  const handleSaveService = async (serviceData) => {
    if (hasSupabaseConfig && bootstrapCompletedRef.current && !currentSalonId) {
      notify('No se puede guardar el servicio porque no hay un salón activo.', 'error');
      return;
    }

    const isPromotion = serviceData.category === 'Promocion';
    const normalizedPromotionDiscount = isPromotion
      ? clampPromotionDiscountValue(serviceData.discountType || 'percentage', serviceData.discountValue)
      : 0;
    const normalizedService = {
      ...serviceData,
      price: isPromotion ? 0 : Number(serviceData.price) || 0,
      items: serviceData.category === 'Combo' ? serviceData.items : [],
      appliesTo: isPromotion ? 'General' : 'Servicio',
      discountType: isPromotion ? (serviceData.discountType || 'percentage') : 'percentage',
      discountValue: normalizedPromotionDiscount,
      targetServiceIds: [],
      isOptional: isPromotion ? serviceData.isOptional !== false : true,
    };
    const savedService = selectedData.service?.id
      ? { ...selectedData.service, ...normalizedService }
      : { id: makeId(), ...normalizedService };
    const nextServices = selectedData.service?.id
      ? services.map(s => s.id === selectedData.service.id ? savedService : s)
      : [...services, savedService];

    if (selectedData.service?.id) {
      setServices(nextServices);
    } else {
      setServices(nextServices);
    }
    setModals({ ...modals, service: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertServices([savedService], currentSalonId);
        await syncServiceComboItems(nextServices);
      } catch (error) {
        handleSyncError(error, 'No pude guardar el servicio en Supabase.');
      }
    }
  };

  const handleSaveInventoryProduct = async (productData) => {
    if (!String(productData.productName || productData.name || '').trim()) {
      notify('El producto necesita un nombre.', 'warning');
      return;
    }

    if (hasSupabaseConfig && bootstrapCompletedRef.current && !currentSalonId) {
      notify('No se puede guardar el producto porque no hay un salón activo.', 'error');
      return;
    }

    const normalizedProduct = {
      ...productData,
      id: productData.id || makeId(),
      productName: String(productData.productName || productData.name || '').trim(),
      productCategory: productData.productCategory || 'Reventa',
      usageType: productData.usageType || 'retail',
      unitName: productData.unitName || 'unidad',
      currentStock: Number(productData.currentStock || 0),
      minStock: Number(productData.minStock || 0),
      maxStock: productData.maxStock === '' || productData.maxStock == null ? '' : Number(productData.maxStock || 0),
      costPrice: Number(productData.costPrice || 0),
      salePrice: Number(productData.salePrice || 0),
      salonId: productData.salonId || currentSalonId || null,
      branchId: productData.branchId ?? currentBranchId ?? null,
      isActive: productData.isActive ?? true,
    };

    let savedProducts = [normalizedProduct];

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        savedProducts = await upsertInventoryProducts([normalizedProduct], session?.user?.id, superAdminScopeOverride);
      } catch (error) {
        handleSyncError(error, 'No pude guardar el producto de inventario en Supabase.');
        return;
      }
    }

    const savedProduct = savedProducts[0] || normalizedProduct;
    setInventoryItems((prev) => {
      const exists = prev.some((item) => String(item.id) === String(savedProduct.id));
      return exists
        ? prev.map((item) => String(item.id) === String(savedProduct.id) ? savedProduct : item)
        : [...prev, savedProduct];
    });
    setServices((prev) => mergeInventoryProductIntoServices(prev, savedProduct));
    notify('Producto de inventario guardado.', 'success');
  };

  const handleDeleteInventoryProduct = async (productId) => {
    const confirmed = await confirmAction({
      title: 'Desactivar producto',
      message: 'El producto dejará de aparecer para venta y control de inventario.',
      confirmLabel: 'Desactivar',
    });
    if (!confirmed) return;

    setInventoryItems((prev) => prev.filter((item) => String(item.id) !== String(productId)));
    setServices((prev) => prev.filter((service) => String(service.inventoryItemId || '') !== String(productId)));

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await deleteInventoryProduct(productId);
      } catch (error) {
        handleSyncError(error, 'No pude desactivar el producto de inventario en Supabase.');
      }
    }
  };

  const handleDeleteClient = async (id) => {
    if (appointments.some(a => String(a.clientId) === String(id))) {
      notify('No puedes eliminar este cliente porque ya tiene citas registradas.', 'warning');
      return;
    }

    const confirmed = await confirmAction({
      title: 'Eliminar cliente',
      message: '¿Eliminar cliente permanentemente?',
      confirmLabel: 'Eliminar',
    });

    if (confirmed) {
      setClients(prev => prev.filter(c => c.id !== id));
      setModals({ ...modals, clientDetail: false });

      if (hasSupabaseConfig && bootstrapCompletedRef.current) {
        try {
          await deleteClientRecord(id);
        } catch (error) {
          handleSyncError(error, 'No pude eliminar el cliente en Supabase.');
        }
      }
    }
  };

  const handleSaveStylist = async (stylist) => {
    if (!stylist.name || stylist.name.trim() === '') {
      notify('Ingrese nombre del estilista.', 'warning');
      return;
    }
    const normalizedPhone = formatPhoneNumber(stylist.phone || '');
    const resolvedSalonId = stylist.salonId || currentSalonId || null;
    const resolvedBranchId = stylist.branchId ?? currentBranchId ?? undefined;
    if (!resolvedBranchId) {
      notify('Cada estilista debe tener una sucursal asignada.', 'warning');
      return;
    }
    let savedStylist = null;

    if (stylist.id) {
      const currentIndex = stylists.findIndex(b => String(b.id) === String(stylist.id));
      savedStylist = ensureStylistTheme({
        ...stylist,
        phone: normalizedPhone,
        id: String(stylist.id),
        salonId: resolvedSalonId,
        branchId: resolvedBranchId ?? null,
      }, Math.max(currentIndex, 0));
      setStylists(prev => prev.map((b, idx) => String(b.id) === String(stylist.id) ? ensureStylistTheme(savedStylist, idx) : b));
    } else {
      const newStylist = {
        ...stylist,
        phone: normalizedPhone,
        id: makeId(),
        salonId: resolvedSalonId,
        branchId: resolvedBranchId ?? null,
      };
      savedStylist = ensureStylistTheme(newStylist, stylists.length);
      setStylists(prev => [...prev, savedStylist]);
    }

    if (hasSupabaseConfig && bootstrapCompletedRef.current && savedStylist) {
      try {
        await upsertStylists([savedStylist], resolvedSalonId, resolvedBranchId, session?.user?.id);
        if (session?.user?.id) {
          const nextStylists = await fetchScopedStylists(session.user.id, superAdminScopeOverride);
          setStylists(nextStylists.map((nextStylist, index) => ensureStylistTheme(nextStylist, index)));
        }
      } catch (error) {
        handleSyncError(error, 'No pude guardar el estilista en Supabase.');
      }
    }
  };

  const handleDeleteStylist = async (id) => {
    if (appointments.some(a => String(a.stylistId) === String(id))) {
      notify('No puedes eliminar este estilista porque ya tiene citas registradas.', 'warning');
      return;
    }

    const confirmed = await confirmAction({
      title: 'Eliminar estilista',
      message: '¿Eliminar estilista permanentemente?',
      confirmLabel: 'Eliminar',
    });

    if (confirmed) {
      setStylists(prev => prev.filter(b => b.id !== id));

      if (hasSupabaseConfig && bootstrapCompletedRef.current) {
        try {
          await deleteStylistRecord(id);
        } catch (error) {
          handleSyncError(error, 'No pude eliminar el estilista en Supabase.');
        }
      }
    }
  };

  const handleDeleteService = async (id) => {
    const isUsedInCombo = services.some(service => service.category === 'Combo' && (service.items || []).includes(id));
    if (isUsedInCombo) {
      notify('No puedes eliminar este servicio porque forma parte de un combo.', 'warning');
      return;
    }

    const nextServices = services.filter(service => service.id !== id);
    setServices(nextServices);

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await deleteServiceRecord(id);
        await syncServiceComboItems(nextServices);
      } catch (error) {
        handleSyncError(error, 'No pude eliminar el servicio en Supabase.');
      }
    }
  };

  const handleOpenCashSession = async ({ openingAmount = 0, notes = '' } = {}) => {
    if (!currentSalonId) {
      notify('No se puede abrir caja porque no hay un salón activo.', 'error');
      return null;
    }
    if (!currentBranchId) {
      notify('Debes seleccionar una sucursal antes de abrir caja.', 'warning');
      return null;
    }
    if (activeCashSession) {
      notify('Ya hay una caja abierta en esta sucursal.', 'warning');
      return activeCashSession;
    }

    if (!hasSupabaseConfig || !session?.user?.id) {
      const sessionRecord = {
        id: makeId(),
        salonId: currentSalonId,
        branchId: currentBranchId,
        openedBy: session?.user?.id || null,
        closedBy: null,
        openedAt: new Date().toISOString(),
        closedAt: null,
        openingAmount: Number(openingAmount || 0),
        closingAmount: 0,
        expectedCashAmount: Number(openingAmount || 0),
        countedCashAmount: 0,
        differenceAmount: 0,
        status: 'open',
        notes,
      };
      const movementRecord = {
        id: makeId(),
        cashSessionId: sessionRecord.id,
        salonId: currentSalonId,
        branchId: currentBranchId,
        type: 'in',
        movementKind: 'opening',
        paymentMethod: 'cash',
        amount: Number(openingAmount || 0),
        notes: notes || 'Apertura de caja',
        createdBy: session?.user?.id || null,
        createdAt: new Date().toISOString(),
      };
      setCashSessions((prev) => [sessionRecord, ...prev]);
      setCashMovements((prev) => [...prev, movementRecord]);
      notify('Caja abierta correctamente.', 'success');
      return sessionRecord;
    }

    try {
      const result = await openCashSession(
        { openingAmount, notes, salonId: currentSalonId, branchId: currentBranchId },
        session.user.id,
        superAdminScopeOverride,
      );
      setCashSessions((prev) => [result.session, ...prev]);
      setCashMovements((prev) => [...prev, result.movement]);
      notify('Caja abierta correctamente.', 'success');
      return result.session;
    } catch (error) {
      handleSyncError(error, 'No pude abrir la caja.');
      return null;
    }
  };

  const handleCreateCashMovement = async ({ type = 'in', amount = 0, notes = '' } = {}) => {
    if (!activeCashSession) {
      notify('Debes abrir caja antes de registrar movimientos.', 'warning');
      return null;
    }

    if (!hasSupabaseConfig || !session?.user?.id) {
      const movementRecord = {
        id: makeId(),
        cashSessionId: activeCashSession.id,
        salonId: currentSalonId,
        branchId: currentBranchId,
        type: type === 'out' ? 'out' : 'in',
        movementKind: 'manual',
        paymentMethod: 'cash',
        amount: Number(amount || 0),
        notes,
        createdBy: session?.user?.id || null,
        createdAt: new Date().toISOString(),
      };
      setCashMovements((prev) => [...prev, movementRecord]);
      notify('Movimiento de caja registrado.', 'success');
      return movementRecord;
    }

    try {
      const movement = await createCashMovement(
        { cashSessionId: activeCashSession.id, type, amount, notes, salonId: currentSalonId, branchId: currentBranchId },
        session.user.id,
        superAdminScopeOverride,
      );
      setCashMovements((prev) => [...prev, movement]);
      notify('Movimiento de caja registrado.', 'success');
      return movement;
    } catch (error) {
      handleSyncError(error, 'No pude registrar el movimiento de caja.');
      return null;
    }
  };

  const calculateLocalExpectedCash = (movements = activeCashMovements) =>
    (movements || []).reduce((total, movement) => {
      if ((movement.paymentMethod || 'cash') !== 'cash') return total;
      const amount = Number(movement.amount || 0);
      return movement.type === 'out' ? total - amount : total + amount;
    }, 0);

  const handleCloseCashSession = async ({ countedCashAmount = 0, notes = '' } = {}) => {
    if (!activeCashSession) {
      notify('No hay una caja abierta para cerrar.', 'warning');
      return null;
    }
    const receiptMovements = activeCashMovements;
    const receiptSales = activeCashPosSales;

    if (!hasSupabaseConfig || !session?.user?.id) {
      const expectedCashAmount = calculateLocalExpectedCash();
      const counted = Number(countedCashAmount || 0);
      const closedSession = {
        ...activeCashSession,
        closedBy: session?.user?.id || null,
        closedAt: new Date().toISOString(),
        closingAmount: counted,
        countedCashAmount: counted,
        expectedCashAmount,
        differenceAmount: counted - expectedCashAmount,
        status: 'closed',
        notes,
      };
      setCashSessions((prev) => prev.map((cashSession) => String(cashSession.id) === String(activeCashSession.id) ? closedSession : cashSession));
      setSelectedData((prev) => ({
        ...prev,
        cashClosureReceipt: {
          cashSession: closedSession,
          cashMovements: receiptMovements,
          posSales: receiptSales,
          salonName: currentSalon?.name || 'SalonPro',
          branchName: currentBranch?.name || 'General',
        },
      }));
      setModals((prev) => ({ ...prev, cashClosureReceipt: true }));
      notify('Caja cerrada correctamente.', 'success');
      return closedSession;
    }

    try {
      const closedSession = await closeCashSession(
        { cashSessionId: activeCashSession.id, countedCashAmount, notes, salonId: currentSalonId, branchId: currentBranchId },
        session.user.id,
        superAdminScopeOverride,
      );
      setCashSessions((prev) => prev.map((cashSession) => String(cashSession.id) === String(closedSession.id) ? closedSession : cashSession));
      setSelectedData((prev) => ({
        ...prev,
        cashClosureReceipt: {
          cashSession: closedSession,
          cashMovements: receiptMovements,
          posSales: receiptSales,
          salonName: currentSalon?.name || 'SalonPro',
          branchName: currentBranch?.name || 'General',
        },
      }));
      setModals((prev) => ({ ...prev, cashClosureReceipt: true }));
      notify('Caja cerrada correctamente.', 'success');
      return closedSession;
    } catch (error) {
      handleSyncError(error, 'No pude cerrar la caja.');
      return null;
    }
  };

  const handleRegisterPosSale = async (saleDraft) => {
    const normalizedItems = Array.isArray(saleDraft?.items) ? saleDraft.items : [];
    if (!currentSalonId) {
      notify('No se puede registrar la venta porque no hay un salón activo.', 'error');
      return null;
    }
    if (!currentBranchId) {
      notify('Debes seleccionar una sucursal antes de registrar una venta POS.', 'warning');
      return null;
    }
    if (!activeCashSession) {
      notify('Debes abrir caja antes de registrar ventas.', 'warning');
      return null;
    }
    const rawSubtotal = Number(saleDraft?.rawSubtotal) || normalizedItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
    const discountTotal = Number(saleDraft?.discountTotal || 0);
    const subtotal = Number(saleDraft?.subtotal) || Math.max(rawSubtotal - discountTotal, 0);
    const rawProductTotal = normalizedItems
      .filter((item) => item.category === 'Producto')
      .reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
    const rawServiceTotal = Math.max(rawSubtotal - rawProductTotal, 0);
    const productTotal = Number.isFinite(Number(saleDraft?.productTotal))
      ? Number(saleDraft.productTotal)
      : (rawServiceTotal > 0 ? rawProductTotal : subtotal);
    const serviceTotal = Number.isFinite(Number(saleDraft?.serviceTotal))
      ? Number(saleDraft.serviceTotal)
      : (rawServiceTotal > 0 ? Math.max(subtotal - productTotal, 0) : 0);
    const nextLocalTicketNumber = (posSales || []).reduce(
      (max, sale) => Math.max(max, Number(sale.ticketNumber || 0)),
      0,
    ) + 1;

    const saleRecord = {
      id: makeId(),
      ticketNumber: nextLocalTicketNumber,
      items: normalizedItems.map((item) => ({
        id: item.id,
        productId: item.category === 'Producto' ? item.id : null,
        name: item.name,
        category: item.category,
        price: Number(item.price) || 0,
        qty: Number(item.qty) || 0,
        inventoryAction: item.category === 'Producto' ? 'decrement_pending' : null,
        inventoryQuantity: item.category === 'Producto' ? Number(item.qty) || 0 : 0,
        source: item.source || '',
        appointmentId: item.appointmentId || null,
        stylistId: item.stylistId || null,
        stylistName: item.stylistName || '',
        clientName: item.clientName || '',
      })),
      rawSubtotal,
      discountTotal,
      subtotal,
      productTotal,
      serviceTotal,
      promotionId: saleDraft?.promotion?.id || null,
      promotionName: saleDraft?.promotion?.name || '',
      discountLabel: saleDraft?.promotion?.name
        || (saleDraft?.manualDiscount
          ? `Descuento manual ${saleDraft.manualDiscount.type === 'percentage' ? `${saleDraft.manualDiscount.value}%` : `C$ ${Number(saleDraft.manualDiscount.value || 0).toLocaleString('es-NI')}`}`
          : ''),
      notes: saleDraft?.notes || (saleDraft?.promotion?.name
        ? `Promoción aplicada: ${saleDraft.promotion.name}`
        : (saleDraft?.manualDiscount
          ? `Descuento manual aplicado: ${saleDraft.manualDiscount.type === 'percentage' ? `${saleDraft.manualDiscount.value}%` : `C$ ${Number(saleDraft.manualDiscount.value || 0).toLocaleString('es-NI')}`}`
          : '')),
      cashSessionId: activeCashSession.id,
      paymentMethod: saleDraft?.paymentMethod || 'cash',
      clientId: saleDraft?.clientId || null,
      clientName: saleDraft?.clientName || '',
      salonId: currentSalonId || null,
      branchId: currentBranchId || null,
      createdAt: new Date().toISOString(),
      createdBy: session?.user?.id || null,
    };

    setPosSales((prev) => [...prev, saleRecord]);
    if ((!hasSupabaseConfig || !session?.user?.id) && saleRecord.paymentMethod === 'cash') {
      setCashMovements((prev) => ([
        ...prev,
        {
          id: makeId(),
          cashSessionId: activeCashSession.id,
          salonId: currentSalonId,
          branchId: currentBranchId,
          type: 'in',
          movementKind: 'sale',
          paymentMethod: 'cash',
          amount: saleRecord.subtotal,
          notes: `Venta POS #${saleRecord.ticketNumber}`,
          referenceType: 'pos_sale',
          referenceId: saleRecord.id,
          createdBy: session?.user?.id || null,
          createdAt: saleRecord.createdAt,
        },
      ]));
    }

    if (!hasSupabaseConfig || !session?.user?.id) {
      setSelectedData((prev) => ({
        ...prev,
        posSaleReceipt: {
          sale: saleRecord,
          salonName: currentSalon?.name || 'SalonPro',
          branchName: currentBranch?.name || 'General',
        },
      }));
      setModals((prev) => ({ ...prev, posSaleReceipt: true }));
      notify('Venta de POS registrada.', 'success');
      return saleRecord;
    }

    try {
      const persistedSale = await createPosSale(saleRecord, session.user.id, superAdminScopeOverride);
      setPosSales((prev) => prev.map((sale) => String(sale.id) === String(saleRecord.id) ? persistedSale : sale));
      if (persistedSale.paymentMethod === 'cash' && persistedSale.cashMovement) {
        setCashMovements((prev) => ([
          ...prev.filter((movement) => String(movement.referenceId || '') !== String(saleRecord.id)),
          persistedSale.cashMovement,
        ]));
      }
      setSelectedData((prev) => ({
        ...prev,
        posSaleReceipt: {
          sale: persistedSale,
          salonName: currentSalon?.name || 'SalonPro',
          branchName: currentBranch?.name || 'General',
        },
      }));
      setModals((prev) => ({ ...prev, posSaleReceipt: true }));
      notify('Venta de POS registrada.', 'success');
      return persistedSale;
    } catch (error) {
      setPosSales((prev) => prev.filter((sale) => String(sale.id) !== String(saleRecord.id)));
      handleSyncError(error, 'No pude registrar la venta de POS en Supabase.');
      return null;
    }
  };

  const handleCancelPosSale = async (saleId, reason = '') => {
    if (!saleId) return false;
    const saleToCancel = (posSales || []).find((sale) => String(sale.id) === String(saleId));
    if (!saleToCancel || saleToCancel.canceledAt) return false;
    const canceledAt = new Date().toISOString();
    const cancellationReason = reason || 'Sin motivo especificado';
    const reversalMovement = {
      id: makeId(),
      cashSessionId: saleToCancel.cashSessionId || activeCashSession?.id || null,
      salonId: saleToCancel.salonId || currentSalonId,
      branchId: saleToCancel.branchId || currentBranchId,
      type: 'out',
      movementKind: 'sale',
      paymentMethod: saleToCancel.paymentMethod || 'cash',
      amount: Number(saleToCancel.subtotal || 0),
      notes: `Anulación venta POS #${saleToCancel.ticketNumber || ''} - ${cancellationReason}`,
      referenceType: 'pos_sale_void',
      referenceId: saleToCancel.id,
      ticketNumber: saleToCancel.ticketNumber || 0,
      createdBy: session?.user?.id || null,
      createdAt: canceledAt,
    };

    if (!hasSupabaseConfig || !session?.user?.id) {
      setPosSales((prev) => prev.map((sale) => (
        String(sale.id) === String(saleId)
          ? { ...sale, canceledAt, canceledBy: session?.user?.id || null, cancellationReason }
          : sale
      )));
      setCashMovements((prev) => [...prev, reversalMovement]);
      setModals((prev) => ({ ...prev, posSaleReceipt: false }));
      setSelectedData((prev) => ({ ...prev, posSaleReceipt: null }));
      notify('Venta anulada con reverso de caja.', 'success');
      return true;
    }

    try {
      const result = await cancelPosSaleWithReversal(
        saleToCancel,
        cancellationReason,
        session.user.id,
        superAdminScopeOverride,
      );
      setPosSales((prev) => prev.map((sale) => String(sale.id) === String(saleId) ? result.sale : sale));
      setCashMovements((prev) => [...prev, result.movement]);
      setModals((prev) => ({ ...prev, posSaleReceipt: false }));
      setSelectedData((prev) => ({ ...prev, posSaleReceipt: null }));
      notify('Venta anulada con reverso de caja.', 'success');
      return true;
    } catch (error) {
      handleSyncError(error, 'No pude cancelar la venta de POS en Supabase.');
      return false;
    }
  };

  const handleCancelCashMovement = async (movementId, reason = '') => {
    if (!movementId) return false;
    const movementToCancel = (cashMovements || []).find((movement) => String(movement.id) === String(movementId));
    if (!movementToCancel) return false;
    const canceledAt = new Date().toISOString();
    const cancellationReason = reason || 'Sin motivo especificado';
    const movementNoteMeta = (() => {
      try {
        return movementToCancel.notes ? JSON.parse(movementToCancel.notes) : null;
      } catch {
        return null;
      }
    })();
    const reversalNotes = JSON.stringify({
      label: `Anulación movimiento: ${movementNoteMeta?.label || movementToCancel.notes || 'Sin detalle'} - ${cancellationReason}`,
      currency: movementNoteMeta?.currency === 'USD' ? 'USD' : 'NIO',
      amountOriginal: Number(movementNoteMeta?.amountOriginal ?? movementToCancel.amount ?? 0),
      exchangeRate: movementNoteMeta?.exchangeRate ?? null,
      amountNio: Number(movementToCancel.amount || 0),
      reversalOf: movementToCancel.id,
    });
    const reversalMovement = {
      id: makeId(),
      cashSessionId: movementToCancel.cashSessionId || activeCashSession?.id || null,
      salonId: movementToCancel.salonId || currentSalonId,
      branchId: movementToCancel.branchId || currentBranchId,
      type: movementToCancel.type === 'out' ? 'in' : 'out',
      movementKind: 'manual',
      paymentMethod: movementToCancel.paymentMethod || 'cash',
      amount: Number(movementToCancel.amount || 0),
      notes: reversalNotes,
      referenceType: 'cash_movement_void',
      referenceId: movementToCancel.id,
      createdBy: session?.user?.id || null,
      createdAt: canceledAt,
    };

    if (!hasSupabaseConfig || !session?.user?.id) {
      setCashMovements((prev) => [...prev, reversalMovement]);
      notify('Movimiento anulado con reverso de caja.', 'success');
      return true;
    }

    try {
      const movement = await createCashAuditMovement(
        {
          cashSessionId: movementToCancel.cashSessionId,
          salonId: movementToCancel.salonId || currentSalonId,
          branchId: movementToCancel.branchId || currentBranchId,
          type: movementToCancel.type === 'out' ? 'in' : 'out',
          movementKind: 'manual',
          paymentMethod: movementToCancel.paymentMethod || 'cash',
          amount: Number(movementToCancel.amount || 0),
          notes: reversalNotes,
          referenceType: 'cash_movement_void',
          referenceId: movementToCancel.id,
        },
        session.user.id,
        superAdminScopeOverride,
      );
      setCashMovements((prev) => [...prev, movement]);
      notify('Movimiento anulado con reverso de caja.', 'success');
      return true;
    } catch (error) {
      handleSyncError(error, 'No pude anular el movimiento de caja.');
      return false;
    }
  };

  const handlePrintCashClosureFromHistory = (cashSessionRecord) => {
    if (!cashSessionRecord?.id) return;
    setSelectedData((prev) => ({
      ...prev,
      cashClosureReceipt: {
        cashSession: cashSessionRecord,
        cashMovements: (cashMovements || []).filter((movement) => String(movement.cashSessionId || '') === String(cashSessionRecord.id || '')),
        posSales: (posSales || []).filter((sale) => (
          String(sale.cashSessionId || '') === String(cashSessionRecord.id || '')
          && !sale.canceledAt
        )),
        salonName: currentSalon?.name || 'SalonPro',
        branchName: currentBranch?.name || 'General',
      },
    }));
    setModals((prev) => ({ ...prev, cashClosureReceipt: true }));
  };

  const getNextWalkinQueueTime = (stylistId, date = getTodayString()) => {
    return resolveWalkinQueueTime({ appointments, stylistId, date, businessHours: currentSalonHours });
  };

  const triggerWalkIn = (stylistId = defaultStylistId) => {
    if (!stylistId) {
      notify('Primero debes tener estilistas registrados en esta sucursal para crear un turno sin cita.', 'warning');
      return;
    }
    const walkinDate = getTodayString();
    setSelectedData({
        ...selectedData,
        appointment: {
            date: walkinDate,
            time: getNextWalkinQueueTime(stylistId, walkinDate),
            stylistId,
            type: 'walkin'
        }
    });
    setModals({ ...modals, appointment: true });
  };

  if (loading) return (
    <div className="h-dvh min-h-dvh flex flex-col items-center justify-center bg-black gap-4 text-white">
      <Loader2 className="animate-spin text-indigo-500" size={48} />
      <span className="text-[10px] font-black uppercase tracking-widest italic">Iniciando SalonPro...</span>
    </div>
  );

  return (
    <UiFeedbackContext.Provider value={feedbackContextValue}>
    <div className="mobile-simplify-shell salon-app-shell flex h-dvh min-h-dvh bg-black text-white font-sans overflow-hidden">
      <style>{styleTag}</style>

      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden no-print"
        />
      )}

      <aside className={`mobile-sidebar salon-sidebar fixed inset-y-0 left-0 z-40 flex w-[10.75rem] max-w-[68vw] flex-col border-r border-slate-900 bg-slate-950 no-print overflow-hidden transition-all duration-300 lg:static lg:max-w-none lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-0 lg:min-w-0 lg:opacity-0 lg:pointer-events-none lg:border-r-transparent' : 'lg:w-64 lg:opacity-100'} ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`mobile-sidebar-brand shrink-0 p-3 lg:p-8 flex items-start ${sidebarCollapsed ? 'lg:justify-center lg:px-4' : 'gap-2.5 lg:gap-3'}`}>
          <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-[1rem] p-1">
            <img
              src="/salonpro-logo-ui.png"
              alt="Logo SalonPro"
              className="h-9 w-9 object-contain"
            />
          </div>
          <div className={`min-w-0 flex-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
            <h1 className="text-lg lg:text-xl font-bold tracking-tighter italic text-white">SalonPro<span className="text-indigo-500">.</span></h1>
            {session?.user?.email && (
              <p className="mobile-sidebar-email hidden lg:block text-[10px] font-black tracking-[0.14em] uppercase text-slate-500 mt-2 truncate">
                {session.user.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="rounded-xl border border-white/10 bg-slate-900 p-2 text-slate-400 transition-colors hover:text-white lg:hidden"
            aria-label="Cerrar menú lateral"
          >
            <X size={16} />
          </button>
        </div>
        <nav className={`mobile-sidebar-nav min-h-0 flex-1 overflow-y-auto custom-scrollbar px-2 lg:px-4 pb-3 space-y-1 ${sidebarCollapsed ? 'lg:px-3' : ''}`}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileSidebarOpen(false); }} className={`w-full flex items-center px-3 py-2.5 lg:py-4 rounded-2xl transition-all font-black uppercase text-[8px] lg:text-[10px] tracking-[0.16em] lg:tracking-widest ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : 'gap-2 lg:gap-3'} ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-[0_10px_20px_rgba(225,79,138,0.3)]' : 'text-slate-500 hover:bg-indigo-600/10 hover:text-indigo-500 hover:border-indigo-500/20'}`}>
              <item.icon size={16} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
            </button>
          ))}
          {(currentSalon?.name || currentBranch?.name || (isSuperAdmin && availableSalons.length > 0)) && !sidebarCollapsed && (
            <div className="mobile-sidebar-tenant-panel mt-2 rounded-xl border border-white/5 bg-black/25 px-2.5 py-2 space-y-1.5">
              {isSuperAdmin && availableSalons.length > 0 ? (
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[8px] font-black tracking-[0.16em] uppercase text-slate-500">Vista</p>
                    <Crown size={12} className="text-indigo-300" />
                  </div>
                  <select
                    value={superAdminViewSalonId || availableSalons[0]?.id || ''}
                    onChange={(event) => setSuperAdminViewSalonId(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black px-2.5 py-2 text-[8px] font-black uppercase tracking-[0.12em] text-white outline-none transition-all focus:border-indigo-500"
                  >
                    {availableSalons.map((shop) => (
                      <option key={shop.id} value={shop.id} className="bg-slate-950 text-white">
                        {shop.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : currentSalon?.name ? (
                <div className="min-w-0">
                  <p className="text-[8px] font-black tracking-[0.16em] uppercase text-slate-500">Salón</p>
                  <p className="mt-0.5 truncate text-[10px] font-black uppercase tracking-[0.1em] text-slate-200">{currentSalon.name}</p>
                </div>
              ) : null}
              <div className="flex min-w-0 items-center justify-between gap-2 border-t border-white/5 pt-1.5">
                <p className="text-[8px] font-black tracking-[0.16em] uppercase text-slate-500">Sucursal</p>
                <p className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-emerald-300">{currentBranch?.name || 'General'}</p>
              </div>
            </div>
          )}
          {isSuperAdmin && availableSalons.length > 0 && sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="mt-2 flex w-full items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-600/10 px-4 py-3 text-indigo-500 transition-all hover:border-indigo-500/40 hover:bg-indigo-600/20"
              title={currentSalon?.name ? `Cambiar salón actual: ${currentSalon.name}` : 'Cambiar salón'}
            >
              <Crown size={16} />
            </button>
          )}
        </nav>
        <div className={`mobile-sidebar-footer shrink-0 mobile-safe-bottom px-2 lg:px-4 py-3 lg:py-4 border-t border-slate-900 ${sidebarCollapsed ? 'lg:px-3' : ''}`}>
          <div className="mobile-sidebar-actions">
            {hasSupabaseConfig && session?.user && (
              <button
                onClick={() => setShowSelfPasswordModal(true)}
                disabled={passwordBusy}
                className={`w-full mb-2.5 lg:mb-3 bg-indigo-600/10 hover:bg-indigo-600/20 disabled:opacity-60 text-indigo-500 px-3.5 lg:px-4 py-2.5 lg:py-3 rounded-2xl font-black text-[9px] lg:text-[10px] uppercase flex items-center justify-center border border-indigo-500/20 transition-all ${sidebarCollapsed ? 'lg:px-0' : 'gap-2'}`}
                title={sidebarCollapsed ? 'Cambiar contraseña' : undefined}
              >
                {passwordBusy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Cambiar contraseña</span>
              </button>
            )}
            {hasSupabaseConfig && (
              <button
                onClick={handleSignOut}
                disabled={authBusy}
                className={`w-full bg-indigo-600/10 hover:bg-indigo-600/20 disabled:opacity-60 text-indigo-500 px-3.5 lg:px-4 py-2.5 lg:py-3 rounded-2xl font-black text-[9px] lg:text-[10px] uppercase flex items-center justify-center border border-indigo-500/20 transition-all ${sidebarCollapsed ? 'lg:px-0' : 'gap-2'}`}
                title={sidebarCollapsed ? 'Cerrar sesión' : undefined}
              >
                {authBusy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Cerrar Sesión</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="salon-main-stage flex-1 flex flex-col overflow-hidden bg-slate-950 min-w-0">
        <header className="salon-topbar bg-black border-b border-slate-900 px-3 md:px-8 py-2.5 md:py-4 flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between z-20 no-print">
          <div className="flex w-full md:w-auto items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 text-slate-200 transition-colors hover:text-white lg:hidden shrink-0"
              aria-label="Abrir menú lateral"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="hidden lg:flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 text-slate-200 transition-colors hover:text-white"
              aria-label={sidebarCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            >
              <Menu size={18} />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <h2 className="text-xl md:text-2xl font-black italic uppercase text-white tracking-tighter leading-none truncate">{activeTab}</h2>
            </div>
          </div>
          {(activeTab === 'clientes' || activeTab === 'agenda') && (
            <div className="flex w-full md:w-auto flex-col sm:flex-row items-stretch sm:items-center justify-stretch md:justify-end gap-3">
              {activeTab === 'clientes' && <button onClick={() => { setSelectedData({ ...selectedData, client: null }); setModals({ ...modals, client: true }); }} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-5 md:px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(201,111,141,0.28)] active:scale-95 transition-all"><UserPlus size={16}/> Nuevo Cliente</button>}
              {activeTab === 'agenda' && <button onClick={() => { setSelectedData({ ...selectedData, appointment: { date: viewDate, time: currentSalonHours[0] || DEFAULT_SALON_OPEN_TIME, stylistId: defaultStylistId } }); setModals({ ...modals, appointment: true }); }} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-5 md:px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(201,111,141,0.28)] active:scale-95 transition-all"><Plus size={16}/> Nueva Cita</button>}
            </div>
          )}
        </header>

        <div className="mobile-main-scroll relative z-[1] flex-1 overflow-auto overflow-x-hidden custom-scrollbar">
          {['dashboard', 'caja', 'reportes'].includes(activeTab) && operationalWarnings.length > 0 && renderPersistentWarningBanner('Datos operativos con advertencias', operationalWarnings)}
          {activeTab === 'clientes' && clientDirectoryWarnings.length > 0 && renderPersistentWarningBanner('Clientes cargados parcialmente', clientDirectoryWarnings)}
          {activeTab === 'dashboard' && <DashboardView appointments={appointments} clients={clients} onUpdate={handleUpdateStatus} onOpenAppointment={openAppointmentActions} stylists={stylists} onNewWalkin={triggerWalkIn} posSales={activePosSales} />}
          {activeTab === 'agenda' && <AgendaView viewDate={viewDate} setViewDate={setViewDate} appointments={appointments} clients={clients} stylists={stylists} businessHours={currentSalonHours} openTime={currentSalonOpenTime} closeTime={currentSalonCloseTime} onSlotClick={(h, b) => { setSelectedData({ ...selectedData, appointment: { date: viewDate, time: h, stylistId: b } }); setModals({ ...modals, appointment: true }); }} onAptClick={handleAgendaAppointmentClick} onTransferApt={openTransferAppointment} />}
          {activeTab === 'clientes' && <ClientsTableView clients={effectiveClientDirectory.clients} appointments={effectiveClientDirectory.appointments} stylists={effectiveClientDirectory.stylists} onRowClick={(c) => { setSelectedData({...selectedData, client: c}); setModals({...modals, clientDetail: true}); }} onNewApt={(c) => { setSelectedData({ ...selectedData, appointment: { date: getTodayString(), time: currentSalonHours[0] || DEFAULT_SALON_OPEN_TIME, stylistId: defaultStylistId, client: c } }); setModals({ ...modals, appointment: true }); }} />}
          {activeTab === 'estilistas' && (
            <StylistsView
              stylists={stylists}
              appointments={appointments}
              branches={availableBranches}
              currentSalonId={currentSalonId}
              currentBranchId={currentBranchId}
              canChooseBranch={isAdmin}
              onSave={handleSaveStylist}
              onDelete={handleDeleteStylist}
              onGoToNomina={() => setActiveTab('nomina')}
            />
          )}
          {activeTab === 'nomina' && (
            <NominaView
              stylists={stylists}
              appointments={appointments}
              payrollPayments={payrollPayments}
              onClose={() => setActiveTab('estilistas')}
              onPagar={(stylist, nomina) => {
                setSelectedData({ ...selectedData, paymentReceipt: { stylist, nomina } });
                setModals({ ...modals, paymentReceipt: true });
              }}
              onLiquidarTodo={(rows, summary) => {
                setSelectedData({ ...selectedData, staffSettlement: { rows, summary } });
                setModals({ ...modals, staffSettlement: true });
              }}
            />
          )}
          {activeTab === 'services' && <ServicesView services={services} onAdd={(cat) => { setSelectedData({...selectedData, service: { category: cat }}); setModals({...modals, service: true}); }} onEdit={(s) => { setSelectedData({...selectedData, service: s}); setModals({...modals, service: true}); }} onDelete={handleDeleteService} onManageInventory={() => setActiveTab('inventario')} />}
          {activeTab === 'inventario' && (
            <InventoryView
              services={services}
              inventoryItems={inventoryItems}
              onGoToProducts={() => setActiveTab('services')}
              onSaveProduct={handleSaveInventoryProduct}
              onDeleteProduct={handleDeleteInventoryProduct}
            />
          )}
          {activeTab === 'caja' && (
            <POSView
              services={services}
              clients={clients}
              onSale={handleRegisterPosSale}
              cashSession={activeCashSession}
              cashMovements={activeCashMovements}
              posSales={activeCashPosSales}
              cashSessions={cashSessions}
              allCashMovements={cashMovements}
              allPosSales={posSales}
              onOpenCashSession={handleOpenCashSession}
              onCloseCashSession={handleCloseCashSession}
              onPrintCashClosure={handlePrintCashClosureFromHistory}
              onCashMovement={handleCreateCashMovement}
              onCancelSale={handleCancelPosSale}
              onCancelCashMovement={handleCancelCashMovement}
              confirmAction={confirmAction}
              users={accessControl.users}
            />
          )}
          {activeTab === 'reportes' && (
            <ReportsView
              appointments={appointments}
              clients={clients}
              stylists={stylists}
              branches={availableBranches}
              currentBranchId={currentBranchId}
              posSales={activePosSales}
            />
          )}
          {activeTab === 'sistema' && (
              <SystemView
                currentUser={session?.user}
                accessControl={accessControl}
                savingUserId={savingUserId}
                creatingUser={creatingUser}
                resettingPasswordUserId={resettingPasswordUserId}
                onboardingBusy={onboardingBusy}
              onCreateSystemUser={handleCreateSystemUser}
              onResetUserPassword={handleResetUserPassword}
              onUpdateUserProfile={handleUpdateUserProfile}
              onCreateSalon={handleCreateSalon}
              onCreateBranch={handleCreateBranch}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
            />
            )}
        </div>
      </main>

      {modals.appointment && <AppointmentModal onClose={() => setModals({...modals, appointment: false})} onSave={handleSaveAppointment} services={services} clients={clients} stylists={stylists} initial={selectedData.appointment || { date: viewDate, time: currentSalonHours[0] || DEFAULT_SALON_OPEN_TIME, stylistId: defaultStylistId }} appointments={appointments} businessHours={currentSalonHours} openTime={currentSalonOpenTime} closeTime={currentSalonCloseTime} />}
      {modals.appointmentActions && <AppointmentActionsModal appointment={selectedData.appointmentActions} clients={clients} stylists={stylists} onClose={() => setModals({...modals, appointmentActions: false})} onUpdate={(id, status) => { setModals((prev) => ({ ...prev, appointmentActions: false })); handleUpdateStatus(id, status); }} onMove={(appointment) => { setModals((prev) => ({ ...prev, appointmentActions: false })); openRescheduleAppointment(appointment); }} onTransfer={(appointment) => { setModals((prev) => ({ ...prev, appointmentActions: false })); openTransferAppointment(appointment); }} onCancel={handleCancelAppointment} onMarkLost={handleMarkAppointmentLost} />}
      {modals.rescheduleAppointment && <RescheduleAppointmentModal appointment={selectedData.rescheduleAppointment} appointments={appointments} clients={clients} stylists={stylists} businessHours={currentSalonHours} onClose={() => setModals({...modals, rescheduleAppointment: false})} onSave={handleRescheduleAppointment} />}
      {modals.transferAppointment && <TransferAppointmentModal appointment={selectedData.transferAppointment} appointments={appointments} clients={clients} stylists={stylists} onClose={() => setModals({...modals, transferAppointment: false})} onSave={handleTransferAppointment} />}
      {modals.client && <ClientModal onClose={() => setModals({...modals, client: false})} onSave={handleSaveClient} clients={clients} initial={selectedData.client} />}
      {modals.clientDetail && <ClientDetailModal client={selectedData.client} clients={effectiveClientDirectory.clients} appointments={effectiveClientDirectory.appointments} stylists={effectiveClientDirectory.stylists} onClose={() => setModals({...modals, clientDetail: false})} onEdit={() => { setModals({...modals, clientDetail: false, client: true}); }} onDelete={() => handleDeleteClient(selectedData.client.id)} onNewApt={() => { setModals({...modals, clientDetail: false, appointment: true}); setSelectedData({...selectedData, appointment: { date: getTodayString(), time: currentSalonHours[0] || DEFAULT_SALON_OPEN_TIME, stylistId: defaultStylistId, client: selectedData.client } }); }} />}
      {modals.finalize && <FinalizeModal onClose={() => setModals({...modals, finalize: false})} onConfirm={(ex) => handleUpdateStatus(selectedData.finalize.id, 'Finalizada', ex)} services={services} clients={clients} initial={selectedData.finalize} />}
      {modals.service && <ServiceEditorModal services={services} onClose={() => setModals({...modals, service: false})} onSave={handleSaveService} initial={selectedData.service} />}
      {modals.paymentReceipt && <PaymentReceiptModal data={selectedData.paymentReceipt} onClose={() => setModals({...modals, paymentReceipt: false})} onConfirmPayment={handleConfirmPayment} confirmAction={confirmAction} />}
      {modals.posSaleReceipt && <PosSaleReceiptModal data={selectedData.posSaleReceipt} onClose={() => setModals({...modals, posSaleReceipt: false})} onCancelSale={handleCancelPosSale} confirmAction={confirmAction} />}
      {modals.cashClosureReceipt && <CashClosureReceiptModal data={selectedData.cashClosureReceipt} onClose={() => setModals({...modals, cashClosureReceipt: false})} />}
      {modals.staffSettlement && <StaffSettlementModal data={selectedData.staffSettlement} onClose={() => setModals({...modals, staffSettlement: false})} onConfirmSettlement={handleConfirmStaffSettlement} confirmAction={confirmAction} />}
      {showSelfPasswordModal && (
        <Suspense fallback={accessUiFallback}>
        <PasswordActionModal
          title={session?.user?.user_metadata?.must_change_password ? 'Actualiza tu contraseña' : 'Cambiar contraseña'}
          subtitle={session?.user?.user_metadata?.must_change_password ? 'Cambio obligatorio al primer acceso' : 'Mi cuenta'}
          submitLabel="Actualizar contraseña"
          busy={passwordBusy}
          onClose={() => {
            if (session?.user?.user_metadata?.must_change_password) return;
            setShowSelfPasswordModal(false);
          }}
          onSubmit={handleChangeOwnPassword}
          nextLabel="Nueva contraseña"
          nextPlaceholder="Mínimo 6 caracteres"
          lockOpen={Boolean(session?.user?.user_metadata?.must_change_password)}
        />
        </Suspense>
      )}
      {feedbackToast && (
        (feedbackToast.tone === 'reservation-warning' || feedbackToast.tone === 'reservation-expired') ? (
          <div className="fixed left-1/2 top-5 z-[130] w-[min(92vw,720px)] -translate-x-1/2">
            <div className={`rounded-[2rem] border-2 px-6 py-5 shadow-[0_0_45px_rgba(255,115,0,0.55)] ${
              feedbackToast.tone === 'reservation-warning'
                ? 'border-orange-300 bg-[#ff6a00] text-white'
                : 'border-orange-200 bg-[#ff4d00] text-white'
            }`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.2rem] border border-white/30 bg-black/20">
                  <Info size={18} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] leading-none text-white/90">
                    {feedbackToast.tone === 'reservation-warning' ? 'Cita por vencerse' : 'Cita vencida'}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-[15px] font-black leading-relaxed text-white">
                    {feedbackToast.message}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={dismissFeedbackToast}
                      className="rounded-xl border border-white/35 bg-black px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-950"
                    >
                      Aceptar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-print fixed left-1/2 top-5 z-[130] w-[min(92vw,620px)] -translate-x-1/2">
            <div className={`rounded-[1.8rem] border-2 px-5 py-4 shadow-[0_18px_45px_rgba(48,37,48,0.22)] ${
              feedbackToast.tone === 'success'
                ? 'bg-[#edf7f2] border-[#6fae93] text-[#2f5f50]'
                : feedbackToast.tone === 'error'
                  ? 'bg-[#fff0f4] border-[#d94f83] text-[#8f2d5b]'
                  : feedbackToast.tone === 'info'
                    ? 'bg-[#f2edf8] border-[#6d4aa0] text-[#4b3470]'
                    : 'bg-[#fff7e6] border-[#c8a96a] text-[#7b571d]'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                  feedbackToast.tone === 'success'
                    ? 'bg-[#6fae93] border-[#6fae93] text-white'
                    : feedbackToast.tone === 'error'
                      ? 'bg-[#d94f83] border-[#d94f83] text-white'
                      : feedbackToast.tone === 'info'
                        ? 'bg-[#6d4aa0] border-[#6d4aa0] text-white'
                        : 'bg-[#c8a96a] border-[#c8a96a] text-white'
                }`}>
                  <Info size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-none">
                    {feedbackToast.tone === 'success' ? 'Mensaje del sistema' : feedbackToast.tone === 'error' ? 'Revisar error' : feedbackToast.tone === 'info' ? 'Información' : 'Atención'}
                  </p>
                  <p className="mt-2 text-sm font-black leading-relaxed whitespace-pre-line">{feedbackToast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={dismissFeedbackToast}
                  className="shrink-0 rounded-xl border border-current/20 bg-white/70 p-2 transition-all hover:bg-white"
                  aria-label="Cerrar notificación"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>
        )
      )}
      {confirmState && (
        <div className="no-print fixed inset-0 z-[320] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">
              {confirmState.title}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              {confirmState.message}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
                className="flex-1 rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-slate-800"
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
                className={`flex-1 rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                  confirmState.tone === 'danger'
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </UiFeedbackContext.Provider>
  );
}

function AgendaView({ viewDate, setViewDate, appointments, clients, stylists, businessHours = HOURS, openTime = DEFAULT_SALON_OPEN_TIME, closeTime = DEFAULT_SALON_CLOSE_TIME, onSlotClick, onAptClick, onTransferApt }) {
  const today = getTodayString();
  const isToday = viewDate === today;
  const getAgendaServiceLabel = (serviceName) => normalizeFavoriteServiceName(serviceName) || 'Servicio';
  const [nowPos, setNowPos] = useState(0);
  const agendaStylists = (stylists && stylists.length > 0) ? stylists : [];
  const agendaDefaultSlot = businessHours[0] || DEFAULT_SALON_OPEN_TIME;
  const agendaNowSlot = businessHours.includes(getCurrentTimeHHmm()) ? getCurrentTimeHHmm() : agendaDefaultSlot;
  const agendaTimeColumnWidth = 112;
  const agendaStylistColumnWidth = 168;
  const agendaMinWidth = Math.max(760, agendaTimeColumnWidth + (agendaStylists.length * agendaStylistColumnWidth));
  const agendaGridColumns = `${agendaTimeColumnWidth}px repeat(${agendaStylists.length}, minmax(${agendaStylistColumnWidth}px, 1fr))`;
  const agendaIntervalCount = Math.max((businessHours?.length || 1) - 1, 1);
  const dayAppointments = useMemo(
    () => (appointments || [])
      .filter((appointment) => standardizeDate(appointment.date) === viewDate)
      .filter((appointment) => appointment.status !== 'Cancelada')
      .sort((left, right) => String(left.time || '').localeCompare(String(right.time || ''))),
    [appointments, viewDate],
  );

  useEffect(() => {
    const toMinutes = (time = '00:00') => {
      const [hours, minutes] = `${time}`.split(':').map(Number);
      return ((Number(hours) || 0) * 60) + (Number(minutes) || 0);
    };
    const openMinutes = toMinutes(openTime);
    const closeMinutes = toMinutes(closeTime);
    const totalDuration = Math.max(closeMinutes - openMinutes, 30);
    const updateNow = () => {
      const now = new Date();
      const nowMinutes = (now.getHours() * 60) + now.getMinutes();
      if (nowMinutes < openMinutes || nowMinutes > closeMinutes) { setNowPos(-1); return; }
      const totalMinFromStart = nowMinutes - openMinutes;
      setNowPos((totalMinFromStart / totalDuration) * 100);
    };
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, [openTime, closeTime]);

  const changeDay = (v) => { 
    const d = new Date(viewDate + 'T00:00:00'); 
    d.setDate(d.getDate() + v); 
    setViewDate(formatLocalDateYmd(d)); 
  };

  return (
    <div className="agenda-view p-4 md:p-8 h-full flex flex-col gap-4 md:gap-6 bg-slate-950 no-print">
      <div className="agenda-toolbar-scroll">
        <div
          className="agenda-toolbar min-w-full flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-black border border-slate-800 p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl text-white"
        >
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <button onClick={() => changeDay(-1)} className="p-3 md:p-4 bg-slate-900 rounded-2xl text-white shadow-lg transition-all hover:bg-indigo-600"><ChevronLeft size={20}/></button>
            <button onClick={() => setViewDate(today)} className="px-5 md:px-6 py-3 md:py-4 bg-pink-50 hover:bg-pink-100 text-[10px] font-black uppercase tracking-widest text-pink-600 hover:text-pink-700 transition-all rounded-xl border border-pink-300 shadow-sm">Hoy</button>
            <button onClick={() => changeDay(1)} className="p-3 md:p-4 bg-slate-900 rounded-2xl text-white shadow-lg transition-all hover:bg-indigo-600"><ChevronRight size={20}/></button>
          </div>
          <div className="text-center lg:text-right">
            <p className="mobile-simplify-subtitle text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 italic mb-2 leading-none">Agenda de Salón</p>
            <h3 className="text-2xl sm:text-3xl md:text-3xl font-black italic uppercase text-white tracking-tighter leading-tight">
              {new Date(viewDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
          </div>
        </div>
      </div>

      <div className="lg:hidden space-y-4">
        {agendaStylists.map((stylist) => {
          const stylistAppointments = dayAppointments.filter((appointment) => String(appointment.stylistId) === String(stylist.id));
          return (
            <div key={stylist.id} className="rounded-[2rem] border border-slate-800 bg-slate-900 p-5 shadow-xl">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${stylist.bg} flex items-center justify-center font-black italic text-white`}>{stylist.avatar}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-black uppercase italic tracking-tighter text-white truncate">{stylist.name}</p>
                  <p className={`mt-2 text-[10px] font-black uppercase tracking-[0.18em] ${stylistAppointments.length ? 'text-indigo-300' : 'text-emerald-300'}`}>
                    {stylistAppointments.length ? `${stylistAppointments.length} cita${stylistAppointments.length === 1 ? '' : 's'} en agenda` : 'Disponible'}
                  </p>
                </div>
                <button onClick={() => onSlotClick(agendaNowSlot, stylist.id)} className="rounded-xl border border-indigo-500/30 bg-indigo-600/10 p-3 text-indigo-300">
                  <Plus size={18} />
                </button>
              </div>

              {stylistAppointments.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {stylistAppointments.map((appointment) => {
                    const client = clients.find((item) => item.id === appointment.clientId);
                    return (
                      <div key={appointment.id} onClick={() => onAptClick(appointment)} className="w-full cursor-pointer rounded-[1.4rem] border border-white/5 bg-black/25 px-4 py-4 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black uppercase italic text-white truncate">{client?.name || appointment.clientName || 'Cliente genérico'}</p>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{getAgendaServiceLabel(appointment.service)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black italic text-white">{formatTime12h(appointment.time)}</p>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">{appointment.status || 'Confirmada'}</p>
                          </div>
                        </div>
                        {appointment.status !== 'Finalizada' && appointment.status !== 'Cita Perdida' && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onTransferApt?.(appointment);
                            }}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-600/10 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-indigo-200"
                          >
                            <Repeat size={12} /> Trasladar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <button onClick={() => onSlotClick(agendaDefaultSlot, stylist.id)} className="mt-4 w-full rounded-[1.4rem] border border-dashed border-indigo-500/30 bg-indigo-500/5 px-4 py-4 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">
                  Agendar cita
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="agenda-table-shell hidden lg:flex flex-1 bg-black/40 border border-slate-900 rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] flex-col">
        <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1 relative">
          <div className="h-full flex flex-col relative" style={{ minWidth: agendaMinWidth }}>
            <div
              className="sticky top-0 z-50 grid border-b border-slate-800 bg-slate-950 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
              style={{ gridTemplateColumns: agendaGridColumns }}
            >
              <div className="p-4 border-r border-slate-800 flex items-center justify-center bg-black"><Clock className="text-slate-600" size={22} /></div>
              {agendaStylists.map(b => (
                <div key={b.id} className="min-w-0 p-4 xl:p-6 border-r border-slate-800 last:border-0 flex items-center justify-center gap-3 xl:gap-4 text-white">
                  <div className={`w-11 h-11 rounded-xl bg-slate-950 border-2 ${b.color} flex items-center justify-center font-black italic text-xs text-white shadow-lg`}>{b.avatar}</div>
                  <div className="min-w-0 flex flex-col items-start leading-none text-white">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white italic truncate w-full">{b.name}</span>
                    <span className={`text-[8px] font-bold uppercase mt-1 tracking-widest ${b.color.replace('border', 'text')}`}>Disponible</span>
                  </div>
                </div>
              ))}
            </div>

            {isToday && nowPos >= 0 && (
              <div className="absolute left-0 w-full h-1 bg-rose-500 z-20 pointer-events-none flex items-center justify-start shadow-[0_0_20px_rgba(244,63,94,0.8)]" style={{ top: `calc(76px + ((${nowPos} / 100) * (${agendaIntervalCount} * 100px)))` }}>
                <div className="px-3 py-1 bg-rose-600 text-white text-[8px] font-black uppercase rounded-full -translate-y-1/2 shadow-lg text-white" style={{ marginLeft: agendaTimeColumnWidth }}>Ahora</div>
              </div>
            )}

            {businessHours.map(h => (
              <div 
                key={h} 
                className="grid min-h-[100px] group/row border-b border-slate-900 hover:bg-indigo-600/[0.03] transition-colors"
                style={{ gridTemplateColumns: agendaGridColumns }}
              >
                <div className="p-4 flex items-center justify-center font-black text-slate-500 text-sm border-r border-slate-900 bg-slate-900/10 italic group-hover/row:text-indigo-400 transition-colors">{formatTime12h(h)}</div>
                {agendaStylists.map(b => {
                  const apt = appointments.find(a => {
                    const normalizedAptDate = standardizeDate(a.date);
                    const [aptH, aptM] = (a.time || "00:00").split(':').map(Number);
                    const [slotH, slotM] = h.split(':').map(Number);
                    const isWithinSlot = aptH === slotH && aptM >= slotM && aptM < slotM + 30;
                    return normalizedAptDate === viewDate && isWithinSlot && String(a.stylistId) === String(b.id) && a.status !== 'Cancelada';
                  });

                  const stylistTextTone = ['bg-amber-400', 'bg-orange-400', 'bg-teal-400'].includes(b.bg)
                    ? 'text-slate-950'
                    : 'text-white';
                  const stylistMutedTextTone = stylistTextTone === 'text-white' ? 'text-white/80' : 'text-slate-700';
                  let statusStyles = `${b.bg || 'bg-pink-500'} ${b.color || 'border-pink-500'} ${b.shadow || 'shadow-pink-500/40'} hover:brightness-105`;
                  let appointmentTextTone = stylistTextTone;
                  let appointmentMutedTextTone = stylistMutedTextTone;
                  if (apt?.status === 'En Servicio') statusStyles = `${b.bg || 'bg-emerald-500'} ${b.color || 'border-emerald-500'} ${b.shadow || 'shadow-emerald-500/40'} ring-2 ring-white/35 hover:brightness-105`;
                  if (apt?.status === 'Finalizada' || apt?.status === 'Cita Perdida') {
                    statusStyles = "bg-slate-800 border-slate-700 opacity-60 shadow-slate-900/30";
                    appointmentTextTone = 'text-white';
                    appointmentMutedTextTone = 'text-white/70';
                  }
                  
                  return (
                    <div key={`${h}-${b.id}`} onClick={() => !apt ? onSlotClick(h, b.id) : onAptClick(apt)} className={`p-2 border-r border-slate-900 last:border-r-0 relative transition-all flex items-stretch group/cell ${!apt ? 'cursor-pointer hover:bg-indigo-500/[0.05]' : ''}`}>
                      {apt ? (
                        <div className={`w-full ${statusStyles} ${appointmentTextTone} rounded-2xl p-4 text-[10px] font-black uppercase italic shadow-2xl flex flex-col justify-between animate-in zoom-in-95 border-l-4 transition-all hover:scale-[1.02] cursor-pointer`}>
                          <div className={`flex justify-between items-start ${appointmentTextTone}`}>
                            <span className="drop-shadow-lg truncate w-24">{clients.find(c => c.id === apt.clientId)?.name}</span>
                            {apt.status === 'Cita Perdida' ? <UserX size={12} className="text-rose-300" /> : (apt.status === 'Finalizada' ? <CheckCircle2 size={12} className="text-emerald-300" /> : <Clock size={12} className={appointmentTextTone} />)}
                          </div>
                          <div className={`flex items-center justify-between mt-2 ${appointmentTextTone}`}>
                            <span className={`${appointmentTextTone} text-[8px] font-black truncate flex items-center gap-1`}>
                              {apt.service?.toLowerCase().includes('uñas') ? <Sparkles size={10}/> : <Scissors size={10}/>}
                          {apt.status === 'Cita Perdida' ? 'NO LLEGÓ' : getAgendaServiceLabel(apt.service)}
                            </span>
                            <span className={`text-[7px] font-black ${appointmentMutedTextTone}`}>{formatTime12h(apt.time)}</span>
                          </div>
                          {apt.status !== 'Finalizada' && apt.status !== 'Cita Perdida' && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onTransferApt?.(apt);
                              }}
                              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg bg-black/20 px-2.5 py-1.5 text-[7px] font-black uppercase tracking-[0.16em] text-white/90 transition-all hover:bg-black/35"
                            >
                              <Repeat size={10} /> Trasladar
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full opacity-0 group-hover/cell:opacity-100 flex items-center justify-center transition-all duration-200">
                          <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-[0_0_20px_rgba(201,111,141,0.18)]">
                            <Plus size={18} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ServicesView({ services, onAdd, onEdit, onDelete, onManageInventory }) {
  const [activeCategory, setActiveCategory] = useState('Cabello');
  const getNewServiceLabel = (category) => {
    if (category === 'Promocion') return 'Nueva Promoción';
    if (category === 'Combo') return 'Nuevo Combo';
    if (category === 'Producto') return 'Nuevo Producto';
    if (category === 'Tratamientos') return 'Nuevo Tratamiento';
    if (['Facial', 'Uñas'].includes(category)) return 'Nuevo Servicio';
    return `Nuevo ${CATEGORY_LABELS[category] || 'Servicio'}`;
  };
  const addLabel = getNewServiceLabel(activeCategory);
  const getIcon = (cat) => {
    switch(cat) {
      case 'Cabello': return <Scissors size={32} />;
      case 'Uñas': return <Sparkles size={32} />;
      case 'Facial': return <Sparkles size={32} />;
      case 'Tratamientos': return <Activity size={32} />;
      case 'Combo': return <Zap size={32} />;
      case 'Producto': return <Package size={32} />;
      case 'Promocion': return <Gift size={32} />;
      default: return <Tags size={32} />;
    }
  };
  const filteredServices = useMemo(() => (services || []).filter(s => s.category === activeCategory), [services, activeCategory]);

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-12 h-full animate-in fade-in text-white no-print">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 text-white">
        <div>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tighter leading-none text-white">Menú de servicios</h3>
          <p className="mobile-simplify-subtitle text-[10px] text-indigo-400 font-black uppercase mt-2 italic tracking-[0.2em] leading-none">Gestión Maestra de Catálogo</p>
        </div>
        <button onClick={() => activeCategory === 'Producto' ? onManageInventory?.() : onAdd(activeCategory)} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 md:px-10 py-4 md:py-5 rounded-[2rem] font-black text-[10px] md:text-xs uppercase italic shadow-2xl shadow-indigo-600/40 flex items-center justify-center gap-3 transition-all active:scale-95 group text-white"><Plus size={20} className="group-hover:rotate-90 transition-transform" /> {activeCategory === 'Producto' ? 'Gestionar inventario' : addLabel}</button>
      </div>
      <div className="grid w-full grid-cols-2 gap-3 p-3 bg-black border border-slate-800 rounded-[2.5rem] text-white sm:flex sm:flex-wrap sm:items-center sm:w-fit">
        {CATEGORIES.map(cat => <button key={cat} onClick={() => setActiveCategory(cat)} className={`service-category-tab border border-transparent px-4 md:px-8 py-4 rounded-[2rem] font-black uppercase italic text-[10px] tracking-widest transition-all ${activeCategory === cat ? 'service-category-tab--active shadow-xl shadow-indigo-600/40 translate-y-[-2px]' : 'text-slate-500'}`}>{CATEGORY_LABELS[cat] || cat}</button>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-8">
        {filteredServices.map(s => (
          <div key={s.id} onClick={() => s.category === 'Producto' ? onManageInventory?.() : onEdit(s)} className="group bg-slate-900 border border-slate-800 rounded-[2.2rem] md:rounded-[3rem] p-6 md:p-10 hover:border-indigo-500 transition-all cursor-pointer relative shadow-2xl overflow-hidden flex flex-col justify-between min-h-[260px] md:min-h-[320px] text-white">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl group-hover:bg-indigo-600/30 transition-all"></div>
            {s.category !== 'Producto' && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(s.id); }} className="absolute top-5 md:top-8 right-5 md:right-8 text-slate-600 hover:text-rose-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all z-10 text-white"><Trash2 size={18}/></button>
            )}
            <div className="relative text-white">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-black rounded-2xl flex items-center justify-center text-indigo-500 mb-6 md:mb-8 border border-slate-800 shadow-inner group-hover:scale-110 transition-transform group-hover:text-white group-hover:bg-indigo-600 text-white">{getIcon(s.category)}</div>
              <h4 className="text-xl md:text-2xl font-black uppercase italic leading-tight tracking-tighter group-hover:text-indigo-400 transition-colors text-white">{s.name}</h4>
              <span className="inline-block mt-4 text-[9px] font-black bg-indigo-600/20 text-indigo-400 px-5 py-2 rounded-full uppercase border border-indigo-600/40 tracking-widest italic leading-none">{CATEGORY_LABELS[s.category] || s.category}</span>
              {s.category === 'Promocion' && (
                <div className="mt-5 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                      {'Promoción general'}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-300">
                      {formatPromotionValue(s)}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Aplicación manual al momento de cobrar
                  </p>
                </div>
              )}
            </div>
            <div className="pt-6 md:pt-8 border-t border-slate-800 group-hover:border-indigo-500/30 mt-6 md:mt-8 flex justify-between items-center text-white">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase italic mb-1 leading-none">{s.category === 'Promocion' ? 'Descuento' : 'Precio Final'}</p>
                <p className="text-3xl md:text-4xl font-black italic text-emerald-400 tracking-tighter group-hover:text-white transition-all leading-none">{s.category === 'Promocion' ? formatPromotionValue(s) : `C$ ${s.price}`}</p>
              </div>
              <div className="p-3 bg-black border border-slate-800 rounded-2xl text-slate-600 group-hover:text-indigo-500 transition-colors"><ChevronRight size={20} /></div>
            </div>
          </div>
        ))}
        <div onClick={() => activeCategory === 'Producto' ? onManageInventory?.() : onAdd(activeCategory)} className="border-4 border-dashed border-slate-900 rounded-[2.2rem] md:rounded-[3rem] p-6 md:p-10 flex flex-col items-center justify-center text-slate-800 hover:border-indigo-600 hover:text-indigo-400 transition-all cursor-pointer group min-h-[260px] md:min-h-[320px] text-white"><div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-current flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-white"><Plus size={28} /></div><p className="font-black uppercase italic text-[10px] md:text-xs tracking-widest leading-none text-white text-center">{activeCategory === 'Producto' ? 'Gestionar inventario' : addLabel.replace(/^Nuevo/i, 'Añadir').replace(/^Nueva/i, 'Añadir')}</p></div>
      </div>
    </div>
  );
}

function InventoryView({ inventoryItems = [], onGoToProducts, onSaveProduct, onDeleteProduct }) {
  const emptyForm = {
    productName: '',
    productCategory: 'Reventa',
    usageType: 'retail',
    currentStock: '',
    minStock: '',
    maxStock: '',
    costPrice: '',
    salePrice: '',
    unitName: 'unidad',
    sku: '',
    notes: '',
  };
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const productCategories = ['Reventa', 'Color', 'Tratamiento', 'Cabello', 'Uñas', 'Facial', 'Higiene', 'Herramientas', 'Otros'];
  const usageOptions = [
    { value: 'retail', label: 'Reventa', helper: 'Se vende en caja' },
    { value: 'internal', label: 'Insumo', helper: 'Se usa en servicios' },
    { value: 'both', label: 'Ambos', helper: 'Se vende y se usa' },
  ];
  const activeItems = useMemo(
    () => (inventoryItems || []).filter((item) => item.isActive !== false),
    [inventoryItems],
  );
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activeItems;
    return activeItems.filter((item) => [
      item.productName,
      item.name,
      item.productCategory,
      item.sku,
      item.usageType,
    ].some((value) => String(value || '').toLowerCase().includes(term)));
  }, [activeItems, search]);
  const stockProducts = activeItems.filter((item) => item.trackStock !== false);
  const sellableProducts = activeItems.filter((item) => ['retail', 'both'].includes(item.usageType || 'retail'));
  const internalProducts = activeItems.filter((item) => ['internal', 'both'].includes(item.usageType || 'retail'));
  const totalStockUnits = activeItems.reduce((sum, item) => sum + Number(item.currentStock || 0), 0);
  const inventoryCostValue = activeItems.reduce(
    (sum, item) => sum + (Number(item.currentStock || 0) * Number(item.costPrice || 0)),
    0,
  );
  const inventoryCards = [
    {
      id: 'products',
      label: 'Productos',
      value: activeItems.length,
      helper: `${sellableProducts.length} para venta directa`,
      icon: Package,
      tone: 'text-[#d94f83]',
      bg: 'bg-[#fff7fb]',
      border: 'border-[#ee9fbc]',
    },
    {
      id: 'stock',
      label: 'Stock controlado',
      value: stockProducts.length,
      helper: `${totalStockUnits.toLocaleString('es-NI')} unidades registradas`,
      icon: Layers,
      tone: 'text-[#4f8674]',
      bg: 'bg-[#edf7f2]',
      border: 'border-[#b7d8c7]',
    },
    {
      id: 'cost',
      label: 'Costo inventario',
      value: `C$ ${inventoryCostValue.toLocaleString('es-NI')}`,
      helper: `${internalProducts.length} insumos para servicios`,
      icon: Repeat,
      tone: 'text-[#856a75]',
      bg: 'bg-white',
      border: 'border-[#f2c1d4]',
    },
  ];

  const openNewProduct = () => {
    setEditingProduct(null);
    setForm(emptyForm);
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);
    setForm({
      ...emptyForm,
      ...product,
      productName: product.productName || product.name || '',
      currentStock: product.currentStock ?? '',
      minStock: product.minStock ?? '',
      maxStock: product.maxStock ?? '',
      costPrice: product.costPrice ?? '',
      salePrice: product.salePrice ?? product.price ?? '',
      productCategory: product.productCategory || 'Reventa',
      usageType: product.usageType || 'retail',
      unitName: product.unitName || 'unidad',
      sku: product.sku || '',
      notes: product.notes || '',
    });
  };

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    onSaveProduct?.({
      ...editingProduct,
      ...form,
      productName: form.productName,
      name: form.productName,
    });
    openNewProduct();
  };

  const getUsageLabel = (usageType) => usageOptions.find((option) => option.value === usageType)?.label || 'Reventa';
  const getMargin = (item) => Number(item.salePrice || 0) - Number(item.costPrice || 0);

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-8 h-full animate-in fade-in text-[#302530] no-print">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tighter leading-none text-[#302530]">Inventario</h3>
          <p className="text-[10px] text-[#d94f83] font-black uppercase mt-2 italic tracking-[0.2em] leading-none">Productos, stock, costo y rentabilidad</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={openNewProduct}
            className="w-full sm:w-auto bg-[#d94f83] hover:bg-[#c83f75] text-white px-7 py-4 rounded-[1.4rem] font-black text-[10px] uppercase italic tracking-[0.16em] shadow-[0_14px_30px_rgba(217,79,131,0.22)] flex items-center justify-center gap-3 transition-all active:scale-95"
          >
            <Plus size={18} />
            Nuevo producto
          </button>
          <button
            type="button"
            onClick={onGoToProducts}
            className="w-full sm:w-auto border border-[#ee9fbc] bg-white text-[#9b6076] px-7 py-4 rounded-[1.4rem] font-black text-[10px] uppercase italic tracking-[0.16em] flex items-center justify-center gap-3 transition-all hover:bg-[#fff7fb]"
          >
            <Package size={18} />
            Ver venta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {inventoryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.id} className={`rounded-[1.7rem] border ${card.border} ${card.bg} p-6 shadow-[0_18px_44px_rgba(122,77,94,0.10)]`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#856a75]">{card.label}</p>
                  <p className={`mt-4 text-3xl font-black italic tracking-tighter leading-none ${card.tone}`}>{card.value}</p>
                  <p className="mt-3 text-[11px] font-bold text-[#856a75]">{card.helper}</p>
                </div>
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${card.border} bg-white ${card.tone}`}>
                  <Icon size={22} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-5">
        <form onSubmit={handleSubmit} className="rounded-[2rem] border border-[#ee9fbc] bg-white p-5 shadow-[0_18px_44px_rgba(122,77,94,0.10)] space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d94f83]">Producto</p>
              <h4 className="mt-1 text-xl font-black uppercase italic tracking-tighter text-[#302530]">{editingProduct ? 'Editar inventario' : 'Nuevo producto'}</h4>
            </div>
            {editingProduct && (
              <button type="button" onClick={openNewProduct} className="rounded-2xl border border-[#f2c1d4] px-4 py-2 text-[10px] font-black uppercase text-[#9b6076]">
                Limpiar
              </button>
            )}
          </div>

          <label className="block space-y-2">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b6076]">Nombre</span>
            <input value={form.productName} onChange={(event) => updateForm('productName', event.target.value)} className="w-full rounded-2xl border border-[#ee9fbc] bg-[#fff7fb] px-4 py-3 text-sm font-black text-[#302530] outline-none focus:border-[#d94f83]" placeholder="Ej. Shampoo hidratante" />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b6076]">Categoría</span>
              <select value={form.productCategory} onChange={(event) => updateForm('productCategory', event.target.value)} className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-4 py-3 text-xs font-black uppercase text-[#302530] outline-none">
                {productCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b6076]">Unidad</span>
              <input value={form.unitName} onChange={(event) => updateForm('unitName', event.target.value)} className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-4 py-3 text-xs font-black text-[#302530] outline-none" placeholder="unidad, ml, gr" />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {usageOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => updateForm('usageType', option.value)}
                className={`rounded-2xl border px-3 py-3 text-left transition-all ${form.usageType === option.value ? 'border-[#6fb89b] bg-[#e8f6ef] text-[#2f6f61]' : 'border-[#ee9fbc] bg-white text-[#9b6076]'}`}
              >
                <span className="block text-[10px] font-black uppercase">{option.label}</span>
                <span className="mt-1 block text-[8px] font-bold uppercase leading-tight opacity-80">{option.helper}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b6076]">Stock</span>
              <input type="number" min="0" value={form.currentStock} onChange={(event) => updateForm('currentStock', event.target.value)} className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-4 py-3 text-sm font-black text-[#302530] outline-none" placeholder="0" />
            </label>
            <label className="block space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b6076]">Stock mínimo</span>
              <input type="number" min="0" value={form.minStock} onChange={(event) => updateForm('minStock', event.target.value)} className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-4 py-3 text-sm font-black text-[#302530] outline-none" placeholder="0" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b6076]">Costo compra</span>
              <input type="number" min="0" step="0.01" value={form.costPrice} onChange={(event) => updateForm('costPrice', event.target.value)} className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-4 py-3 text-sm font-black text-[#302530] outline-none" placeholder="C$ 0" />
            </label>
            <label className="block space-y-2">
              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b6076]">Precio venta</span>
              <input type="number" min="0" step="0.01" value={form.salePrice} onChange={(event) => updateForm('salePrice', event.target.value)} className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-4 py-3 text-sm font-black text-[#302530] outline-none" placeholder="C$ 0" />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b6076]">SKU / código interno</span>
            <input value={form.sku} onChange={(event) => updateForm('sku', event.target.value)} className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-4 py-3 text-xs font-black text-[#302530] outline-none" placeholder="Opcional" />
          </label>

          <label className="block space-y-2">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b6076]">Notas de costo o uso</span>
            <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} className="min-h-[76px] w-full resize-none rounded-2xl border border-[#ee9fbc] bg-white px-4 py-3 text-xs font-bold text-[#302530] outline-none" placeholder="Ej. Se usa para keratina, rinde 10 servicios..." />
          </label>

          <button type="submit" className="w-full rounded-2xl bg-[#6fb89b] px-5 py-4 text-[11px] font-black uppercase italic tracking-[0.16em] text-white shadow-[0_14px_30px_rgba(111,184,155,0.24)]">
            {editingProduct ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </form>

        <section className="rounded-[2rem] border border-[#ee9fbc] bg-white overflow-hidden shadow-[0_18px_44px_rgba(122,77,94,0.10)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#f2c1d4] bg-[#fff7fb] px-5 md:px-7 py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d94f83]">Catálogo maestro</p>
              <h4 className="mt-1 text-xl md:text-2xl font-black uppercase italic tracking-tighter text-[#302530]">Productos de inventario</h4>
            </div>
            <div className="relative w-full md:w-[320px]">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9b6076]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-4 py-3 pr-11 text-xs font-black text-[#302530] outline-none" placeholder="Buscar producto..." />
            </div>
          </div>

          {filteredItems.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar">
              <div className="min-w-[940px]">
                <div className="grid grid-cols-[minmax(220px,1fr)_130px_130px_110px_120px_120px_120px] gap-4 px-6 py-4 border-b border-[#f2c1d4] text-[9px] font-black uppercase tracking-[0.16em] text-[#856a75]">
                  <span>Producto</span>
                  <span>Uso</span>
                  <span>Categoría</span>
                  <span>Stock</span>
                  <span>Costo</span>
                  <span>Venta</span>
                  <span>Acción</span>
                </div>
                <div className="divide-y divide-[#f7d7e2]">
                  {filteredItems.map((item) => {
                    const margin = getMargin(item);
                    const isLowStock = Number(item.minStock || 0) > 0 && Number(item.currentStock || 0) <= Number(item.minStock || 0);
                    return (
                      <div key={item.id} className="grid grid-cols-[minmax(220px,1fr)_130px_130px_110px_120px_120px_120px] gap-4 px-6 py-4 items-center">
                        <div>
                          <p className="truncate whitespace-nowrap text-sm font-black uppercase italic text-[#302530]">{item.productName || item.name}</p>
                          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#9b6076]">{item.sku || 'Sin SKU'} · Margen C$ {margin.toLocaleString('es-NI')}</p>
                        </div>
                        <span className={`w-fit rounded-full border px-3 py-1.5 text-[9px] font-black uppercase ${
                          item.usageType === 'internal'
                            ? 'border-[#e7c97d] bg-[#fff8df] text-[#9b7516]'
                            : item.usageType === 'both'
                              ? 'border-[#b7d8c7] bg-[#edf7f2] text-[#4f8674]'
                              : 'border-[#f2c1d4] bg-[#fff7fb] text-[#9b6076]'
                        }`}>{getUsageLabel(item.usageType)}</span>
                        <span className="w-fit rounded-full border border-[#b7d8c7] bg-[#edf7f2] px-3 py-1.5 text-[9px] font-black uppercase text-[#4f8674]">{item.productCategory || 'Otros'}</span>
                        <span className={`text-base font-black italic ${isLowStock ? 'text-[#d94f83]' : 'text-[#4f8674]'}`}>{Number(item.currentStock || 0).toLocaleString('es-NI')}</span>
                        <p className="text-sm font-black italic text-[#856a75]">C$ {Number(item.costPrice || 0).toLocaleString('es-NI')}</p>
                        <p className="text-sm font-black italic text-[#4f8674]">C$ {Number(item.salePrice || 0).toLocaleString('es-NI')}</p>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openEditProduct(item)} className="rounded-xl border border-[#ee9fbc] px-3 py-2 text-[9px] font-black uppercase text-[#d94f83] hover:bg-[#fff7fb]">
                            Editar
                          </button>
                          <button type="button" onClick={() => onDeleteProduct?.(item.id)} className="rounded-xl border border-[#f2c1d4] px-3 py-2 text-[#9b6076] hover:bg-[#fff7fb]" aria-label="Desactivar producto">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <Package size={36} className="mx-auto mb-4 text-[#d94f83]" />
              <p className="text-sm font-black uppercase italic text-[#302530]">No hay productos de inventario</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#856a75]">Crea productos con stock, costo y precio para activar la venta e iniciar rentabilidad</p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function StylistsView({ stylists, appointments, branches, currentSalonId, currentBranchId, canChooseBranch, onSave, onDelete, onGoToNomina }) {
  const { notify } = useUiFeedback();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', fullName: '', cedula: '', salary: '', phone: '', paymentMode: 'salario', paymentFrequency: 'Quincenal', commission: '', level: 'Junior', color: STYLIST_THEME_PALETTE[0].color, bg: STYLIST_THEME_PALETTE[0].bg, branchId: currentBranchId || '' });
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [compensationIndicator, setCompensationIndicator] = useState('salary');
  const branchNameById = useMemo(
    () => new Map((branches || []).map((branch) => [String(branch.id), branch.name])),
    [branches],
  );
  const branchesForCurrentSalon = useMemo(
    () => {
      const allBranches = branches || [];
      if (!currentSalonId) return allBranches;
      const scopedBranches = allBranches.filter((branch) => String(branch.salonId || '') === String(currentSalonId || ''));
      return scopedBranches.length ? scopedBranches : allBranches;
    },
    [branches, currentSalonId],
  );
  const defaultBranchId = useMemo(() => {
    if (!branchesForCurrentSalon.length) return '';
    const currentBranchStillExists = branchesForCurrentSalon.some(
      (branch) => String(branch.id) === String(currentBranchId || ''),
    );
    if (currentBranchStillExists) return String(currentBranchId || '');
    return String(branchesForCurrentSalon[0].id || '');
  }, [branchesForCurrentSalon, currentBranchId]);
  const pendingEarningsByStylist = useMemo(() => {
    const totalsByStylist = new Map();

    (appointments || []).forEach((appointment) => {
      if (appointment.status !== 'Finalizada' || appointment.isPaid) return;
      const stylistId = String(appointment.stylistId || '');
      if (!stylistId) return;
      totalsByStylist.set(stylistId, (totalsByStylist.get(stylistId) || 0) + (Number(appointment.price) || 0));
    });

    return totalsByStylist;
  }, [appointments]);

  const getStylistEarnings = (stylist) => {
    if (!stylistHasCommissionPay(stylist.paymentMode)) return 0;
    const totalSales = pendingEarningsByStylist.get(String(stylist.id)) || 0;
    return totalSales * (Number(stylist.commission) / 100);
  };

  const formatSalary = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const onlyDigits = `${value}`.replace(/\D+/g, '');
    if (!onlyDigits) return '';
    return Number(onlyDigits).toLocaleString('es-ES');
  };

  const formatCommission = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const onlyDigits = `${value}`.replace(/\D+/g, '');
    return onlyDigits;
  };

  const parseSalary = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const onlyDigits = `${value}`.replace(/\D+/g, '');
    return Number(onlyDigits) || 0;
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', fullName: '', cedula: '', salary: '', phone: '', paymentMode: 'salario', paymentFrequency: 'Quincenal', commission: '', level: 'Junior', color: STYLIST_THEME_PALETTE[0].color, bg: STYLIST_THEME_PALETTE[0].bg, branchId: defaultBranchId });
    setIsModalOpen(true);
  };

  const openEdit = (stylist) => {
    setEditing(stylist.id);
    setForm({
      name: stylist.name || '',
      fullName: stylist.fullName || stylist.name || '',
      cedula: formatCedula(stylist.cedula || ''),
      salary: formatSalary(stylistHasBasePay(stylist.paymentMode) ? stylist.salary : ''),
      phone: stylist.phone || '',
      paymentMode: stylist.paymentMode || 'salario',
      paymentFrequency: stylist.paymentFrequency || 'Quincenal',
      commission: stylistHasCommissionPay(stylist.paymentMode) ? String(stylist.commission || '') : '',
      level: stylist.level || 'Junior',
      color: stylist.color || STYLIST_THEME_PALETTE[0].color,
      bg: stylist.bg || STYLIST_THEME_PALETTE[0].bg,
      branchId: stylist.branchId || defaultBranchId,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      notify('Nombre comercial requerido', 'warning');
      return;
    }
    if (!form.fullName.trim()) {
      notify('Nombre completo requerido', 'warning');
      return;
    }
    if (!branchesForCurrentSalon.length) {
      notify('Primero debes crear al menos una sucursal para registrar estilistas.', 'warning');
      return;
    }
    if (!String(form.branchId || '').trim()) {
      notify('Debes seleccionar una sucursal para el estilista.', 'warning');
      return;
    }
    if (getPhoneDigits(form.phone).length > 0 && !isValidPhoneNumber(form.phone)) {
      notify('El teléfono móvil debe tener exactamente 8 dígitos.', 'warning');
      return;
    }
    if (stylistHasBasePay(form.paymentMode) && parseSalary(form.salary) <= 0) {
      notify('Debes ingresar un salario base válido para esta modalidad.', 'warning');
      return;
    }
    if (stylistHasCommissionPay(form.paymentMode)) {
      const commissionRate = parseSalary(form.commission);
      if (commissionRate <= 0) {
        notify('Debes ingresar un porcentaje de comisión válido para esta modalidad.', 'warning');
        return;
      }
      if (commissionRate > 100) {
        notify('La comisión no puede ser mayor al 100%.', 'warning');
        return;
      }
    }
    const savedStylist = {
      id: editing,
      ...form,
      fullName: form.fullName.trim(),
      cedula: formatCedula(form.cedula).trim(),
      phone: formatPhoneNumber(form.phone),
      paymentMode: form.paymentMode,
      paymentFrequency: form.paymentFrequency,
      salary: stylistHasBasePay(form.paymentMode) ? parseSalary(form.salary) : 0,
      commission: stylistHasCommissionPay(form.paymentMode) ? parseSalary(form.commission) : 0,
      level: form.level || 'Junior',
      branchId: form.branchId,
      salonId: currentSalonId || null,
    };
    await onSave(savedStylist);
    closeModal();
  };

  const filteredStylists = stylists.filter((b) => {
    const query = search.toLowerCase();
    return b.name.toLowerCase().includes(query) || (b.fullName || '').toLowerCase().includes(query) || (b.cedula || '').toLowerCase().includes(query) || (b.phone || '').includes(query);
  });

  const staffMetrics = useMemo(() => {
    const roster = stylists || [];
    const salariedStylists = roster.filter(
      (stylist) => stylistHasBasePay(stylist.paymentMode) && Number(stylist.salary || 0) > 0
    );
    const avgSalary = salariedStylists.length
      ? salariedStylists.reduce((sum, stylist) => sum + (Number(stylist.salary) || 0), 0) / salariedStylists.length
      : 0;
    const commissionStylists = roster.filter((stylist) => stylistHasCommissionPay(stylist.paymentMode));
    const avgCommission = commissionStylists.length
      ? commissionStylists.reduce((sum, stylist) => {
          const totalSales = pendingEarningsByStylist.get(String(stylist.id)) || 0;
          return sum + (totalSales * (Number(stylist.commission) / 100));
        }, 0) / commissionStylists.length
      : 0;

    const today = parseLocalDate(getTodayString()) || new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const monthlyFinishedAppointments = (appointments || []).filter((appointment) => {
      if (appointment.status !== 'Finalizada') return false;
      const appointmentDate = parseLocalDate(appointment.date);
      if (!appointmentDate) return false;
      return appointmentDate.getFullYear() === currentYear && appointmentDate.getMonth() === currentMonth;
    });

    const servicesByStylist = monthlyFinishedAppointments.reduce((map, appointment) => {
      const stylistId = String(appointment.stylistId || '');
      if (!stylistId) return map;
      map.set(stylistId, (map.get(stylistId) || 0) + 1);
      return map;
    }, new Map());

    const activeStylists = roster.filter(
      (stylist) => (servicesByStylist.get(String(stylist.id)) || 0) > 0
    ).length;
    const coverage = roster.length ? activeStylists / roster.length : 0;

    let performanceLabel = 'Sin datos';
    let performanceTone = 'text-[#5a3442]';

    if (monthlyFinishedAppointments.length > 0) {
      if (coverage >= 0.8) {
        performanceLabel = 'Alta';
        performanceTone = 'text-[#e14f8a]';
      } else if (coverage >= 0.5) {
        performanceLabel = 'Media';
        performanceTone = 'text-[#bd2f68]';
      } else {
        performanceLabel = 'Baja';
        performanceTone = 'text-[#d93f70]';
      }
    }

    return {
      total: roster.length,
      avgSalary,
      avgCommission,
      salariedCount: salariedStylists.length,
      commissionCount: commissionStylists.length,
      performanceLabel,
      performanceTone,
      avgSalaryCaption: salariedStylists.length
        ? `Solo ${salariedStylists.length} con salario fijo`
        : 'No hay personal con salario fijo',
      avgCommissionCaption: commissionStylists.length
        ? `Promedio pendiente para ${commissionStylists.length} por comisión`
        : 'No hay personal por comisión',
      performanceCaption: monthlyFinishedAppointments.length
        ? `${activeStylists} de ${roster.length || 0} estilistas con servicios finalizados este mes`
        : 'Sin servicios finalizados este mes',
    };
  }, [stylists, appointments, pendingEarningsByStylist]);

  const compensationMetric = compensationIndicator === 'commission'
    ? {
        label: 'Promedio Comisiones',
        value: staffMetrics.commissionCount ? `C$ ${Math.round(staffMetrics.avgCommission).toLocaleString()}` : 'N/A',
        caption: staffMetrics.avgCommissionCaption,
        tone: 'text-[#e14f8a]',
      }
    : {
        label: 'Promedio Salario Fijo',
        value: staffMetrics.salariedCount ? `C$ ${Math.round(staffMetrics.avgSalary).toLocaleString()}` : 'N/A',
        caption: staffMetrics.avgSalaryCaption,
        tone: 'text-[#e14f8a]',
      };

  return (
    <div className="p-10 space-y-8 animate-in fade-in text-[#34242b] no-print">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-[#34242b]">Equipo de Estilistas</h3>
          <p className="text-[10px] text-[#e14f8a] font-black uppercase tracking-widest mt-1 italic leading-none">Administra el equipo, salarios y liquidación de comisiones</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={onGoToNomina}
            className="staff-primary-action px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2"
          >
            <Wallet size={16} /> Pagar Nómina
          </button>
          <button onClick={openNew} className="staff-primary-action px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">Nuevo Estilista</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-[#ff9fc1] shadow-[0_16px_34px_rgba(225,79,138,0.12)] hover:border-[#e14f8a] hover:bg-[#fff7fb] hover:shadow-[0_20px_42px_rgba(225,79,138,0.26)] transition-all">
          <p className="text-[9px] uppercase tracking-widest font-black text-[#9b6076]">Total de Estilistas</p>
          <p className="text-4xl font-black text-[#e14f8a]">{staffMetrics.total}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-[#ff9fc1] shadow-[0_16px_34px_rgba(225,79,138,0.12)] hover:border-[#e14f8a] hover:bg-[#fff7fb] hover:shadow-[0_20px_42px_rgba(225,79,138,0.26)] transition-all">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] uppercase tracking-widest font-black text-[#9b6076]">{compensationMetric.label}</p>
            <div className="inline-flex rounded-2xl border border-[#f5a8c5] bg-[#fff7fb] p-1">
              <button
                type="button"
                onClick={() => setCompensationIndicator('salary')}
                className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${compensationIndicator === 'salary' ? 'staff-segment-active shadow-sm' : 'text-[#9b6076] hover:text-[#7b3f62] hover:bg-[#f3e5ef]'}`}
              >
                Salario
              </button>
              <button
                type="button"
                onClick={() => setCompensationIndicator('commission')}
                className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${compensationIndicator === 'commission' ? 'staff-segment-active shadow-sm' : 'text-[#9b6076] hover:text-[#7b3f62] hover:bg-[#f3e5ef]'}`}
              >
                Comisión
              </button>
            </div>
          </div>
          <p className={`text-4xl font-black ${compensationMetric.tone}`}>
            {compensationMetric.value}
          </p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#9b6076]">
            {compensationMetric.caption}
          </p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-[#ff9fc1] shadow-[0_16px_34px_rgba(225,79,138,0.12)] hover:border-[#e14f8a] hover:bg-[#fff7fb] hover:shadow-[0_20px_42px_rgba(225,79,138,0.26)] transition-all">
          <p className="text-[9px] uppercase tracking-widest font-black text-[#9b6076]">Rendimiento del equipo</p>
          <p className={`text-4xl font-black ${staffMetrics.performanceTone}`}>{staffMetrics.performanceLabel}</p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#9b6076]">
            {staffMetrics.performanceCaption}
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#ff9fc1] rounded-[2rem] p-6 shadow-[0_16px_38px_rgba(225,79,138,0.10)]">
        <div className="flex justify-between items-center mb-5">
          <h4 className="text-lg font-black uppercase text-[#34242b]">Registro de Estilistas</h4>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b6076]" size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, cédula o teléfono" className="pl-10 pr-4 py-3 w-full rounded-xl bg-white border border-[#f5a8c5] text-sm text-[#34242b] outline-none focus:border-[#e14f8a] focus:ring-4 focus:ring-[#e14f8a]/10" />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {filteredStylists.length === 0 && <p className="text-[#7b4d5e] col-span-full">No se encontraron estilistas.</p>}
          {filteredStylists.map((b) => {
             const earnings = getStylistEarnings(b);
             const paymentSummary = (() => {
               if (b.paymentMode === 'porcentaje') {
                 return {
                   label: 'Comisión',
                   value: `${Number(b.commission || 0)}%`,
                 };
               }
               if (b.paymentMode === 'mixto') {
                 return {
                   label: 'Pago mixto',
                   value: `C$ ${Number(b.salary || 0).toLocaleString()} + ${Number(b.commission || 0)}%`,
                 };
               }
               return {
                 label: 'Pago base',
                 value: `C$ ${Number(b.salary || 0).toLocaleString()}`,
               };
             })();
             return (
              <div key={b.id} onClick={() => openEdit(b)} className={`bg-white border ${b.color || 'border-[#ff9fc1]'} rounded-[2.5rem] p-6 shadow-[0_16px_34px_rgba(225,79,138,0.12)] hover:border-[#e14f8a] hover:bg-[#fff7fb] hover:shadow-[0_20px_42px_rgba(225,79,138,0.26)] transition-all relative overflow-hidden group cursor-pointer flex flex-col justify-between h-full`}>
                <div className="absolute inset-0 bg-gradient-to-br from-[#ffeaf3] via-transparent to-[#fff7fb] opacity-80 pointer-events-none z-0"></div>
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black italic shadow-xl ${b.bg || 'bg-indigo-500'}`}>{b.avatar || b.name?.slice(0, 2).toUpperCase()}</div>
                  </div>
                  
                  <h5 className="text-xl font-black text-[#34242b] uppercase tracking-tighter truncate mb-1">{b.name}</h5>
                  <p className="text-[10px] font-bold text-[#9b6076] uppercase tracking-[0.16em] truncate mb-3">{b.fullName || b.name}</p>
                  <div className="flex items-center gap-2 mb-4">
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md border ${b.color} text-[#bd2f68] bg-white`}>{b.level || 'Junior'}</span>
                      <span className="text-[8px] font-black uppercase px-2 py-1 rounded-md bg-[#ffeaf3] text-[#9b6076] border border-[#f5a8c5]">{getStylistPaymentModeLabel(b.paymentMode, b.commission || 0)}</span>
                  </div>

                  <div className="space-y-3 py-4 border-y border-[#f5a8c5]/45 mb-4">
                    <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-[#9b6076] uppercase tracking-widest">Sucursal</span>
                        <span className="text-[10px] font-black text-[#5a3442] italic">{branchNameById.get(String(b.branchId || '')) || 'Sucursal no asignada'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-[#9b6076] uppercase tracking-widest">Cédula</span>
                        <span className="text-[10px] font-black text-[#5a3442] italic">{formatCedula(b.cedula) || 'Sin registrar'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-[#9b6076] uppercase tracking-widest">{paymentSummary.label}</span>
                          <span className="text-xs font-black text-[#34242b] italic">{paymentSummary.value}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-[#e14f8a] uppercase tracking-widest">Pendiente Pago</span>
                        <span className="text-xs font-black text-[#bd2f68] italic">C$ {earnings.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 relative z-10 pt-2">
                  <button onClick={() => openEdit(b)} className="flex-1 bg-[#ffeaf3] hover:bg-[#e14f8a] text-[#bd2f68] hover:text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border border-[#f5a8c5] hover:border-[#e14f8a] transition-all">Ver Perfil</button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(b.id); }} className="px-4 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white py-3 rounded-xl border border-rose-500/20 transition-all"><Trash2 size={14}/></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed top-[64px] bottom-0 left-0 right-0 lg:left-[13.25rem] z-[300] flex items-start justify-center overflow-y-auto bg-black/70 p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-300 text-white">
          <div className="w-full max-w-[70rem] max-h-[calc(100dvh-7rem)] bg-slate-950 border border-white/10 rounded-[2.4rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 flex flex-col md:flex-row relative text-white">
            
            <button onClick={closeModal} className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20 text-white">
              <X size={20} />
            </button>

            <div className={`w-full md:w-[30%] p-7 flex flex-col items-center justify-start border-b md:border-b-0 md:border-r border-white/5 bg-gradient-to-b from-white/5 to-transparent relative overflow-y-auto custom-scrollbar text-white`}>
              <div className={`absolute top-0 left-0 w-full h-1 ${form.bg || 'bg-indigo-500'}`}></div>
              <div className="relative group mb-6 text-white mt-3">
                <div className={`absolute inset-0 ${form.bg || 'bg-indigo-500'} blur-2xl opacity-30 group-hover:opacity-50 transition-opacity`}></div>
                <div className={`w-24 h-24 rounded-[2rem] ${form.bg || 'bg-indigo-500'} flex items-center justify-center text-white font-black text-3xl shadow-2xl relative z-10 border-4 border-white/10 animate-glow text-white`}>
                  {(form.name || 'NB').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
              </div>
              
              <h4 className="text-xl font-black text-white uppercase tracking-tighter text-center mb-1 leading-none">{form.name || 'Sin Nombre'}</h4>
              <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-[0.16em] text-center mb-2">{form.fullName || 'Nombre legal pendiente'}</p>
              <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.16em] mb-4 italic">Cédula: {formatCedula(form.cedula) || 'Sin registrar'}</p>
              <div className="mb-4 px-4 py-3 w-full rounded-2xl border border-white/5 bg-white/5 text-white">
                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] italic leading-none">Sucursal actual</p>
                <p className="mt-2 text-sm font-black text-white italic">{branchNameById.get(String(form.branchId || '')) || 'Sucursal obligatoria'}</p>
              </div>
              
              <div className="w-full space-y-3 text-white">
                <div className="bg-white/5 rounded-2xl p-3 border border-white/5 flex items-center justify-between text-white">
                  <div className="flex items-center gap-3 text-white/40"><Briefcase size={14}/> <span className="text-[10px] font-black uppercase tracking-widest italic leading-none">Modo</span></div>
                  <span className="text-[11px] font-black uppercase text-indigo-400 italic leading-none">{getStylistPaymentModeLabel(form.paymentMode, form.commission || 0)}</span>
                </div>

                <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-white">
                  <div className="flex items-center gap-3 text-white/40 mb-2"><Repeat size={14}/> <span className="text-[10px] font-black uppercase tracking-widest italic leading-none">Frecuencia de Pago</span></div>
                  <div className="grid grid-cols-2 gap-2 text-white">
                    {['Diario', 'Semanal', 'Quincenal', 'Mensual'].map(freq => (
                      <button key={freq} onClick={() => setForm({...form, paymentFrequency: freq})} className={`py-2 rounded-xl text-[8px] font-black uppercase transition-all ${form.paymentFrequency === freq ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'bg-black/40 text-white/40 hover:text-white/60'}`}>
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-white">
                  <div className="flex items-center gap-3 text-white/40 mb-2"><Award size={14}/> <span className="text-[10px] font-black uppercase tracking-widest italic leading-none">Nivel de Rango</span></div>
                  <div className="grid grid-cols-3 gap-2 text-white">
                    {['Junior', 'Medium', 'Senior'].map(lvl => (
                      <button key={lvl} onClick={() => setForm({...form, level: lvl})} className={`py-2 rounded-xl text-[8px] font-black uppercase transition-all ${form.level === lvl ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'bg-black/40 text-white/40 hover:text-white/60'}`}>
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-7 overflow-y-auto custom-scrollbar flex flex-col text-white">
              <div className="flex items-center gap-4 mb-6 text-white">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400"><IdCard size={20}/></div>
                <div>
                  <h3 className="text-xl font-black uppercase italic text-white tracking-tighter leading-none">{editing ? 'Editar Perfil' : 'Alta de Personal'}</h3>
                  <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-1 leading-none">Información de nómina y contacto</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-white">
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Nombre Comercial</label>
                  <div className="relative group text-white">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-400 transition-colors" size={16}/>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Juan Pérez" className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Nombre Completo</label>
                  <div className="relative group text-white">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-400 transition-colors" size={16}/>
                    <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Ej. Juan Carlos Pérez López" className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Teléfono móvil</label>
                  <div className="relative group text-white">
                    <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-400 transition-colors" size={16}/>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneNumber(e.target.value) })} placeholder="Ej. 8899-4455" className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Cédula</label>
                  <div className="relative group text-white">
                    <IdCard className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-400 transition-colors" size={16}/>
                    <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: formatCedula(e.target.value) })} placeholder="Ej. 001-000000-0000A" className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Modalidad de Pago</label>
                  <div className="relative group text-white">
                    <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400 transition-colors" size={16}/>
                    <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value, salary: stylistHasBasePay(e.target.value) ? form.salary : '', commission: stylistHasCommissionPay(e.target.value) ? form.commission : '' })} className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-emerald-500 focus:bg-white/[0.07] transition-all appearance-none cursor-pointer text-white">
                        {STYLIST_PAYMENT_MODE_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id} className="bg-slate-950 text-white">{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {stylistHasBasePay(form.paymentMode) && (
                  <div className="space-y-2 text-white">
                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Sueldo base (C$)</label>
                    <div className="relative group text-white">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-sm leading-none">C$</div>
                      <input value={form.salary} onChange={(e) => setForm({ ...form, salary: formatSalary(e.target.value) })} placeholder="0,000" className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-black text-emerald-400 outline-none focus:border-emerald-500 focus:bg-white/[0.07] transition-all" />
                    </div>
                  </div>
                  )}
                  {stylistHasCommissionPay(form.paymentMode) && (
                  <div className="space-y-2 text-white">
                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Comisión (%)</label>
                    <div className="relative group text-white">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-sm leading-none">%</div>
                      <input value={form.commission} onChange={(e) => setForm({ ...form, commission: formatCommission(e.target.value) })} placeholder="15" className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-black text-emerald-400 outline-none focus:border-emerald-500 focus:bg-white/[0.07] transition-all" />
                    </div>
                  </div>
                  )}
                {canChooseBranch && (
                  <div className="space-y-2 text-white md:col-span-2">
                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Sucursal de trabajo</label>
                    <div className="relative group text-white">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={16} />
                      <select
                        value={form.branchId || ''}
                        onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                        disabled={!branchesForCurrentSalon.length}
                        className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all disabled:opacity-60 appearance-none cursor-pointer"
                      >
                        <option value="" disabled className="bg-slate-950 text-white">
                          {branchesForCurrentSalon.length ? 'Selecciona una sucursal' : 'Sin sucursales disponibles'}
                        </option>
                        {branchesForCurrentSalon.map((branch) => (
                          <option key={branch.id} value={branch.id} className="bg-slate-950 text-white">
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-6 text-white">
                <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] ml-2 block mb-4 italic leading-none">Color de Identificación Visual</label>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3 text-white">
                  {STYLIST_THEME_PALETTE.map((theme) => {
                    const isUsed = stylists.some(b => b.color === theme.color && String(b.id) !== String(editing));
                    return (
                      <button key={theme.id} disabled={isUsed} onClick={() => setForm({ ...form, color: theme.color, bg: theme.bg })} className={`h-10 rounded-xl transition-all relative overflow-hidden flex items-center justify-center border-2 ${theme.bg} ${isUsed ? 'opacity-20 cursor-not-allowed grayscale' : 'hover:scale-110 active:scale-95'} ${form.color === theme.color ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'border-black/50'}`}>
                        {form.color === theme.color && <Check size={14} className="text-white drop-shadow-md" />}
                        {isUsed && <X size={10} className="text-black/50" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-4 mt-auto pt-5 border-t border-white/5 text-white">
                <button onClick={() => void submit()} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest italic shadow-xl shadow-emerald-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                  <CheckCircle2 size={16}/> {editing ? 'Actualizar Perfil' : 'Dar de Alta'}
                </button>
                <button onClick={closeModal} className="px-8 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest italic transition-all flex items-center justify-center gap-3 border border-white/5">
                  <X size={16}/> Cancelar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

const getPayrollHistoryTimestamp = (appointment) => {
  if (appointment.paidAt) return appointment.paidAt;
  if (appointment.updatedAt) return appointment.updatedAt;
  if (appointment.finishedAt) return appointment.finishedAt;
  return appointment.date ? `${appointment.date}T${appointment.time || '00:00'}:00` : new Date().toISOString();
};

const formatPayrollHistoryDate = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Fecha sin registrar';
  return date.toLocaleDateString('es-NI', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const formatPayrollHistoryTime = (timestamp) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });
};

const buildPayrollHistoryForStylist = (stylist, appointments = [], payrollPayments = []) => {
  const formalPayments = (payrollPayments || [])
    .filter((payment) => String(payment.stylistId) === String(stylist.id) && (payment.status || 'paid') === 'paid')
    .map((payment) => ({
      id: payment.id,
      timestamp: payment.paymentDate || payment.createdAt || new Date().toISOString(),
      services: (payment.items || []).map((item) => ({
        id: item.appointmentId || item.id,
        service: item.serviceName || 'Servicio',
        price: Number(item.serviceAmount || 0),
      })),
      salesTotal: Number(payment.salesTotal || 0),
      base: Number(payment.baseAmount || 0),
      comission: Number(payment.commissionAmount || 0),
      total: Number(payment.totalAmount || 0),
      commissionRate: Number(payment.commissionRate || 0),
      paymentScope: payment.paymentScope || 'individual',
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (formalPayments.length) return formalPayments;

  const paidAppointments = (appointments || []).filter(
    (appointment) => String(appointment.stylistId) === String(stylist.id)
      && appointment.status === 'Finalizada'
      && appointment.isPaid
  );

  const groups = paidAppointments.reduce((map, appointment) => {
    const timestamp = getPayrollHistoryTimestamp(appointment);
    const groupKey = appointment.paidAt || appointment.updatedAt
      ? timestamp.slice(0, 16)
      : `${appointment.date || 'sin-fecha'}-${appointment.stylistId}`;
    const current = map.get(groupKey) || {
      id: groupKey,
      timestamp,
      services: [],
      salesTotal: 0,
    };
    current.services.push(appointment);
    current.salesTotal += Number(appointment.price || 0);
    if (new Date(timestamp).getTime() > new Date(current.timestamp).getTime()) {
      current.timestamp = timestamp;
    }
    map.set(groupKey, current);
    return map;
  }, new Map());

  return Array.from(groups.values())
    .map((group) => {
      const commissionRate = Number(stylist.commission || 0);
      const base = stylistHasBasePay(stylist.paymentMode) ? Number(stylist.salary || 0) : 0;
      const comission = stylistHasCommissionPay(stylist.paymentMode) ? group.salesTotal * (commissionRate / 100) : 0;
      return {
        ...group,
        base,
        comission,
        total: base + comission,
        commissionRate,
      };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

function NominaView({ stylists, appointments, payrollPayments = [], onClose, onPagar, onLiquidarTodo }) {
  const [selectedHistoryStylistId, setSelectedHistoryStylistId] = useState(null);

  const payrollRows = useMemo(() => {
    return stylists.map((stylist) => ({
      stylist,
      nomina: getStylistNominaData(stylist, appointments),
    }));
  }, [stylists, appointments]);

  const paymentHistoryRows = useMemo(() => {
    return stylists.map((stylist) => {
      const history = buildPayrollHistoryForStylist(stylist, appointments, payrollPayments);
      return {
        stylist,
        history,
        totalPaid: history.reduce((sum, item) => sum + item.total, 0),
        servicesPaid: history.reduce((sum, item) => sum + item.services.length, 0),
      };
    });
  }, [stylists, appointments, payrollPayments]);

  const selectedHistoryRow = paymentHistoryRows.find(
    (row) => String(row.stylist.id) === String(selectedHistoryStylistId)
  );

  const summary = useMemo(() => {
    return payrollRows.reduce((acc, row) => ({
      staffCount: acc.staffCount + 1,
      pendingServices: acc.pendingServices + row.nomina.pendingServices,
      base: acc.base + row.nomina.base,
      comission: acc.comission + row.nomina.comission,
      total: acc.total + row.nomina.total,
    }), { staffCount: 0, pendingServices: 0, base: 0, comission: 0, total: 0 });
  }, [payrollRows]);

  const indicatorCards = [
    {
      id: 'total',
      label: 'Total a Pagar',
      value: `C$ ${summary.total.toLocaleString()}`,
      helper: `Base C$ ${summary.base.toLocaleString()} + comisión C$ ${summary.comission.toLocaleString()}`,
      icon: Wallet,
      shellClass: 'bg-white border-[#ee9fbc] shadow-[0_18px_44px_rgba(122,77,94,0.12)]',
      iconWrapClass: 'bg-[#fbe9ef] text-[#d94f83] border-[#ee9fbc]',
      valueClass: 'text-[#d94f83]',
      badgeClass: 'text-[#9b6076]',
    },
    {
      id: 'staff',
      label: 'Equipo pendiente',
      value: `${summary.staffCount}`,
      helper: `${summary.staffCount === 1 ? '1 estilista con pago pendiente' : `${summary.staffCount} estilistas listos para liquidar`}`,
      icon: Users,
      shellClass: 'bg-white border-[#d7c6ea] shadow-[0_18px_44px_rgba(109,74,160,0.10)]',
      iconWrapClass: 'bg-[#f2edf8] text-[#6d4aa0] border-[#d7c6ea]',
      valueClass: 'text-[#6d4aa0]',
      badgeClass: 'text-[#856a75]',
    },
    {
      id: 'services',
      label: 'Servicios Pendientes',
      value: `${summary.pendingServices}`,
      helper: summary.pendingServices > 0 ? 'Citas finalizadas aún no liquidadas' : 'Todo el servicio pendiente ya está bajo control',
      icon: Scissors,
      shellClass: 'bg-white border-[#b7d8c7] shadow-[0_18px_44px_rgba(79,134,116,0.12)]',
      iconWrapClass: 'bg-[#edf7f2] text-[#4f8674] border-[#b7d8c7]',
      valueClass: 'text-[#4f8674]',
      badgeClass: 'text-[#6f8d7e]',
    },
  ];

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-8 animate-in fade-in text-[#302530] no-print">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-3 md:p-4 bg-white rounded-2xl text-[#9b6076] hover:text-white hover:bg-[#d94f83] transition-all border border-[#ee9fbc] shadow-[0_10px_24px_rgba(122,77,94,0.10)]"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
          <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-[#302530]">Liquidación de Nómina</h3>
            <p className="text-[#4f8674] text-[10px] font-black uppercase tracking-widest mt-1 italic leading-none">Procesar pagos pendientes del equipo</p>
          </div>
        </div>
        <div className="bg-white border border-[#ee9fbc] p-3 md:p-4 rounded-2xl flex items-center gap-4 self-start md:self-auto shadow-[0_10px_24px_rgba(122,77,94,0.10)]">
          <CalendarIcon size={20} className="text-[#d94f83]" />
          <div className="text-right">
            <p className="text-[9px] text-[#856a75] font-black uppercase leading-none mb-1">Periodo Actual</p>
            <p className="text-xs font-black text-[#302530] italic">{new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {indicatorCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.id} className={`relative overflow-hidden rounded-[2.2rem] border p-7 md:p-8 ${card.shellClass}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,79,131,0.08),transparent_38%)] pointer-events-none" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className={`text-[10px] font-black uppercase italic tracking-[0.24em] leading-none ${card.badgeClass}`}>{card.label}</p>
                  <h4 className={`mt-5 text-4xl md:text-5xl font-black italic tracking-tighter leading-none ${card.valueClass}`}>{card.value}</h4>
                  <p className="mt-4 max-w-[26ch] text-[11px] font-bold text-[#856a75] leading-relaxed">{card.helper}</p>
                </div>
                <div className={`shrink-0 w-14 h-14 rounded-[1.4rem] border flex items-center justify-center shadow-xl ${card.iconWrapClass}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-[#ee9fbc] rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-[0_18px_44px_rgba(122,77,94,0.10)]">
        <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-[980px] w-full text-left">
          <thead className="bg-[#fbe9ef] border-b border-[#ee9fbc] font-black uppercase text-[10px] text-[#856a75] tracking-[0.2em] italic">
            <tr>
              <th className="px-10 py-7">Equipo / Estilista</th>
              <th className="px-10 py-7 text-center">Modalidad</th>
              <th className="px-10 py-7 text-center">Base</th>
              <th className="px-10 py-7 text-center">Comisiones</th>
              <th className="px-10 py-7 text-right">Total a Pagar</th>
              <th className="px-10 py-7 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0c7d5]">
              {payrollRows.map(({ stylist: b, nomina: data }) => {
              return (
                <tr key={b.id} className="hover:bg-[#fff8fa] transition-colors group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${b.bg} rounded-xl flex items-center justify-center font-black italic text-white shadow-lg`}>{b.avatar}</div>
                      <div>
                        <p className="text-base font-black uppercase italic text-[#302530] tracking-tighter leading-none">{b.fullName || b.name}</p>
                        <p className="text-[10px] text-[#856a75] mt-1 font-bold italic leading-none">{formatCedula(b.cedula) || `ID STAFF ${b.id}`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className="text-[10px] font-black text-[#856a75] uppercase italic tracking-widest">{getStylistPaymentModeLabel(b.paymentMode, data.commissionRate)}</span>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className="text-xs font-black text-[#302530] italic">C$ {data.base.toLocaleString()}</span>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className="text-xs font-black text-[#4f8674] italic">C$ {data.comission.toLocaleString()}</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <span className="text-lg font-black text-[#d94f83] italic tracking-tighter">C$ {data.total.toLocaleString()}</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button 
                      onClick={() => onPagar(b, data)}
                      className="bg-[#edf7f2] hover:bg-[#6fae93] text-[#4f8674] hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase italic transition-all border border-[#b7d8c7] shadow-[0_8px_18px_rgba(79,134,116,0.12)]"
                    >
                      Pagar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <section className="rounded-[2rem] border border-[#ee9fbc] bg-white p-5 shadow-[0_18px_44px_rgba(122,77,94,0.10)] md:rounded-[3rem] md:p-7">
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase italic tracking-[0.24em] text-[#d94f83]">Historial de pagos</p>
            <h4 className="mt-1 text-2xl font-black uppercase italic tracking-tighter text-[#302530]">Expediente por estilista</h4>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#856a75]">Pagos liquidados de nómina</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {paymentHistoryRows.map(({ stylist, history, totalPaid, servicesPaid }) => {
            const hasHistory = history.length > 0;
            const lastPayment = history[0];
            return (
              <button
                key={stylist.id}
                type="button"
                onClick={() => setSelectedHistoryStylistId(stylist.id)}
                className={`group relative overflow-hidden rounded-[1.8rem] border bg-[#fffafd] p-5 text-left shadow-[0_14px_30px_rgba(122,77,94,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(122,77,94,0.16)] ${hasHistory ? 'border-[#b7d8c7] hover:border-[#6fae93]' : 'border-[#f2c1d4] hover:border-[#d94f83]'}`}
              >
                <div className={`absolute inset-x-0 top-0 h-1 ${hasHistory ? 'bg-[#6fae93]' : 'bg-[#ee9fbc]'}`} />
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black italic text-white shadow-lg ${stylist.bg || 'bg-[#d94f83]'}`}>
                    {stylist.avatar || stylist.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black uppercase italic tracking-tight text-[#302530]">{stylist.fullName || stylist.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] ${hasHistory ? 'border-[#b7d8c7] bg-[#edf7f2] text-[#4f8674]' : 'border-[#f2c1d4] bg-[#fff1f7] text-[#9b6076]'}`}>
                        {history.length} {history.length === 1 ? 'pago' : 'pagos'}
                      </span>
                      <span className="rounded-full border border-[#f2c1d4] bg-white px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#856a75]">
                        {servicesPaid} servicios
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#856a75]">Histórico</p>
                    <p className={`mt-1 text-lg font-black italic tracking-tighter ${hasHistory ? 'text-[#4f8674]' : 'text-[#9b6076]'}`}>C$ {Math.round(totalPaid).toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[#f2c1d4] pt-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b6076]">
                    {hasHistory ? `Último: ${formatPayrollHistoryDate(lastPayment.timestamp)}` : 'Abrir expediente'}
                  </p>
                  <ArrowRight size={16} className={`${hasHistory ? 'text-[#4f8674]' : 'text-[#d94f83]'} transition-transform group-hover:translate-x-1`} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end pt-4 md:pt-8">
        <button
          onClick={() => onLiquidarTodo(payrollRows, summary)}
          className="w-full md:w-auto bg-[#6fae93] hover:bg-[#4f8674] text-white px-7 md:px-12 py-4 md:py-6 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center gap-3 text-[10px] md:text-xs font-black uppercase italic tracking-[0.16em] md:tracking-widest transition-all shadow-[0_14px_30px_rgba(79,134,116,0.22)] active:scale-95"
        >
          Liquidar todo el equipo <ArrowRight size={18} />
        </button>
      </div>

      {selectedHistoryRow && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#302530]/70 p-4 backdrop-blur-md animate-in fade-in no-print">
          <div className="max-h-[88dvh] w-full max-w-[58rem] overflow-hidden rounded-[2rem] border border-[#ee9fbc] bg-white shadow-[0_24px_70px_rgba(48,37,48,0.35)] md:rounded-[2.5rem]">
            <div className="flex items-start justify-between gap-4 border-b border-[#f2c1d4] bg-[#fff7fb] p-5 md:p-7">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-black italic text-white shadow-lg ${selectedHistoryRow.stylist.bg || 'bg-[#d94f83]'}`}>
                  {selectedHistoryRow.stylist.avatar || selectedHistoryRow.stylist.name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-2xl font-black uppercase italic tracking-tighter text-[#302530]">Historial de pagos</h4>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#856a75]">{selectedHistoryRow.stylist.fullName || selectedHistoryRow.stylist.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryStylistId(null)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#ee9fbc] bg-white text-[#9b6076] transition-all hover:bg-[#d94f83] hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-3 border-b border-[#f2c1d4] bg-white p-5 md:grid-cols-3 md:p-6">
              <div className="rounded-2xl border border-[#f2c1d4] bg-[#fffafd] p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#856a75]">Pagos registrados</p>
                <p className="mt-2 text-3xl font-black italic text-[#302530]">{selectedHistoryRow.history.length}</p>
              </div>
              <div className="rounded-2xl border border-[#b7d8c7] bg-[#edf7f2] p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#4f8674]">Total pagado</p>
                <p className="mt-2 text-3xl font-black italic text-[#4f8674]">C$ {Math.round(selectedHistoryRow.totalPaid).toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-[#f2c1d4] bg-[#fffafd] p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#856a75]">Servicios liquidados</p>
                <p className="mt-2 text-3xl font-black italic text-[#d94f83]">{selectedHistoryRow.servicesPaid}</p>
              </div>
            </div>

            <div className="max-h-[46dvh] overflow-y-auto p-5 custom-scrollbar md:p-6">
              {selectedHistoryRow.history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#ee9fbc] bg-[#fff7fb] p-8 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#856a75]">Todavía no hay pagos registrados para este estilista</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedHistoryRow.history.map((payment) => (
                    <div key={payment.id} className="rounded-2xl border border-[#f2c1d4] bg-[#fffafd] p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-black uppercase italic text-[#302530]">{formatPayrollHistoryDate(payment.timestamp)}</p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#856a75]">{formatPayrollHistoryTime(payment.timestamp)} · {payment.services.length} {payment.services.length === 1 ? 'servicio' : 'servicios'}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-right md:min-w-[20rem]">
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#856a75]">Base</p>
                            <p className="mt-1 text-sm font-black italic text-[#302530]">C$ {Math.round(payment.base).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#856a75]">Comisión</p>
                            <p className="mt-1 text-sm font-black italic text-[#4f8674]">C$ {Math.round(payment.comission).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#856a75]">Pagado</p>
                            <p className="mt-1 text-lg font-black italic text-[#d94f83]">C$ {Math.round(payment.total).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const getPresetDateRange = (preset, baseDate = new Date()) => {
  const anchor = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  if (preset === 'week') {
    const dayIndex = anchor.getDay();
    const diffToMonday = dayIndex === 0 ? -6 : 1 - dayIndex;
    const start = new Date(anchor);
    start.setDate(anchor.getDate() + diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatLocalDateYmd(start), end: formatLocalDateYmd(end) };
  }

  if (preset === 'year') {
    const start = new Date(anchor.getFullYear(), 0, 1);
    const end = new Date(anchor.getFullYear(), 11, 31);
    return { start: formatLocalDateYmd(start), end: formatLocalDateYmd(end) };
  }

  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: formatLocalDateYmd(start), end: formatLocalDateYmd(end) };
};

const formatRangeLabel = (start, end) => {
  const parsedStart = parseLocalDate(start);
  const parsedEnd = parseLocalDate(end);
  if (!parsedStart || !parsedEnd) return 'Rango sin definir';

  const startLabel = parsedStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const endLabel = parsedEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} a ${endLabel}`;
};

function ReportsView({ appointments, clients, stylists, branches = [], currentBranchId = null, posSales = [] }) {
  const [reportTab, setReportTab] = useState('ventas'); 
  const [salesPeriod, setSalesPeriod] = useState('week'); 
  const [productRangePreset, setProductRangePreset] = useState('month');
  const [showProductRangeControls, setShowProductRangeControls] = useState(false);
  const [staffRangePreset, setStaffRangePreset] = useState('month');
  const [showStaffRangeControls, setShowStaffRangeControls] = useState(false);
  const [selectedReportBranchId, setSelectedReportBranchId] = useState(currentBranchId || 'all');
  const [reportToday, setReportToday] = useState(() => getTodayString());
  const [productRangeStart, setProductRangeStart] = useState(() => getPresetDateRange('month').start);
  const [productRangeEnd, setProductRangeEnd] = useState(() => getPresetDateRange('month').end);
  const [staffRangeStart, setStaffRangeStart] = useState(() => getPresetDateRange('month').start);
  const [staffRangeEnd, setStaffRangeEnd] = useState(() => getPresetDateRange('month').end);
  const stylistsById = useMemo(() => Object.fromEntries((stylists || []).map(b => [String(b.id), b])), [stylists]);
  const reportTodayDate = useMemo(() => parseLocalDate(reportToday) || new Date(), [reportToday]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeoutMs = Math.max(60_000, nextMidnight.getTime() - now.getTime());

    const timerId = globalThis.setTimeout(() => {
      setReportToday(getTodayString());
    }, timeoutMs);

    return () => globalThis.clearTimeout(timerId);
  }, [reportToday]);

  const effectiveReportBranchId = selectedReportBranchId === 'all' ? 'all' : (
    (branches || []).some((branch) => String(branch.id) === String(selectedReportBranchId))
      ? selectedReportBranchId
      : 'all'
  );
  const scopedAppointments = useMemo(
    () => (appointments || []).filter((appointment) => {
      if (effectiveReportBranchId === 'all') return true;
      const resolvedBranchId = appointment.branchId || stylistsById[String(appointment.stylistId)]?.branchId || null;
      return String(resolvedBranchId || '') === String(effectiveReportBranchId);
    }),
    [appointments, effectiveReportBranchId, stylistsById],
  );
  const scopedPosSales = useMemo(
    () => (posSales || []).filter((sale) => (
      effectiveReportBranchId === 'all'
        ? true
        : String(sale.branchId || '') === String(effectiveReportBranchId)
    )),
    [posSales, effectiveReportBranchId],
  );
  const unresolvedLegacyPosSalesCount = useMemo(
    () => (posSales || []).filter((sale) => !sale.salonId || !sale.branchId).length,
    [posSales],
  );
  const globalFinished = useMemo(
    () => (appointments || []).filter((appointment) => appointment.status === 'Finalizada'),
    [appointments],
  );
  const finished = useMemo(() => scopedAppointments.filter(a => a.status === 'Finalizada'), [scopedAppointments]);
  const finishedRevenueTotal = useMemo(
    () => finished.reduce((acc, appointment) => acc + (parseInt(appointment.price) || 0), 0),
    [finished],
  );
  const effectiveSalesRange = useMemo(
    () => getPresetDateRange(salesPeriod, reportTodayDate),
    [reportTodayDate, salesPeriod],
  );
  const salesRangeLabel = useMemo(
    () => formatRangeLabel(effectiveSalesRange.start, effectiveSalesRange.end),
    [effectiveSalesRange.end, effectiveSalesRange.start],
  );
  const presetProductRange = useMemo(
    () => getPresetDateRange(productRangePreset === 'custom' ? 'month' : productRangePreset, reportTodayDate),
    [productRangePreset, reportTodayDate],
  );
  const productRangeInputStart = productRangePreset === 'custom' ? productRangeStart : presetProductRange.start;
  const productRangeInputEnd = productRangePreset === 'custom' ? productRangeEnd : presetProductRange.end;
  const effectiveProductRange = useMemo(() => {
    const candidateStart = productRangePreset === 'custom' ? productRangeStart : presetProductRange.start;
    const candidateEnd = productRangePreset === 'custom' ? productRangeEnd : presetProductRange.end;

    if (!candidateStart || !candidateEnd) {
      return presetProductRange;
    }

    return candidateStart <= candidateEnd
      ? { start: candidateStart, end: candidateEnd }
      : { start: candidateEnd, end: candidateStart };
  }, [presetProductRange, productRangeEnd, productRangePreset, productRangeStart]);
  const productRangeLabel = useMemo(
    () => formatRangeLabel(effectiveProductRange.start, effectiveProductRange.end),
    [effectiveProductRange.end, effectiveProductRange.start],
  );
  const periodFinished = useMemo(
    () => finished.filter((appointment) => {
      const normalizedDate = standardizeDate(appointment.date);
      return normalizedDate >= effectiveSalesRange.start && normalizedDate <= effectiveSalesRange.end;
    }),
    [effectiveSalesRange.end, effectiveSalesRange.start, finished],
  );
  const periodPosSales = useMemo(
    () => scopedPosSales.filter((sale) => {
      if (!sale?.createdAt) return false;
      const saleDate = formatLocalDateYmd(new Date(sale.createdAt));
      return saleDate >= effectiveSalesRange.start && saleDate <= effectiveSalesRange.end;
    }),
    [effectiveSalesRange.end, effectiveSalesRange.start, scopedPosSales],
  );
  const total = useMemo(
    () => periodFinished.reduce((acc, appointment) => acc + (parseInt(appointment.price) || 0), 0),
    [periodFinished],
  );
  const totalProductRevenue = useMemo(
    () => periodPosSales.reduce((acc, sale) => acc + (Number(sale.productTotal || 0)), 0),
    [periodPosSales],
  );
  const totalCombinedRevenue = total + totalProductRevenue;
  const productReportPosSales = useMemo(
    () => scopedPosSales.filter((sale) => {
      if (!sale?.createdAt) return false;
      const saleDate = formatLocalDateYmd(new Date(sale.createdAt));
      return saleDate >= effectiveProductRange.start && saleDate <= effectiveProductRange.end;
    }),
    [effectiveProductRange.end, effectiveProductRange.start, scopedPosSales],
  );
  const totalProductUnits = useMemo(
    () => productReportPosSales.reduce((acc, sale) => (
      acc + (sale.items || []).reduce((saleUnits, item) => (
        item.category === 'Producto' ? saleUnits + (Number(item.qty) || 0) : saleUnits
      ), 0)
    ), 0),
    [productReportPosSales],
  );
  const productSalesSummary = useMemo(() => {
    const summaryMap = new Map();

    productReportPosSales.forEach((sale) => {
      const saleTicketNumber = Number(sale.ticketNumber || 0);
      const productItems = (sale.items || []).filter((item) => item.category === 'Producto');
      const saleGrossRevenue = productItems.reduce(
        (sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)),
        0,
      );
      const saleNetRevenue = Number(sale.productTotal || sale.subtotal || 0);

      productItems.forEach((item) => {
        if (item.category !== 'Producto') return;

        const key = String(item.id || item.name || '');
        const lineGrossRevenue = (Number(item.price) || 0) * (Number(item.qty) || 0);
        const lineNetRevenue = saleGrossRevenue > 0
          ? (saleNetRevenue * lineGrossRevenue) / saleGrossRevenue
          : lineGrossRevenue;
        const current = summaryMap.get(key) || {
          id: item.id || key,
          name: item.name || 'Producto',
          units: 0,
          revenue: 0,
          tickets: new Set(),
        };

        current.units += Number(item.qty) || 0;
        current.revenue += lineNetRevenue;
        if (saleTicketNumber > 0) current.tickets.add(saleTicketNumber);
        summaryMap.set(key, current);
      });
    });

    return Array.from(summaryMap.values())
      .map((entry) => ({
        ...entry,
        revenue: Number(entry.revenue.toFixed(2)),
        ticketsCount: entry.tickets.size,
      }))
      .sort((left, right) => (
        right.revenue - left.revenue
        || right.units - left.units
        || left.name.localeCompare(right.name)
      ));
  }, [productReportPosSales]);
  const productReportRevenue = useMemo(
    () => Number(
      productSalesSummary.reduce((acc, product) => acc + (Number(product.revenue) || 0), 0).toFixed(2),
    ),
    [productSalesSummary],
  );
  const productChartSegments = useMemo(() => {
    const colors = ['#00f5a0', '#7c5cff', '#ffb800', '#ff4db8', '#22d3ee', '#b026ff', '#7dff3c'];
    const totalRevenue = productSalesSummary.reduce((sum, product) => sum + product.revenue, 0);
    const { segments } = productSalesSummary.reduce((accumulator, product, index) => {
      const percentage = totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0;
      const segment = {
        ...product,
        color: colors[index % colors.length],
        start: accumulator.nextStart,
        end: accumulator.nextStart + percentage,
        percentage,
      };

      return {
        nextStart: accumulator.nextStart + percentage,
        segments: [...accumulator.segments, segment],
      };
    }, { nextStart: 0, segments: [] });

    return segments;
  }, [productSalesSummary]);
  const productPieBackground = useMemo(() => {
    if (!productChartSegments.length) return 'conic-gradient(#0f172a 0 100%)';
    return `conic-gradient(${productChartSegments.map((segment) => (
      `${segment.color} ${segment.start}% ${segment.end}%`
    )).join(', ')})`;
  }, [productChartSegments]);
  const productPieLabels = useMemo(
    () => productChartSegments
      .filter((segment) => segment.percentage > 0)
      .map((segment) => {
        const midPoint = (segment.start + segment.end) / 2;
        const angle = ((midPoint / 100) * 360) - 90;
        const angleInRadians = (angle * Math.PI) / 180;
        const radius = 42;

        return {
          id: segment.id,
          color: segment.color,
          percentageLabel: `${segment.percentage.toFixed(1)}%`,
          left: `${50 + (Math.cos(angleInRadians) * radius)}%`,
          top: `${50 + (Math.sin(angleInRadians) * radius)}%`,
        };
      }),
    [productChartSegments],
  );
  const clientsById = useMemo(() => Object.fromEntries((clients || []).map(c => [String(c.id), c])), [clients]);
  const stylistIdsWithScopedAppointments = useMemo(
    () => new Set((scopedAppointments || []).map((appointment) => String(appointment.stylistId || '')).filter(Boolean)),
    [scopedAppointments],
  );
  const scopedStylists = useMemo(
    () => (stylists || []).filter((stylist) => (
      effectiveReportBranchId === 'all'
        ? true
        : (
          String(stylist.branchId || '') === String(effectiveReportBranchId)
          || stylistIdsWithScopedAppointments.has(String(stylist.id))
        )
    )),
    [stylists, effectiveReportBranchId, stylistIdsWithScopedAppointments],
  );
  const presetStaffRange = useMemo(
    () => getPresetDateRange(staffRangePreset === 'custom' ? 'month' : staffRangePreset, reportTodayDate),
    [reportTodayDate, staffRangePreset],
  );
  const rangeInputStart = staffRangePreset === 'custom' ? staffRangeStart : presetStaffRange.start;
  const rangeInputEnd = staffRangePreset === 'custom' ? staffRangeEnd : presetStaffRange.end;
  const effectiveStaffRange = useMemo(() => {
    const candidateStart = staffRangePreset === 'custom' ? staffRangeStart : presetStaffRange.start;
    const candidateEnd = staffRangePreset === 'custom' ? staffRangeEnd : presetStaffRange.end;

    if (!candidateStart || !candidateEnd) {
      return presetStaffRange;
    }

    return candidateStart <= candidateEnd
      ? { start: candidateStart, end: candidateEnd }
      : { start: candidateEnd, end: candidateStart };
  }, [presetStaffRange, staffRangeEnd, staffRangePreset, staffRangeStart]);
  const staffRangeLabel = useMemo(
    () => formatRangeLabel(effectiveStaffRange.start, effectiveStaffRange.end),
    [effectiveStaffRange.end, effectiveStaffRange.start],
  );
  const monthlyFinished = useMemo(
    () => finished.filter((appointment) => {
      const normalizedDate = standardizeDate(appointment.date);
      return normalizedDate >= effectiveStaffRange.start && normalizedDate <= effectiveStaffRange.end;
    }),
    [effectiveStaffRange.end, effectiveStaffRange.start, finished],
  );
  const currentMonthRange = useMemo(
    () => getPresetDateRange('month', reportTodayDate),
    [reportTodayDate],
  );
  const monthlyGlobalFinished = useMemo(
    () => globalFinished.filter((appointment) => {
      const normalizedDate = standardizeDate(appointment.date);
      return normalizedDate >= currentMonthRange.start && normalizedDate <= currentMonthRange.end;
    }),
    [currentMonthRange.end, currentMonthRange.start, globalFinished],
  );
  
  const barGradients = [
    'from-indigo-500 to-blue-700', 'from-emerald-400 to-teal-700', 'from-amber-400 to-orange-700', 
    'from-rose-500 to-pink-700', 'from-violet-500 to-purple-800', 'from-cyan-400 to-sky-700', 'from-fuchsia-500 to-pink-600'
  ];

  const stats = useMemo(() => {
    const hasData = finished.length > 0;

    const globalStaffMetrics = (stylists || []).map((stylist) => {
      const stylistFinished = monthlyGlobalFinished.filter((appointment) => String(appointment.stylistId) === String(stylist.id));
      const stylistCount = stylistFinished.length;
      const stylistSales = stylistFinished.reduce((sum, appointment) => sum + (parseInt(appointment.price) || 0), 0);

      return {
        ...stylist,
        count: stylistCount,
        sales: stylistSales,
      };
    });

    const bestStylistObj = globalStaffMetrics.length > 0
      ? globalStaffMetrics.reduce((prev, current) => (prev.sales >= current.sales ? prev : current), globalStaffMetrics[0])
      : null;
    
    // Métrica por personal
    const staffMetrics = scopedStylists.map((b) => {
      const bFinished = finished.filter(a => String(a.stylistId) === String(b.id));
      const bCount = bFinished.length;
      const bSales = bFinished.reduce((sum, a) => sum + (parseInt(a.price) || 0), 0);
      const bAvgTicket = bCount > 0 ? bSales / bCount : 0;
      
      const ratings = bFinished.filter(a => typeof a.rating === 'number').map(a => a.rating);
      const avgRating = ratings.length > 0 ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : "0.0";

      return { 
        ...b, 
        count: bCount, 
        sales: bSales, 
        avgTicket: bAvgTicket, 
        retention: bCount > 0 ? Math.min(70 + Math.min(bCount * 3, 30), 100) : 0,
        rating: avgRating
      };
    });
    
    // Servicios más vendidos
    const serviceCounts = {};
    finished.forEach((appointment) => {
      const normalizedServiceName = normalizeFavoriteServiceName(appointment.service) || 'Servicio sin nombre';
      serviceCounts[normalizedServiceName] = (serviceCounts[normalizedServiceName] || 0) + 1;
    });
    const topServiceNameVal = Object.keys(serviceCounts).length > 0 ? Object.keys(serviceCounts).reduce((a, b) => serviceCounts[a] > serviceCounts[b] ? a : b, null) : 'Sin datos';
    const topServiceCountVal = serviceCounts[topServiceNameVal] || 0;

    // Clientes nuevos
    const startOfMonth = new Date(reportTodayDate.getFullYear(), reportTodayDate.getMonth(), 1);
    const clientsWithVisitsInScope = new Set(finished.map((appointment) => String(appointment.clientId || '')));
    const newClientsThisMonthVal = (clients || []).filter((client) => (
      clientsWithVisitsInScope.has(String(client.id)) && new Date(client.createdAt) >= startOfMonth
    )).length;

    const getHistoricalRealData = () => {
      const today = reportTodayDate;
      
      if (salesPeriod === 'week') {
        const daysLabels = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
        const currentDayIdx = today.getDay();
        const diffToMonday = currentDayIdx === 0 ? -6 : 1 - currentDayIdx;
        const monday = new Date(today);
        monday.setDate(today.getDate() + diffToMonday);
        
        const result = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const dateStr = formatLocalDateYmd(d);
          const totalDay = finished
            .filter(a => standardizeDate(a.date) === dateStr)
            .reduce((sum, a) => sum + (Number(a.price) || 0), 0);
          result.push({ label: daysLabels[i], value: totalDay });
        }
        return result;
      }

      if (salesPeriod === 'month') {
        const result = [{ label: 'Sem 1', value: 0 }, { label: 'Sem 2', value: 0 }, { label: 'Sem 3', value: 0 }, { label: 'Sem 4', value: 0 }];
        finished.forEach(a => {
          const aptDate = parseLocalDate(a.date);
          if (!aptDate) return;
          if (aptDate.getMonth() === today.getMonth() && aptDate.getFullYear() === today.getFullYear()) {
            const day = aptDate.getDate();
            const weekIdx = Math.min(Math.floor((day - 1) / 7), 3);
            result[weekIdx].value += (Number(a.price) || 0);
          }
        });
        return result;
      }

      if (salesPeriod === 'year') {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const result = months.map(m => ({ label: m, value: 0 }));
        finished.forEach(a => {
          const aptDate = parseLocalDate(a.date);
          if (!aptDate) return;
          if (aptDate.getFullYear() === today.getFullYear()) {
            result[aptDate.getMonth()].value += (Number(a.price) || 0);
          }
        });
        return result;
      }
      return [];
    };

    return { 
      bestStylist: bestStylistObj, 
      bestStylistCount: bestStylistObj?.count ?? 0, 
      bestStylistSales: bestStylistObj?.sales ?? 0, 
      topServiceName: topServiceNameVal || 'Sin datos', 
      topServiceCount: topServiceCountVal, 
      newClientsThisMonth: newClientsThisMonthVal, 
      globalAvgTicket: finished.length > 0 ? finishedRevenueTotal / finished.length : 0, 
      staffMetrics, 
      historicalSales: getHistoricalRealData(), 
      hasData 
    };
  }, [stylists, clients, finished, finishedRevenueTotal, monthlyGlobalFinished, reportTodayDate, salesPeriod, scopedStylists]);

  const monthlyStaffMetrics = useMemo(() => {
    return scopedStylists.map((b) => {
      const bFinished = monthlyFinished.filter(a => String(a.stylistId) === String(b.id));
      const bCount = bFinished.length;
      const bSales = bFinished.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
      return {
        ...b,
        count: bCount,
        sales: bSales,
      };
    });
  }, [scopedStylists, monthlyFinished]);

  const maxMonthlyApts = Math.max(...monthlyStaffMetrics.map(m => m.count), 1);
  const maxMonthlySales = Math.max(...monthlyStaffMetrics.map(m => m.sales), 1);

  const downloadMonthlyServicesReport = () => {
    if (!monthlyFinished.length) return;

    const normalizeExcelText = (value) => `${value ?? ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const escapeCsv = (value) => `"${normalizeExcelText(value).replace(/"/g, '""')}"`;
    const rows = monthlyFinished
      .slice()
      .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date))
      .map((apt) => {
        const stylist = stylistsById[String(apt.stylistId)];
        const client = clientsById[String(apt.clientId)];
        const serviceDate = parseLocalDate(apt.date);
        return [
          stylist?.fullName || stylist?.name || `Estilista ${apt.stylistId}`,
          client?.name || apt.clientName || 'Cliente genérico',
          Number(apt.price || 0),
          serviceDate ? serviceDate.toLocaleDateString('es-ES') : standardizeDate(apt.date),
        ].map(escapeCsv).join(',');
      });

    const csv = `\uFEFFsep=,\r\n${['Estilista', 'Cliente', 'Costo del servicio', 'Fecha de servicio'].map(escapeCsv).join(',')}\r\n${rows.join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-servicios-${effectiveStaffRange.start}-${effectiveStaffRange.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const downloadProductSalesReport = () => {
    if (!productSalesSummary.length) return;

    const normalizeExcelText = (value) => `${value ?? ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const escapeCsv = (value) => `"${normalizeExcelText(value).replace(/"/g, '""')}"`;
    const rows = productSalesSummary.map((product) => [
      product.name,
      product.units,
      product.ticketsCount,
      product.revenue,
    ].map(escapeCsv).join(','));

    const totalsRow = [
      'TOTAL',
      totalProductUnits,
      productReportPosSales.length,
      productReportRevenue,
    ].map(escapeCsv).join(',');

    const csv = `\uFEFFsep=,\r\n${[
      ['Reporte', 'Ventas de productos'],
      ['Rango', productRangeLabel],
      ['Tickets POS', productReportPosSales.length],
      ['Unidades vendidas', totalProductUnits],
      ['Ingreso total', productReportRevenue],
      [],
      ['Producto', 'Unidades', 'Tickets', 'Ingreso'],
    ].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}\r\n${rows.join('\r\n')}\r\n${totalsRow}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-productos-${effectiveProductRange.start}-${effectiveProductRange.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const historicalMax = useMemo(() => {
    const vals = stats.historicalSales.map(d => d.value);
    const max = Math.max(...vals);
    return max === 0 ? 1000 : max;
  }, [stats.historicalSales]);

  return (
    <div className="reports-view px-3 py-4 md:p-6 space-y-5 md:space-y-7 h-full animate-in fade-in pb-24 md:pb-28 text-white no-print">
      <div className="rounded-[1.6rem] border border-rose-200/80 bg-white/85 px-4 py-3 md:px-5 md:py-4 shadow-[0_14px_34px_rgba(120,78,93,0.08)] backdrop-blur-sm flex flex-col xl:flex-row xl:justify-between xl:items-center gap-3 text-white">
        <div>
          <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter leading-none text-white">Análisis del Negocio</h3>
          <p className="text-[9px] md:text-[10px] text-indigo-400 font-black uppercase mt-2 italic tracking-[0.14em] md:tracking-[0.18em] leading-none">Métricas avanzadas y rendimiento comercial real</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {(branches || []).length > 0 && (
            <div className="w-full sm:min-w-[220px] sm:w-auto">
              <select
                value={effectiveReportBranchId}
                onChange={(e) => setSelectedReportBranchId(e.target.value)}
                className="w-full bg-white border border-rose-200 rounded-2xl px-4 py-3 text-xs md:text-sm font-bold text-white outline-none focus:border-indigo-500 italic shadow-sm"
              >
                <option value="all">Todo el salón</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="bg-white border border-rose-200 px-4 py-3 rounded-2xl flex items-center gap-3 text-white shadow-sm"><CalendarIcon size={18} className="text-slate-500" /><span className="text-[10px] md:text-xs font-black uppercase italic text-white">{reportTodayDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span></div>
        </div>
      </div>
      {unresolvedLegacyPosSalesCount > 0 && (
        <div className="rounded-[1.6rem] border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-amber-100 shadow-[0_10px_30px_rgba(245,158,11,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300 leading-none">Advertencia POS</p>
          <p className="mt-2 text-sm font-bold leading-relaxed">
            Hay {unresolvedLegacyPosSalesCount} venta{unresolvedLegacyPosSalesCount === 1 ? '' : 's'} POS antigua{unresolvedLegacyPosSalesCount === 1 ? '' : 's'} sin sucursal asignada.
            No se pueden atribuir con seguridad a la sucursal seleccionada hasta normalizar su `branch_id`.
          </p>
        </div>
      )}
      
      <div className="flex w-full md:w-fit items-center gap-2 p-1.5 bg-white/90 border border-rose-200 rounded-[1.4rem] md:rounded-[1.7rem] md:w-fit mx-auto shadow-[0_12px_32px_rgba(120,78,93,0.1)] text-white">
        <button onClick={() => setReportTab('ventas')} className={`flex flex-1 md:flex-none items-center justify-center gap-2 px-4 md:px-7 py-3 rounded-[1.15rem] md:rounded-[1.35rem] text-[9px] md:text-[11px] font-black uppercase italic tracking-[0.12em] md:tracking-widest transition-all ${reportTab === 'ventas' ? 'bg-indigo-600 text-white shadow-[0_10px_20px_rgba(201,111,141,0.22)]' : 'text-slate-500 hover:text-indigo-400'}`}><TrendingUp size={14} className="md:size-4" /> Ventas</button>
        <button onClick={() => setReportTab('personal')} className={`flex flex-1 md:flex-none items-center justify-center gap-2 px-4 md:px-7 py-3 rounded-[1.15rem] md:rounded-[1.35rem] text-[9px] md:text-[11px] font-black uppercase italic tracking-[0.12em] md:tracking-widest transition-all ${reportTab === 'personal' ? 'bg-indigo-600 text-white shadow-[0_10px_20px_rgba(201,111,141,0.22)]' : 'text-slate-500 hover:text-indigo-400'}`}><Users size={14} className="md:size-4" /> Personal</button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-white">
        {reportTab === 'ventas' ? (
          <section className="space-y-10 text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-8 text-white">
              <div className="bg-slate-900 neon-border-indigo p-5 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                    <p className="text-[11px] font-black text-slate-500 uppercase italic tracking-widest leading-none">Ingresos Totales (Servicio)</p>
                    <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400"><ArrowUpRight size={16} /></div>
                  </div>
                  <h4 className="text-5xl font-black text-indigo-400 italic tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(201,111,141,0.28)]">C$ {(Number(total) || 0).toLocaleString()}</h4>
                  <div className="mt-8 flex items-center gap-2 text-white">
                    <div className="h-1 flex-1 bg-black rounded-full overflow-hidden text-white"><div className="h-full bg-indigo-600 w-full" /></div>
                    <span className="text-[10px] font-black text-indigo-400 leading-none">{salesRangeLabel}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 neon-border-emerald p-5 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                    <p className="text-[11px] font-black text-slate-500 uppercase italic tracking-widest leading-none">Ventas de Productos</p>
                    <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-400"><Package size={16} /></div>
                  </div>
                  <h4 className="text-5xl font-black text-emerald-400 italic tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">C$ {(Number(totalProductRevenue) || 0).toLocaleString()}</h4>
                  <div className="mt-8 flex items-center gap-2 text-white">
                    <div className="h-1 flex-1 bg-black rounded-full overflow-hidden text-white"><div className="h-full bg-emerald-500 w-full" /></div>
                    <span className="text-[10px] font-black text-emerald-400 leading-none">{salesRangeLabel}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <Target className="absolute -right-6 -bottom-6 w-40 h-40 text-slate-800/10 -rotate-12" />
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Servicio más Vendido</p>
                    <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-400"><Sparkles size={16} /></div>
                  </div>
                  <h4 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-tight truncate drop-shadow-lg">{stats.topServiceName}</h4>
                  <p className="text-emerald-400 font-black text-xl mt-4 italic flex items-center gap-2 leading-none">{stats.topServiceCount} Servicios Reales <TrendingUp size={16}/></p>
                </div>
              </div>

              <div className="bg-slate-900 neon-border-emerald p-5 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Ingreso Total del Negocio</p>
                    <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-400"><UserPlus size={16} /></div>
                  </div>
                  <h4 className="text-6xl font-black text-emerald-400 italic tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">C$ {totalCombinedRevenue.toLocaleString()}</h4>
                  <p className="text-[10px] text-slate-500 font-black mt-4 uppercase italic leading-none">Servicios + productos • {salesRangeLabel}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 md:p-10 rounded-[2rem] md:rounded-[3.5rem] shadow-2xl relative text-white flex flex-col min-h-[420px] md:min-h-[550px]">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 mb-6 md:mb-12 text-white">
                <div>
                  <h5 className="text-lg md:text-2xl font-black italic uppercase text-white flex items-center gap-3"><BarChart3 className="text-indigo-500" /> Rendimiento de Ingresos</h5>
                  <p className="text-[9px] md:text-[10px] text-slate-500 font-black uppercase italic mt-1 tracking-[0.14em] md:tracking-widest leading-none">Histórico real de la semana en curso (Lunes - Domingo)</p>
                </div>
                <div className="flex w-full md:w-auto items-center gap-2 p-1.5 bg-black border border-slate-800 rounded-2xl text-white">
                  {periodOptions.map(period => (
                    <button key={period.id} onClick={() => setSalesPeriod(period.id)} className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase italic tracking-[0.12em] md:tracking-widest transition-all ${salesPeriod === period.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{period.label}</button>
                  ))}
                </div>
              </div>

              <div className="relative h-[270px] sm:h-[300px] md:h-[320px] w-full overflow-hidden pb-1 md:pb-2">
                <div
                  className="relative h-full min-w-0 w-full flex items-end justify-between gap-1 sm:gap-2 md:gap-6 px-1.5 sm:px-2 md:px-4 text-white"
                >
                  <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none flex flex-col justify-between opacity-5 z-0">
                    {[...Array(6)].map((_, i) => <div key={i} className="w-full h-px bg-white"></div>)}
                  </div>
                  {stats.historicalSales.map((data, idx) => {
                    const hVal = (data.value / historicalMax) * 100;
                    const gradient = barGradients[idx % barGradients.length];
                    return (
                      <div key={idx} className="min-w-0 basis-0 flex-1 flex flex-col items-center relative z-10 h-full group text-white">
                        <div className="flex-1 w-full flex flex-col justify-end items-center text-white">
                          <div className="flex flex-col items-center mb-2 md:mb-3 transition-transform duration-300 group-hover:scale-125 text-white">
                            <span className="text-[9px] sm:text-[10px] md:text-[13px] font-black text-white italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none whitespace-nowrap">
                              C$ {data.value >= 1000 ? (data.value / 1000).toFixed(1) + 'k' : data.value}
                            </span>
                          </div>
                          <div className={`w-full max-w-[26px] sm:max-w-[34px] md:max-w-[60px] rounded-t-3xl transition-all duration-1000 ease-out relative bg-gradient-to-t ${gradient} shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-t border-white/20`} style={{ height: `${Math.max(hVal, 5)}%` }}>
                            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-3xl text-white"></div>
                            <div className={`absolute inset-0 opacity-0 transition-opacity rounded-t-3xl blur-xl bg-gradient-to-t ${gradient} group-hover:opacity-40 text-white`} />
                          </div>
                        </div>
                        <div className="h-8 md:h-10 flex items-center text-white">
                          <p className="text-[9px] md:text-[11px] font-black uppercase text-white italic tracking-[0.08em] sm:tracking-[0.12em] md:tracking-[0.2em] opacity-70 group-hover:opacity-100 transition-all leading-none">{data.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="text-white">
              <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                <div className="px-8 py-7 border-b border-slate-800 bg-black/50 flex flex-col gap-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <h5 className="text-xl font-black italic uppercase text-white flex items-center gap-3"><Package className="text-emerald-400" size={20} /> Reporte de Ventas de Productos</h5>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2 italic leading-none">{productRangeLabel}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 lg:items-start">
                      <div className="min-h-[52px] min-w-[220px] px-4 py-3 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex flex-col justify-center text-left">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300/80 leading-none">
                          {productRangePreset === 'custom' ? 'Rango personalizado' : `Vista ${periodOptions.find((option) => option.id === productRangePreset)?.label || 'Mes'}`}
                        </span>
                        <span className="mt-2 text-[11px] font-black text-white leading-tight break-words">{productRangeLabel}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowProductRangeControls((prev) => !prev)}
                          className={`min-h-[52px] px-5 rounded-2xl border text-[10px] font-black uppercase tracking-[0.18em] transition-all flex items-center justify-center gap-2 ${
                            showProductRangeControls
                              ? 'bg-white/10 text-white border-white/15'
                              : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:text-white'
                          }`}
                        >
                          <Filter size={14} />
                          {showProductRangeControls ? 'Ocultar filtros' : 'Filtros'}
                        </button>
                        <button
                          onClick={downloadProductSalesReport}
                          disabled={!productSalesSummary.length}
                          className="min-h-[52px] px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-[10px] font-black uppercase italic tracking-widest leading-none transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2"
                        >
                          <Save size={14} /> Exportar Excel
                        </button>
                      </div>
                    </div>
                  </div>

                  {showProductRangeControls && (
                    <div className="rounded-[1.8rem] border border-white/5 bg-slate-950/60 p-3 space-y-3 animate-in fade-in duration-200">
                      <div className="grid grid-cols-3 gap-2">
                        {periodOptions.map((period) => (
                          <button
                            key={period.id}
                            type="button"
                            onClick={() => setProductRangePreset(period.id)}
                            className={`min-h-[44px] rounded-2xl border text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                              productRangePreset === period.id
                                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg'
                                : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            {period.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={productRangeInputStart}
                          onChange={(e) => {
                            setProductRangePreset('custom');
                            setProductRangeStart(e.target.value);
                          }}
                          className="min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950/70 px-4 text-sm font-bold text-white outline-none focus:border-emerald-500"
                        />
                        <input
                          type="date"
                          value={productRangeInputEnd}
                          onChange={(e) => {
                            setProductRangePreset('custom');
                            setProductRangeEnd(e.target.value);
                          }}
                          className="min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950/70 px-4 text-sm font-bold text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {productSalesSummary.length > 0 ? (
                  <div className="p-8 grid grid-cols-1 xl:grid-cols-[minmax(360px,40%)_1fr] gap-10 items-start">
                    <div className="space-y-6 flex justify-center xl:justify-center">
                      <div className="relative mx-auto aspect-square w-full max-w-[460px] flex items-center justify-center">
                        {productPieLabels.map((label) => (
                          <div
                            key={label.id}
                            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 min-w-[84px] px-4 py-2 rounded-full border text-center text-sm font-black italic text-white whitespace-nowrap"
                            style={{
                              left: label.left,
                              top: label.top,
                              backgroundColor: label.color,
                              borderColor: `${label.color}cc`,
                              boxShadow: '0 0 0 3px #0f172a, 0 10px 24px rgba(2,6,23,0.32)',
                            }}
                          >
                            {label.percentageLabel}
                          </div>
                        ))}

                        <div
                          className="aspect-square w-full rounded-full overflow-hidden flex items-center justify-center border border-white/5"
                          style={{
                            background: productPieBackground,
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 22px 48px rgba(2,6,23,0.42)',
                          }}
                        >
                          <div className="aspect-square w-[50%] rounded-full bg-slate-950 border border-white/5 flex flex-col items-center justify-center text-center px-5">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Ventas Totales</span>
                            <span className="mt-3 text-4xl font-black italic text-emerald-400 leading-none">C$ {productReportRevenue.toLocaleString()}</span>
                            <span className="mt-3 text-[11px] font-black uppercase italic text-slate-400 leading-none">{totalProductUnits} unidades</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full max-w-[720px] ml-auto space-y-3.5 min-h-[320px]">
                      {productChartSegments.map((product, index) => (
                        <div key={product.id} className="rounded-[1.9rem] border border-white/5 bg-black/35 px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="mt-1 block w-4 h-4 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.12)]" style={{ backgroundColor: product.color }} />
                              <div>
                                <p className="text-[13px] font-black uppercase italic tracking-tight text-white leading-none">{product.name}</p>
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                  <span className="px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-[8px] font-black uppercase italic text-slate-300 leading-none">{product.units} unidades</span>
                                  <span className="px-2.5 py-1 rounded-full border border-indigo-400/20 bg-indigo-500/10 text-[8px] font-black uppercase italic text-indigo-300 leading-none">{product.ticketsCount} tickets</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 leading-none">{product.percentage.toFixed(1)}%</p>
                              <p className="mt-2 text-[28px] font-black italic text-emerald-400 leading-none">C$ {product.revenue.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-slate-950 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(product.percentage, 4)}%`, backgroundColor: product.color }} />
                          </div>
                          <p className="mt-2.5 text-[8px] font-black uppercase tracking-[0.16em] text-slate-600 leading-none">Producto #{index + 1}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-8 py-16 text-center">
                    <Package size={34} className="mx-auto text-slate-700 mb-4" />
                    <p className="text-sm font-black uppercase italic text-slate-400">No hay ventas de productos en este rango</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mt-3">Prueba con otra sucursal o cambia el periodo</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-12 text-white">
            <div className="flex items-center gap-4 text-white"><div className="h-px flex-1 bg-gradient-to-r from-indigo-500/50 to-transparent"></div><h4 className="text-xl font-black italic uppercase text-indigo-400 tracking-tighter">Eficiencia del equipo</h4><div className="h-px flex-1 bg-gradient-to-l from-indigo-500/50 to-transparent"></div></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-white">
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic leading-none">Ticket Promedio Equipo</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-indigo-400 leading-none">C$ {stats.globalAvgTicket.toFixed(0)}</h5><div className="p-2 bg-indigo-600/10 rounded-lg text-indigo-500"><TrendingUp size={16}/></div></div></div>
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic leading-none">Nivel Satisfacción</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-amber-500 leading-none">4.8 / 5.0</h5><div className="p-2 bg-amber-600/10 rounded-lg text-amber-500"><Star size={16} fill="currentColor"/></div></div></div>
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic leading-none">Tasa de Retención</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-emerald-400 leading-none">82%</h5><div className="p-2 bg-emerald-600/10 rounded-lg text-emerald-400"><UserCheck size={16}/></div></div></div>
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase italic leading-none">Servicios Finalizados</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-rose-400 leading-none">{finished.length}</h5><div className="p-2 bg-rose-600/10 rounded-lg text-rose-400"><Scissors size={16}/></div></div></div>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 text-white">
              <div className="bg-white border-2 border-[#ee9fbc] p-10 rounded-[3.5rem] flex flex-col items-center text-center shadow-[0_22px_54px_rgba(122,77,94,0.12)] relative overflow-hidden group min-h-[570px] justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,79,131,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(111,174,147,0.18),transparent_34%)] pointer-events-none z-0"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.10] pointer-events-none z-0 animate-spin-very-slow"><Crown size={500} className="text-[#6fae93]" strokeWidth={0.6} /></div>
                <Scissors className="absolute top-20 right-10 text-[#6fae93] -rotate-12 animate-float" size={50} />
                <Star className="absolute top-1/4 right-[30%] text-[#d94f83] rotate-12 animate-float" size={44} />
                <Sparkles className="absolute bottom-20 left-10 text-[#d94f83]/70 animate-float" size={70} />
                <Award className="absolute bottom-1/4 right-10 text-[#6fae93]/70 -rotate-15 animate-float" size={75} />
                <div className="relative z-10 flex flex-col items-center w-full">
                  <Crown size={72} className="text-[#6fae93] drop-shadow-[0_10px_18px_rgba(79,134,116,0.35)] animate-bounce mb-6" />
                  <div className="transition-transform duration-700 relative group-hover:scale-110">
                    <div className="absolute inset-0 bg-[#d94f83] blur-3xl opacity-18 animate-pulse"></div>
                    <div className="w-40 h-40 bg-gradient-to-br from-[#f27dad] to-[#d94f83] rounded-[3.5rem] flex items-center justify-center text-white font-black text-6xl italic shadow-[0_18px_42px_rgba(217,79,131,0.32)] border-4 border-white relative z-10 overflow-hidden">
                      <span className="relative z-10 drop-shadow-lg">{stats.bestStylist?.avatar || '?'}</span>
                    </div>
                  </div>
                  <div className="mt-12 w-full">
                    <p className="text-[12px] font-black text-[#d94f83] uppercase italic tracking-[0.32em] mb-2 leading-none">Destacada del salón</p>
                    <h4 className="text-5xl font-black italic uppercase text-[#302530] tracking-tighter leading-none">{stats.bestStylist?.name || '---'}</h4>
                  </div>
                  <div className="mt-16 pt-10 border-t border-[#ee9fbc] w-full flex justify-between px-8 relative">
                    <div className="flex flex-col items-start"><p className="text-[12px] font-black text-[#856a75] uppercase mb-2 italic tracking-widest leading-none">Total servicios</p><p className="text-6xl font-black text-[#6fae93] leading-none tracking-tighter">{stats.bestStylistCount || 0}</p></div>
                    <div className="flex flex-col items-end"><p className="text-[12px] font-black text-[#856a75] uppercase mb-2 italic tracking-widest leading-none">Ventas Brutas</p><p className="text-6xl font-black text-[#d94f83] leading-none tracking-tighter"><span className="text-2xl mr-1 font-bold text-[#6fae93]">C$</span>{(stats.bestStylistSales || 0).toLocaleString()}</p></div>
                  </div>
                </div>
              </div>
              
              <div className="xl:col-span-2 bg-slate-900 border border-slate-800 p-10 rounded-[3.5rem] shadow-2xl relative text-white flex flex-col">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-start gap-8 mb-10 text-white">
                  <div className="max-w-xl">
                    <h5 className="text-xl font-black italic uppercase text-white flex items-center gap-2"><BarChart3 className="text-indigo-500" /> Comparativa de Rendimiento Real</h5>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1 italic leading-none">Citas e ingresos por estilista dentro del rango seleccionado</p>
                  </div>
                  <div className="w-full lg:w-auto flex items-start justify-end gap-3">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowStaffRangeControls((prev) => !prev)}
                        title="Filtros"
                        aria-label="Abrir filtros de rendimiento"
                        className={`h-[52px] w-[52px] rounded-2xl border transition-all flex items-center justify-center ${
                          showStaffRangeControls
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-950/40'
                            : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:text-white hover:border-slate-600'
                        }`}
                      >
                        <Filter size={18} />
                      </button>

                      {showStaffRangeControls && (
                        <div className="adaptive-popover absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(88vw,22rem)] rounded-[1.8rem] border border-[#ee9fbc] bg-white/95 p-4 shadow-[0_24px_55px_rgba(122,77,94,0.22)] backdrop-blur-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="rounded-2xl border border-[#f2c1d4] bg-[#fff7fb] px-4 py-3">
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#d94f83] leading-none">
                              {staffRangePreset === 'custom' ? 'Rango personalizado' : `Vista ${periodOptions.find((option) => option.id === staffRangePreset)?.label || 'Mes'}`}
                            </span>
                            <span className="mt-2 block text-[12px] font-black text-[#4f8674] leading-tight">
                              {staffRangeLabel}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {periodOptions.map((period) => (
                              <button
                                key={period.id}
                                type="button"
                                onClick={() => setStaffRangePreset(period.id)}
                                className={`min-h-[42px] rounded-2xl border text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                                  staffRangePreset === period.id
                                    ? 'bg-[#d94f83] text-white border-[#d94f83] shadow-[0_10px_24px_rgba(217,79,131,0.24)]'
                                    : 'bg-[#fff7fb] text-[#856a75] border-[#f2c1d4] hover:bg-[#fbe9ef] hover:text-[#302530]'
                                }`}
                              >
                                {period.label}
                              </button>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={rangeInputStart}
                              onChange={(e) => {
                                setStaffRangePreset('custom');
                                setStaffRangeStart(e.target.value);
                              }}
                              className="min-h-[46px] rounded-2xl border border-[#f2c1d4] bg-[#fff7fb] px-4 text-sm font-bold text-[#302530] outline-none focus:border-[#d94f83] focus:bg-white"
                            />
                            <input
                              type="date"
                              value={rangeInputEnd}
                              onChange={(e) => {
                                setStaffRangePreset('custom');
                                setStaffRangeEnd(e.target.value);
                              }}
                              className="min-h-[46px] rounded-2xl border border-[#f2c1d4] bg-[#fff7fb] px-4 text-sm font-bold text-[#302530] outline-none focus:border-[#d94f83] focus:bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={downloadMonthlyServicesReport}
                      disabled={monthlyFinished.length === 0}
                      className="w-full sm:w-auto min-h-[52px] lg:min-w-[190px] px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-[10px] font-black uppercase italic tracking-widest leading-none transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2"
                    >
                      <Save size={14} /> Exportar Excel
                    </button>
                  </div>
                </div>
                
                <div className="relative z-10 mt-2 flex-1 overflow-x-hidden md:overflow-x-auto custom-scrollbar pb-3 px-1 md:px-0">
                  <div
                    className="relative h-[280px] min-w-0 md:h-[300px] md:min-w-[340px]"
                    style={{ width: '100%' }}
                  >
                    {/* CUADRÍCULA ESTRUCTURADA DE FONDO */}
                    <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-between pointer-events-none border-l border-[#d8a5b9] ml-12 md:ml-14 mb-16 md:mb-20 pt-5">
                      {[100, 80, 60, 40, 20, 0].map((val) => (
                        <div key={val} className="w-full flex items-center relative">
                          <span className="absolute -left-12 md:-left-14 text-[10px] font-black text-[#9b6076] w-10 md:w-12 text-right italic leading-[1.1]">{val}%</span>
                          <div className="flex-1 h-px border-t border-dashed border-[#ead4dd]"></div>
                        </div>
                      ))}
                    </div>

                    <div className="relative flex h-full items-end justify-between gap-2 md:gap-4 pl-14 pr-6 md:pl-16 md:pr-6 pt-7 md:pt-0">
                      {monthlyStaffMetrics.map((b) => {
                        const chartHeightCap = 84;
                        const countHeight = (b.count / maxMonthlyApts) * chartHeightCap;
                        const salesHeight = (b.sales / maxMonthlySales) * chartHeightCap;
                        const stylistColorClass = b.bg || 'bg-indigo-600';

                        return (
                          <div
                            key={b.id}
                            className="flex min-w-0 flex-1 md:w-auto md:min-w-[78px] md:shrink-0 md:flex-1 flex-col items-center justify-end h-full group text-white"
                          >
                            <div className="flex items-end gap-1.5 md:gap-2.5 w-full justify-center px-1 h-full min-h-[40px] relative text-white">
                              {/* Barra de Citas */}
                              <div className="flex flex-col items-center justify-end h-full w-full max-w-[20px] md:max-w-[32px] relative text-white">
                                <span
                                  className="text-[9px] md:text-[11.5px] font-black text-white absolute whitespace-nowrap bg-indigo-600 px-2 py-1 rounded-lg border border-indigo-400 shadow-[0_5px_15px_rgba(201,111,141,0.28)] z-20 transition-all duration-1000 ease-out italic group-hover:scale-110 leading-none"
                                  style={{ bottom: `calc(${Math.max(countHeight, 4)}% + 6px)` }}
                                >
                                  {b.count}
                                </span>
                                <div className={`w-full rounded-t-2xl transition-all duration-1000 ease-out relative ${stylistColorClass} shadow-lg text-white border-t border-white/20`} style={{ height: `${Math.max(countHeight, 4)}%` }}>
                                  <div className="absolute inset-0 bg-white/5 opacity-0 transition-opacity rounded-t-2xl group-hover:opacity-100 text-white"></div>
                                </div>
                              </div>

                              {/* Barra de Ingresos */}
                              <div className="flex flex-col items-center justify-end h-full w-full max-w-[20px] md:max-w-[32px] relative text-white">
                                <div
                                  className="absolute text-center z-20 transition-all duration-1000 ease-out"
                                  style={{ bottom: `calc(${Math.max(salesHeight, 4)}% + 6px)` }}
                                >
                                  <span className="text-[9px] md:text-[11.5px] font-black text-emerald-100 italic whitespace-nowrap bg-emerald-600 px-2 py-1 rounded-lg border border-emerald-400 shadow-[0_5px_15px_rgba(16,185,129,0.5)] group-hover:scale-110 transition-transform leading-none">
                                    C$ {b.sales >= 1000 ? (b.sales / 1000).toFixed(1) + 'k' : b.sales}
                                  </span>
                                </div>
                                <div className={`w-full rounded-t-2xl transition-all duration-1000 ease-out relative ${stylistColorClass} brightness-125 shadow-lg text-white border-t border-white/30`} style={{ height: `${Math.max(salesHeight, 4)}%` }}>
                                  <div className="absolute inset-0 bg-white/10 opacity-30 rounded-t-2xl text-white"></div>
                                  <div className={`absolute -inset-1 opacity-0 transition-opacity rounded-t-2xl blur-lg ${stylistColorClass} group-hover:opacity-20 text-white`} />
                                </div>
                              </div>
                            </div>

                            <div className="mt-6 md:mt-8 flex flex-col items-center gap-1.5 md:gap-2 text-white">
                              <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${b.bg} flex items-center justify-center text-[10px] font-black italic shadow-lg border-2 border-slate-900 transition-transform group-hover:scale-110 text-white`}>
                                {b.avatar}
                              </div>
                              <p className="text-[9px] md:text-[11px] font-black uppercase text-slate-200 italic tracking-[0.08em] leading-none truncate w-16 md:w-20 text-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
                                {b.name.split(' ')[0]}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-6 md:mt-12 pt-5 md:pt-6 border-t border-white/5 flex flex-wrap items-center justify-center gap-4 md:gap-8 text-white">
                   <div className="flex items-center gap-2 text-white">
                     <div className="w-3 h-3 bg-indigo-600 rounded-sm"></div>
                     <span className="text-[10px] font-black text-slate-500 uppercase italic leading-none">Citas del rango</span>
                   </div>
                   <div className="flex items-center gap-2 text-white">
                     <div className="w-3 h-3 bg-emerald-600 rounded-sm"></div>
                     <span className="text-[10px] font-black text-slate-500 uppercase italic leading-none">Ingresos del rango</span>
                   </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6 text-white mt-12">
                <div className="flex items-center gap-4 text-white"><h4 className="text-xl font-black italic uppercase text-white tracking-tighter leading-none">Rendimiento Detallado por Estilista</h4><div className="h-px flex-1 bg-slate-900"></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-white">
                  {stats.staffMetrics.map(b => (
                    <div key={b.id} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] transition-all group relative overflow-hidden hover:border-indigo-500/50 text-white">
                       <div className="flex items-center gap-4 mb-8 text-white">
                         <div className={`w-14 h-14 rounded-2xl ${b.bg} flex items-center justify-center text-white font-black italic text-xl shadow-xl transition-transform text-white`}>{b.avatar}</div>
                         <div className="text-white">
                           <h5 className="text-lg font-black uppercase italic text-white leading-none">{b.name}</h5>
                           <div className="flex items-center gap-1 mt-2 text-amber-500"><Star size={12} fill="currentColor"/><span className="text-[11px] font-black italic leading-none">{b.rating} / 5.0</span></div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4 text-white">
                         <div className="bg-black p-4 rounded-2xl border border-slate-800 text-white"><p className="text-[9px] font-black text-slate-500 uppercase italic leading-none">Ticket Promedio</p><p className="text-base font-black text-white italic leading-none mt-2">C$ {Math.round(b.avgTicket)}</p></div>
                         <div className="bg-black p-4 rounded-2xl border border-slate-800 text-white"><p className="text-[9px] font-black text-slate-500 uppercase italic leading-none">Retención</p><p className="text-base font-black text-emerald-400 italic leading-none mt-2">{b.retention}%</p></div>
                       </div>
                    </div>
                  ))}
                </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const periodOptions = [{ id: 'week', label: 'Semana' }, { id: 'month', label: 'Mes' }, { id: 'year', label: 'Año' }];

function ClientModal({ onClose, onSave, clients, initial }) {
  const [formData, setFormData] = useState({ name: initial?.name || '', phone: formatPhoneNumber(initial?.phone || ''), notes: initial?.notes || '' });
  const [errorMsg, setErrorMsg] = useState(null);
  const handleSubmit = (e) => { 
    e.preventDefault(); 
    setErrorMsg(null); 
    const formattedPhone = formatPhoneNumber(formData.phone);
    if (!isValidPhoneNumber(formattedPhone)) { setErrorMsg('El celular debe tener exactamente 8 dígitos.'); return; }
    const duplicate = findClientByPhone(clients, formattedPhone, initial?.id);
    if (duplicate) { setErrorMsg(`Este número ya pertenece a: ${duplicate.name}`); return; } 
    onSave({ ...formData, phone: formattedPhone }); 
  };
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-slate-950 w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl border border-slate-800 animate-in zoom-in-95 text-white">
        <div className="px-10 py-12 bg-gradient-to-br from-indigo-600/30 border-b border-slate-800 flex justify-between items-center text-white">
          <div className="flex items-center gap-5 text-white"><div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white"><UserPlus size={32}/></div><div><h3 className="text-3xl font-black uppercase italic text-white leading-none">{initial ? 'Editar Ficha' : 'Nuevo Cliente'}</h3></div></div>
          <button onClick={onClose} className="p-3 bg-black rounded-2xl text-slate-500 text-white"><X size={24}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-10 space-y-8 text-white">
          {errorMsg && <div className="bg-rose-500/10 border border-rose-500/30 p-5 rounded-2xl text-rose-400 text-[10px] font-black uppercase italic leading-none">{errorMsg}</div>}
          <div className="space-y-3 text-white"><label className="text-[11px] font-black text-slate-500 uppercase italic leading-none">Nombre Completo</label><input required placeholder="Ej. Juan Pérez" className="w-full bg-black border border-slate-800 rounded-3xl px-8 py-5 text-sm font-bold text-white outline-none focus:border-indigo-600 italic leading-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
          <div className="space-y-3 text-white"><label className="text-[11px] font-black text-slate-500 uppercase italic leading-none">Celular</label><input required type="tel" placeholder="0000-0000" className="w-full bg-black border border-slate-800 rounded-3xl px-8 py-5 text-sm font-bold text-white outline-none focus:border-indigo-600 italic leading-none" value={formData.phone} onChange={e => { setErrorMsg(null); setFormData({...formData, phone: formatPhoneNumber(e.target.value)}); }} /></div>
          <div className="space-y-3 text-white"><label className="text-[11px] font-black text-slate-500 uppercase italic leading-none">Notas Técnicas</label><textarea placeholder="Ej. Piel sensible..." className="w-full bg-black border border-slate-800 rounded-3xl px-8 py-5 text-sm font-bold text-white min-h-[140px] outline-none focus:border-indigo-600 italic leading-relaxed" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
          <button type="submit" className="w-full bg-indigo-600 py-6 rounded-[2rem] font-black uppercase italic text-xs text-white leading-none">GUARDAR EN BASE DE DATOS</button>
        </form>
      </div>
    </div>
  );
}

function TransferAppointmentModal({ appointment, appointments, clients, stylists, onClose, onSave }) {
  const [targetStylistId, setTargetStylistId] = useState('');

  const client = clients.find((item) => String(item.id) === String(appointment?.clientId));
  const currentStylist = stylists.find((item) => String(item.id) === String(appointment?.stylistId));
  const availableTargets = useMemo(
    () => (stylists || []).filter((stylist) => String(stylist.id) !== String(appointment?.stylistId)),
    [stylists, appointment?.stylistId],
  );
  const effectiveTargetStylistId = targetStylistId || availableTargets[0]?.id || '';
  const selectedTarget = availableTargets.find((stylist) => String(stylist.id) === String(effectiveTargetStylistId));
  const hasConflict = selectedTarget
    ? hasAppointmentStylistConflict({ appointments, appointment, targetStylistId: selectedTarget.id })
    : false;

  if (!appointment) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!selectedTarget || hasConflict) return;
    onSave(appointment.id, selectedTarget.id);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in text-white no-print">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-950 shadow-2xl animate-in zoom-in-95 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-black px-5 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Repeat size={21} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Trasladar cita</h3>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {client?.name || appointment.clientName || 'Cliente genérico'} · {formatTime12h(appointment.time)} · {normalizeFavoriteServiceName(appointment.service) || 'Servicio'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 p-2.5 text-slate-400 transition-colors hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-[1.5rem] border border-white/5 bg-black/35 p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Estilista actual</p>
            <div className="mt-3 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${currentStylist?.bg || 'bg-slate-800'} text-xs font-black italic text-white`}>
                {currentStylist?.avatar || '?'}
              </div>
              <p className="font-black uppercase italic text-white">{currentStylist?.name || 'Sin asignar'}</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">Mover hacia</p>
            {availableTargets.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-black/40 p-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                No hay otro estilista disponible para trasladar.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableTargets.map((stylist) => {
                  const blocked = hasAppointmentStylistConflict({ appointments, appointment, targetStylistId: stylist.id });
                  const selected = String(effectiveTargetStylistId) === String(stylist.id);
                  return (
                    <button
                      key={stylist.id}
                      type="button"
                      onClick={() => setTargetStylistId(stylist.id)}
                      className={`flex items-center gap-3 rounded-[1.3rem] border p-3 text-left transition-all ${
                        selected
                          ? 'border-indigo-400 bg-indigo-600/15 shadow-[0_0_24px_rgba(201,111,141,0.18)]'
                          : 'border-slate-800 bg-black hover:border-slate-600'
                      }`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stylist.bg} text-xs font-black italic text-white`}>
                        {stylist.avatar}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black uppercase italic text-white">{stylist.name}</p>
                        <p className={`mt-1 text-[9px] font-black uppercase tracking-[0.18em] ${blocked ? 'text-rose-300' : 'text-emerald-300'}`}>
                          {blocked ? 'Ocupado en ese horario' : 'Disponible'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {hasConflict && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-[10px] font-black uppercase italic leading-relaxed text-rose-200">
              El estilista seleccionado ya tiene una cita que se cruza con este horario.
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 border-t border-slate-800 bg-black/40 p-5">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:text-white">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!selectedTarget || hasConflict}
            className="flex-1 rounded-2xl bg-indigo-600 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirmar traslado
          </button>
        </div>
      </form>
    </div>
  );
}

function RescheduleAppointmentModal({ appointment, appointments, clients, stylists, businessHours = HOURS, onClose, onSave }) {
  const [targetDate, setTargetDate] = useState(appointment?.date || getTodayString());
  const [targetTime, setTargetTime] = useState(appointment?.time || businessHours[0] || DEFAULT_SALON_OPEN_TIME);

  const client = clients.find((item) => String(item.id) === String(appointment?.clientId));
  const stylist = stylists.find((item) => String(item.id) === String(appointment?.stylistId));
  const normalizedTargetDate = standardizeDate(targetDate);
  const today = getTodayString();
  const isSameDate = normalizedTargetDate === standardizeDate(appointment?.date);
  const isSameTime = targetTime === appointment?.time;
  const hasConflict = hasAppointmentStylistConflict({
    appointments,
    appointment,
    targetStylistId: appointment?.stylistId,
    targetDate,
    targetTime,
  });

  const freeSlots = businessHours.filter((time) => {
    if (isSameDate && time === appointment?.time) return true;
    return !hasAppointmentStylistConflict({
      appointments,
      appointment,
      targetStylistId: appointment?.stylistId,
      targetDate,
      targetTime: time,
    });
  });

  if (!appointment) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!targetDate || !targetTime || hasConflict || (isSameDate && isSameTime)) return;
    onSave(appointment.id, targetDate, targetTime);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in text-white no-print">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-950 shadow-2xl animate-in zoom-in-95 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-black px-5 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <CalendarCheck size={21} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black uppercase italic tracking-tight text-white">Mover turno</h3>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {client?.name || appointment.clientName || 'Cliente genérico'} · {stylist?.name || 'Sin estilista'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 p-2.5 text-slate-400 transition-colors hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">Fecha</span>
            <input
              type="date"
              min={today}
              value={targetDate}
              onChange={(event) => {
                const nextDate = event.target.value;
                setTargetDate(nextDate);
                const firstFree = businessHours.find((time) => !hasAppointmentStylistConflict({
                  appointments,
                  appointment,
                  targetStylistId: appointment.stylistId,
                  targetDate: nextDate,
                  targetTime: time,
                }));
                setTargetTime(firstFree || appointment.time || businessHours[0] || DEFAULT_SALON_OPEN_TIME);
              }}
              className="w-full rounded-2xl border border-slate-800 bg-black px-5 py-4 text-sm font-black italic text-white outline-none focus:border-indigo-500"
            />
          </label>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase italic tracking-[0.2em] text-slate-500">Horarios libres</p>
            {freeSlots.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {freeSlots.map((time) => {
                  const selected = targetTime === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setTargetTime(time)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-black italic transition-all ${
                        selected
                          ? 'border-indigo-400 bg-indigo-600 text-white'
                          : 'border-slate-800 bg-black text-slate-300 hover:border-indigo-500/40'
                      }`}
                    >
                      {formatTime12h(time)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-black/40 p-5 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                No hay horarios libres para ese día.
              </div>
            )}
          </div>

          {hasConflict && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-[10px] font-black uppercase italic leading-relaxed text-rose-200">
              Ese horario ya está ocupado para este estilista.
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 border-t border-slate-800 bg-black/40 p-5">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:text-white">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!targetDate || !targetTime || hasConflict || (isSameDate && isSameTime)}
            className="flex-1 rounded-2xl bg-indigo-600 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar nuevo horario
          </button>
        </div>
      </form>
    </div>
  );
}

function AppointmentActionsModal({ appointment, clients, stylists, onClose, onUpdate, onMove, onTransfer, onCancel, onMarkLost }) {
  if (!appointment) return null;

  const client = clients.find((item) => String(item.id) === String(appointment.clientId));
  const stylist = stylists.find((item) => String(item.id) === String(appointment.stylistId));
  const hasArrived = !!appointment.checkInAt;
  const isClosed = appointment.status === 'Finalizada' || appointment.status === 'Cita Perdida' || appointment.status === 'Cancelada';
  const canMarkLost = appointment.type === 'reserva' && appointment.status === 'Confirmada';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in text-white no-print">
      <div className="w-full max-w-xl rounded-[2rem] border border-slate-800 bg-slate-950 shadow-2xl animate-in zoom-in-95 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-black px-5 py-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stylist?.bg || 'bg-slate-800'} text-sm font-black italic text-white`}>
              {stylist?.avatar || '?'}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xl font-black uppercase italic tracking-tight text-white">{client?.name || appointment.clientName || 'Cliente genérico'}</h3>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {formatTime12h(appointment.time)} · {normalizeFavoriteServiceName(appointment.service) || 'Servicio'} · {stylist?.name || 'Sin estilista'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 p-2.5 text-slate-400 transition-colors hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <button
            type="button"
            disabled={isClosed}
            onClick={() => onMove(appointment)}
            className="flex w-full items-center justify-between rounded-2xl border border-indigo-500/25 bg-indigo-600/10 px-5 py-4 text-left transition-all hover:bg-indigo-600/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>
              <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-white">Mover horario</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Reubicar a un turno libre</span>
            </span>
            <CalendarCheck size={18} className="text-indigo-300" />
          </button>

          <button
            type="button"
            disabled={isClosed}
            onClick={() => onTransfer(appointment)}
            className="flex w-full items-center justify-between rounded-2xl border border-indigo-500/25 bg-indigo-600/10 px-5 py-4 text-left transition-all hover:bg-indigo-600/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>
              <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-white">Trasladar estilista</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Mover este turno a otro profesional</span>
            </span>
            <Repeat size={18} className="text-indigo-300" />
          </button>

          {canMarkLost && (
            <button
              type="button"
              onClick={() => onMarkLost(appointment)}
              className="flex w-full items-center justify-between rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-left transition-all hover:bg-amber-500/20"
            >
              <span>
                <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-white">Marcar cita perdida</span>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Usa el mismo estado del vencimiento automático</span>
              </span>
              <UserX size={18} className="text-amber-300" />
            </button>
          )}

          {appointment.type === 'reserva' && !hasArrived && !isClosed && (
            <button
              type="button"
              onClick={() => onUpdate(appointment.id, 'En Espera')}
              className="flex w-full items-center justify-between rounded-2xl border border-indigo-500/25 bg-indigo-600 px-5 py-4 text-left transition-all hover:bg-indigo-500"
            >
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Marcar llegada</span>
              <UserCheck size={18} />
            </button>
          )}

          {!isClosed && (
            <button
              type="button"
              onClick={() => onCancel(appointment)}
              className="flex w-full items-center justify-between rounded-2xl border border-rose-500/25 bg-rose-500/10 px-5 py-4 text-left transition-all hover:bg-rose-500/20"
            >
              <span>
                <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-white">{appointment.type === 'walkin' ? 'Cancelar servicio' : 'Cancelar cita'}</span>
                <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Quitar este turno de la operación activa</span>
              </span>
              <X size={18} className="text-rose-300" />
            </button>
          )}

          {isClosed && (
            <div className="rounded-2xl border border-slate-800 bg-black/40 p-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              Este turno ya está cerrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppointmentModal({ onClose, onSave, services, clients, stylists, initial, appointments, businessHours = HOURS, openTime = DEFAULT_SALON_OPEN_TIME, closeTime = DEFAULT_SALON_CLOSE_TIME }) {
  const availableStylists = (stylists && stylists.length > 0) ? stylists : [];
  const defaultAppointmentTime = initial?.time || businessHours[0] || DEFAULT_SALON_OPEN_TIME;
  const [searchTerm, setSearchTerm] = useState(initial?.client?.name || '');
  const [phoneVal, setPhoneVal] = useState(formatPhoneNumber(initial?.client?.phone || ''));
  const [selectedClient, setSelectedClient] = useState(initial?.client || null);
  const [skipClientData, setSkipClientData] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [showServiceList, setShowServiceList] = useState(false);
  const [form, setForm] = useState({ 
    date: initial?.date || getTodayString(), 
    time: defaultAppointmentTime, 
    stylistId: initial?.stylistId || availableStylists[0]?.id || '', 
    service: initial?.service || '', 
    price: initial?.price || 0,
    durationMinutes: Number(initial?.durationMinutes) > 0 ? Number(initial.durationMinutes) : 30,
    type: initial?.type || 'reserva'
  });
  const wrapperRef = useRef(null);
  const serviceRef = useRef(null);
  useEffect(() => { 
    function handleClickOutside(event) { 
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowResults(false); 
      if (serviceRef.current && !serviceRef.current.contains(event.target)) setShowServiceList(false); 
    } 
    document.addEventListener("mousedown", handleClickOutside); 
    return () => document.removeEventListener("mousedown", handleClickOutside); 
  }, []);
  const filteredClients = useMemo(() => { 
    if (skipClientData || searchTerm.trim().length < 2 || selectedClient) return []; 
    const phoneQuery = getPhoneDigits(searchTerm);
    return (clients || []).filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (phoneQuery.length > 0 && getPhoneDigits(c.phone).includes(phoneQuery))); 
  }, [searchTerm, clients, selectedClient, skipClientData]);
  const filteredServices = useMemo(
    () => (services || []).filter((service) => !isPromotionService(service) && service.name.toLowerCase().includes(serviceSearch.toLowerCase())),
    [services, serviceSearch],
  );
  const isNewClient = !skipClientData && searchTerm.trim().length >= 3 && filteredClients.length === 0 && !selectedClient;
  const duplicatePhoneClient = useMemo(() => {
    if (!isValidPhoneNumber(phoneVal)) return null;
    return findClientByPhone(clients, phoneVal, selectedClient?.id);
  }, [clients, phoneVal, selectedClient]);
  const showGenericClientOption = !selectedClient && searchTerm.trim().length === 0;
  const handleSelectClient = (c) => { setSelectedClient(c); setSkipClientData(false); setSearchTerm(c.name); setPhoneVal(formatPhoneNumber(c.phone)); setShowResults(false); setModalError(null); };
  const handleToggleSkipClientData = () => {
    setSkipClientData((current) => {
      const next = !current;
      if (next) {
        setSelectedClient(null);
        setSearchTerm('');
        setPhoneVal('');
        setShowResults(false);
        setModalError(null);
      }
      return next;
    });
  };
  const handleSelectService = (s) => { 
    if (s === "POR DEFINIR") { 
      setForm({ ...form, service: "POR DEFINIR", price: 0, durationMinutes: 30 }); 
      setServiceSearch("POR DEFINIR"); 
    } else { 
      setForm({
        ...form,
        service: s.name,
        price: s.price,
        durationMinutes: Number(s.durationMinutes) > 0 ? Number(s.durationMinutes) : 30,
      }); 
      setServiceSearch(s.name); 
    } 
    setShowServiceList(false); setModalError(null); 
  };
  
  const toMinutes = (t) => {
    if (!t || typeof t !== 'string') return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const getWalkinQueueTime = (stylistId, date) => {
    return resolveWalkinQueueTime({ appointments, stylistId, date, businessHours });
  };

  const handleSubmit = (e) => { 
    e.preventDefault(); 
    setModalError(null); 

    if (!form.stylistId) {
      setModalError('Debes tener al menos un estilista activo en esta sucursal para registrar la cita.');
      return;
    }
    
    const selectedDateTime = new Date(`${form.date}T${form.time}:00`);
    const now = new Date();
    
    if (form.type !== 'walkin' && selectedDateTime < new Date(now.getTime() - 5 * 60000)) {
      setModalError('No puedes agendar una cita en el pasado. Elige hora futura.');
      return;
    }

    const newStartMinutes = toMinutes(form.time);
    const newDurationMinutes = Number(form.durationMinutes) > 0 ? Number(form.durationMinutes) : 30;
    const newEndMinutes = newStartMinutes + newDurationMinutes;
    const salonOpenMinutes = toMinutes(openTime);
    const salonCloseMinutes = toMinutes(closeTime);
    if (form.type !== 'walkin' && (newStartMinutes < salonOpenMinutes || newStartMinutes > salonCloseMinutes)) {
      setModalError(`El horario del salón es de ${formatTime12h(openTime)} a ${formatTime12h(closeTime)}.`);
      return;
    }
    const hasReservationConflict = form.type !== 'walkin' && (appointments || []).some(a => {
      if (standardizeDate(a.date) !== standardizeDate(form.date) || String(a.stylistId) !== String(form.stylistId) || a.status === 'Cancelada' || a.status === 'Finalizada' || a.status === 'Cita Perdida') return false;
      const existingStartMinutes = toMinutes(a.time);
      const existingDurationMinutes = Number(a.durationMinutes) > 0 ? Number(a.durationMinutes) : 30;
      const existingEndMinutes = existingStartMinutes + existingDurationMinutes;
      return newStartMinutes < existingEndMinutes && existingStartMinutes < newEndMinutes;
    });

    if (hasReservationConflict) { 
      setModalError(`Este estilista ya tiene una cita que se solapa con el horario ${formatTime12h(form.time)}.`); 
      return; 
    } 
    
    if (!form.service) { setModalError("Por favor elige un servicio."); return; } 
    if (!skipClientData && (selectedClient || isNewClient) && phoneVal.trim() && !isValidPhoneNumber(phoneVal)) { setModalError("El celular debe tener exactamente 8 dígitos."); return; }
    if (!skipClientData && isNewClient && !phoneVal.trim()) { setModalError("Ingresa el número de celular del nuevo cliente."); return; }
    if (!skipClientData && isNewClient && duplicatePhoneClient) { setModalError(`Ese número ya está registrado con ${duplicatePhoneClient.name}.`); return; }
    
    onSave(form, skipClientData
      ? { id: null, name: 'Cliente genérico', phone: '', isNew: false, skipRegistration: true }
      : { name: searchTerm, phone: formatPhoneNumber(phoneVal), id: selectedClient?.id, isNew: isNewClient }
    ); 
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 md:p-8 animate-in fade-in text-white no-print">
      <div className="appointment-modal bg-slate-950 w-full max-w-4xl rounded-[2.25rem] shadow-2xl border border-slate-800 animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[88vh] text-white">
        <div className="px-6 py-4 bg-black border-b border-slate-800 flex justify-between items-center text-white">
          <div className="flex items-center gap-4 text-white">
                <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-white">
                    {form.type === 'walkin' ? <Zap size={22}/> : <CalendarIcon size={22}/>}
            </div>
            <h3 className="text-xl md:text-2xl font-black uppercase italic text-white leading-none">
                {form.type === 'walkin' ? 'NUEVO TURNO (SIN CITA)' : 'RESERVAR TURNO'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2.5 bg-slate-900 rounded-xl text-slate-500 text-white"><X size={24} strokeWidth={3} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 text-white">
          {modalError && <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-2xl flex items-center gap-3 text-rose-500 text-[10px] font-black uppercase italic leading-none">{modalError}</div>}
          <div className="space-y-3 text-white">
            <label className="text-[10px] font-black text-slate-500 uppercase italic tracking-[0.2em] block leading-none">1. ELIGE STYLISTO PROFESIONAL</label>
            {availableStylists.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-slate-700 bg-black/40 p-6 text-center text-slate-400">
                <p className="text-[11px] font-black uppercase italic leading-none">No hay estilistas activos en esta sucursal.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-white">
                {availableStylists.map(b => (
                  <div key={b.id} onClick={() => setForm((prev) => {
                    const nextStylistId = b.id;
                    const nextTime = prev.type === 'walkin' ? getWalkinQueueTime(nextStylistId, prev.date) : prev.time;
                    return { ...prev, stylistId: nextStylistId, time: nextTime };
                  })} className={`p-3 rounded-[1.35rem] border-2 cursor-pointer transition-all flex flex-col items-center text-center gap-2 justify-center relative ${form.stylistId === b.id ? `${b.color} bg-indigo-600/10 shadow-lg scale-[1.02]` : 'border-slate-800 bg-black'}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black italic shadow-xl text-[11px] text-white ${b.bg}`}>{b.avatar}</div>
                    <p className="text-[9px] font-black uppercase italic text-white leading-tight truncate max-w-full">{b.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-white">
            <div className="space-y-3 text-white" ref={wrapperRef}>
              <label className="text-[10px] font-black text-slate-500 uppercase italic tracking-[0.2em] block leading-none">2. DATOS DEL CLIENTE</label>
              <div className="space-y-3 text-white relative">
                <input disabled={skipClientData} required={!skipClientData} className={`w-full bg-black border border-slate-800 p-4 text-sm font-black uppercase italic text-white outline-none focus:border-indigo-600 leading-none disabled:cursor-not-allowed disabled:opacity-45 ${showResults && filteredClients.length > 0 ? 'rounded-t-[1.2rem] rounded-b-none' : 'rounded-[1.2rem]'}`} placeholder={skipClientData ? 'CLIENTE GENÉRICO' : 'BUSCAR CLIENTE'} value={skipClientData ? 'CLIENTE GENÉRICO' : searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedClient(null); setShowResults(true); }} onFocus={() => setShowResults(true)} />
                {showGenericClientOption && (
                  <label className="ml-auto flex w-fit cursor-pointer select-none items-center gap-2 rounded-full px-1 text-[9px] font-black uppercase italic tracking-[0.14em] text-slate-400 transition-colors hover:text-white">
                    <input
                      type="checkbox"
                      checked={skipClientData}
                      onChange={handleToggleSkipClientData}
                      className="h-3.5 w-3.5 rounded border-slate-400 accent-emerald-500"
                    />
                    Cliente genérico
                  </label>
                )}
                {showResults && filteredClients.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-slate-900 border border-t-0 border-slate-700 rounded-b-[1.2rem] shadow-2xl z-50 overflow-hidden text-white">
                    {filteredClients.map(c => (<div key={c.id} onClick={() => handleSelectClient(c)} className="flex items-center gap-4 p-4 hover:bg-indigo-600 cursor-pointer border-b border-slate-800 text-white"><span className="text-xs font-black uppercase italic text-white">{c.name}</span></div>))}
                  </div>
                )}
                {isNewClient && !selectedClient && (
                  <div className="mt-2 p-3 rounded-xl bg-orange-500 border border-orange-400 text-white font-black uppercase tracking-wider text-sm text-center shadow-[0_0_20px_rgba(255,159,67,0.65)] animate-pulse ring-2 ring-orange-300/60 leading-none">
                    <span className="drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]">¡Nuevo cliente detectado!</span>
                  </div>
                )}
                {!skipClientData && (selectedClient || isNewClient) && (
                  <input required type="tel" className="w-full bg-black border-2 border-indigo-600/40 p-4 rounded-[1.2rem] text-sm font-black text-white italic leading-none" placeholder="TELÉFONO 0000-0000" value={phoneVal} onChange={e => setPhoneVal(formatPhoneNumber(e.target.value))} />
                )}
              </div>
            </div>
            <div className="space-y-3 text-white" ref={serviceRef}>
              <label className="text-[10px] font-black text-slate-500 uppercase italic tracking-[0.2em] block leading-none">3. SERVICIO Y HORARIO</label>
              <div className="space-y-3 text-white">
                <div className="relative text-white">
                  <input className="w-full bg-black border border-slate-800 p-4 rounded-[1.2rem] text-sm font-black uppercase italic text-white outline-none focus:border-emerald-600 leading-none" placeholder="ELEGIR SERVICIO" value={serviceSearch} onChange={(e) => { setServiceSearch(e.target.value); setShowServiceList(true); }} onFocus={() => setShowServiceList(true)} />
                {showServiceList && (
                  <div className="absolute top-full mt-2 left-0 w-full bg-slate-900 border border-slate-700 rounded-[1.5rem] shadow-2xl z-50 overflow-hidden text-white">
                    <div className="max-h-52 overflow-y-auto inner-scrollbar p-2 text-white">
                      <div onClick={() => handleSelectService("POR DEFINIR")} className="p-3.5 hover:bg-emerald-600/20 rounded-[1rem] cursor-pointer text-emerald-400 text-[10px] font-black uppercase italic leading-none">--- DEFINIR EN CAJA ---</div>
                      {filteredServices.length === 0 ? (
                        <div className="p-3.5 text-slate-400 text-[10px] font-black uppercase italic leading-none">No se encontraron servicios.</div>
                      ) : filteredServices.map(s => (
                        <div key={s.id} onClick={() => handleSelectService(s)} className="flex items-center justify-between p-3.5 hover:bg-indigo-600 rounded-[1rem] cursor-pointer text-white text-white"><span className="text-xs font-black uppercase italic text-white">{s.name}</span><span className="text-[10px] font-black italic text-emerald-400">C$ {s.price}</span></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-white">
                <input
                  type="date"
                  className="w-full bg-black border border-slate-800 py-3.5 px-5 rounded-[1.2rem] text-[12px] font-black text-white outline-none italic"
                  value={form.date}
                  onChange={e => setForm((prev) => {
                    const nextDate = e.target.value;
                    const nextTime = prev.type === 'walkin' ? getWalkinQueueTime(prev.stylistId, nextDate) : prev.time;
                    return { ...prev, date: nextDate, time: nextTime };
                  })}
                />
                {form.type === 'walkin' ? (
                  <div className="w-full bg-indigo-600/10 border border-indigo-500/30 py-3.5 px-5 rounded-[1.2rem] flex items-center gap-2 text-white">
                    <Clock size={14} className="text-indigo-400" />
                    <span className="text-[11px] font-black text-indigo-400 uppercase italic leading-none">Cola (auto): {formatTime12h(form.time)}</span>
                  </div>
                ) : (
                  <select className="w-full bg-black border border-slate-800 py-3.5 px-5 rounded-[1.2rem] text-[12px] font-black text-white outline-none italic" value={form.time} onChange={e => setForm({...form, time: e.target.value})}>
                    {businessHours.map((time) => (
                      <option key={time} value={time}>{formatTime12h(time)}</option>
                    ))}
                  </select>
                )}
              </div>
              </div>
            </div>
          </div>
          <div className="pt-5 border-t border-slate-900 flex justify-between items-center gap-4 text-white">
            <div className="flex flex-col text-white"><span className="text-[9px] font-black text-slate-500 uppercase italic mb-1.5 leading-none">MONTO ESTIMADO</span><h4 className="text-3xl md:text-4xl font-black italic text-white leading-none"><span className="text-emerald-500 mr-2 text-white">C$</span>{(Number(form.price) || 0).toLocaleString()}</h4></div>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-5 rounded-[1.5rem] font-black uppercase text-[11px] italic transition-all text-white leading-none">RESERVAR ESPACIO</button>
          </div>
        </form>
      </div>
    </div>
  );
}
