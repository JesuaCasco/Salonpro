import { isPromotionService } from '../features/app/shared';
import { hasSupabaseConfig, supabase, supabasePublishableKey, supabaseUrl } from './supabase';

const STATUS_TO_DB = {
  Confirmada: 'confirmada',
  'En Espera': 'en_espera',
  'En Servicio': 'en_servicio',
  Finalizada: 'finalizada',
  Cancelada: 'cancelada',
  'Cita Perdida': 'cita_perdida',
};

const STATUS_FROM_DB = {
  confirmada: 'Confirmada',
  en_espera: 'En Espera',
  en_servicio: 'En Servicio',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
  cita_perdida: 'Cita Perdida',
};

const normalizeDbStatus = (status) => {
  if (!status) return 'Confirmada';

  const rawStatus = `${status}`.trim();
  const normalizedKey = rawStatus
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

  return (
    STATUS_FROM_DB[normalizedKey]
    || STATUS_FROM_DB[rawStatus]
    || STATUS_TO_DB[rawStatus] && rawStatus
    || {
      'en espera': 'En Espera',
      'en servicio': 'En Servicio',
      finalizada: 'Finalizada',
      cancelada: 'Cancelada',
      confirmada: 'Confirmada',
      'cita perdida': 'Cita Perdida',
    }[rawStatus.toLowerCase()]
    || 'Confirmada'
  );
};

const safeTime = (value = '00:00') => `${value}`.slice(0, 5);
const formatDateOnly = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};
const OPERATIONAL_APPOINTMENTS_PAST_DAYS = 365;
const OPERATIONAL_APPOINTMENTS_FUTURE_DAYS = 45;
const getOperationalAppointmentsRange = () => ({
  from: formatDateOnly(addDays(new Date(), -OPERATIONAL_APPOINTMENTS_PAST_DAYS)),
  to: formatDateOnly(addDays(new Date(), OPERATIONAL_APPOINTMENTS_FUTURE_DAYS)),
});
const CLIENT_DIRECTORY_APPOINTMENTS_PAST_DAYS = 730;
const getClientDirectoryAppointmentsRange = () => ({
  from: formatDateOnly(addDays(new Date(), -CLIENT_DIRECTORY_APPOINTMENTS_PAST_DAYS)),
  to: formatDateOnly(new Date()),
});
const normalizeSlug = (value = '') =>
  `${value}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const assertSupabase = () => {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase no est\u00e1 configurado.');
  }
};

const fixMojibakeText = (value = '') =>
  `${value ?? ''}`
    .replaceAll('salón', 'salón')
    .replaceAll('salones', 'salones')
    .replaceAll('sesiÃ³n', 'sesión')
    .replaceAll('vÃ¡lida', 'válida')
    .replaceAll('configuraciÃ³n', 'configuración')
    .replaceAll('funciÃ³n', 'función')
    .replaceAll('contraseÃ±a', 'contraseña')
    .replaceAll('contraseÃ±as', 'contraseñas')
    .replaceAll('encontrÃ³', 'encontró')
    .replaceAll('nÃ³mina', 'nómina')
    .replaceAll('Ã¡', 'á')
    .replaceAll('Ã©', 'é')
    .replaceAll('Ã­', 'í')
    .replaceAll('Ã³', 'ó')
    .replaceAll('Ãº', 'ú')
    .replaceAll('Ã±', 'ñ');

const normalizeError = (error, fallback) => {
  if (!error) return new Error(fixMojibakeText(fallback));

  if (error instanceof Error) {
    return new Error(fixMojibakeText(error.message || fallback));
  }

  return new Error(fixMojibakeText(error.message || fallback));
};

const settleQuery = async (query, fallbackData = []) => {
  try {
    const result = await query;
    return {
      data: result?.data ?? fallbackData,
      error: result?.error ?? null,
    };
  } catch (error) {
    return {
      data: fallbackData,
      error,
    };
  }
};

const encodeBranchScope = (branchId) => `branch_id.is.null,branch_id.eq.${branchId}`;

const applyTenantScope = (query, { isSuperAdmin, currentSalonId, currentBranchId }, options = {}) => {
  const {
    salonColumn = 'salon_id',
    branchColumn = 'branch_id',
    includeGlobalBranchRows = true,
    includeLegacySalonRows = false,
  } = options;

  let nextQuery = query;

  if (!isSuperAdmin && currentSalonId) {
    nextQuery = includeLegacySalonRows
      ? nextQuery.or(`${salonColumn}.is.null,${salonColumn}.eq.${currentSalonId}`)
      : nextQuery.eq(salonColumn, currentSalonId);
  }

  if (!isSuperAdmin && currentBranchId && branchColumn) {
    nextQuery = includeGlobalBranchRows
      ? nextQuery.or(encodeBranchScope(currentBranchId))
      : nextQuery.eq(branchColumn, currentBranchId);
  }

  return nextQuery;
};

const validateBranchBelongsToSalon = async (salonId, branchId) => {
  if (!branchId) return;
  if (!salonId) {
    throw normalizeError(null, 'Debes asignar un salón antes de seleccionar una sucursal.');
  }

  const { data, error } = await supabase
    .from('branches')
    .select('id, salon_id')
    .eq('id', branchId)
    .maybeSingle();

  if (error) throw normalizeError(error, 'No se pudo validar la sucursal seleccionada.');
  if (!data) throw normalizeError(null, 'La sucursal seleccionada no existe.');
  if (String(data.salon_id || '') !== String(salonId || '')) {
    throw normalizeError(null, 'La sucursal seleccionada no pertenece al salón indicado.');
  }
};

const toUiClient = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone || '',
  notes: row.notes || '',
  points: Number(row.points || 0),
  createdAt: row.created_at,
  completedVisits: Number(row.completed_visits || 0),
  totalSpent: Number(row.total_spent || 0),
  lastVisitAt: row.last_visit_at || null,
  favoriteStylistId: row.favorite_stylist_id || null,
  favoriteStylistName: row.favorite_stylist_name || '',
  favoriteServiceName: row.favorite_service_name || '',
  statsUpdatedAt: row.stats_updated_at || null,
});

const toUiStylist = (row) => ({
  id: row.id,
  name: row.name,
  fullName: row.full_name || row.name,
  cedula: row.cedula || '',
  avatar: row.avatar || '',
  color: row.color || '',
  bg: row.bg || '',
  shadow: row.shadow || '',
  paymentMode: row.payment_mode || 'salario',
  salary: Number(row.salary || 0),
  commission: Number(row.commission || 0),
  paymentFrequency: row.payment_frequency || 'Quincenal',
  level: row.level || 'Junior',
  phone: row.phone || '',
  email: row.email || '',
  salonId: row.salon_id || null,
  branchId: row.branch_id || null,
  isActive: row.is_active ?? true,
});

const toUiService = (row, comboMap) => ({
  id: row.id,
  name: row.name,
  price: Number(row.price || 0),
  category: row.category,
  items: comboMap.get(row.id) || [],
  appliesTo: row.applies_to || 'General',
  discountType: row.discount_type || 'percentage',
  discountValue: Number(row.discount_value || 0),
  targetServiceIds: Array.isArray(row.target_service_ids) ? row.target_service_ids : [],
  isOptional: row.is_optional ?? true,
});

const toUiInventoryItem = (row) => ({
  id: row.id,
  salonId: row.salon_id || null,
  branchId: row.branch_id || null,
  serviceId: row.service_id || null,
  name: row.product_name || row.name || 'Producto sin nombre',
  productName: row.product_name || row.name || 'Producto sin nombre',
  productCategory: row.product_category || 'Otros',
  usageType: row.usage_type || 'retail',
  sku: row.sku || '',
  barcode: row.barcode || '',
  unitName: row.unit_name || 'unidad',
  trackStock: row.track_stock ?? true,
  minStock: Number(row.min_stock || 0),
  maxStock: row.max_stock == null ? null : Number(row.max_stock),
  costPrice: Number(row.cost_price || 0),
  salePrice: Number(row.sale_price || 0),
  currentStock: Number(row.current_stock || 0),
  notes: row.notes || '',
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const inventoryItemToProductService = (item) => ({
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

const toUiPosSale = (row) => ({
  id: row.id,
  ticketNumber: Number(row.ticket_number ?? row.ticketNumber ?? 0),
  salonId: row.salon_id || null,
  branchId: row.branch_id || null,
  cashSessionId: row.cash_session_id || row.cashSessionId || null,
  paymentMethod: row.payment_method || row.paymentMethod || 'cash',
  clientId: row.client_id || row.clientId || null,
  clientName: row.client_name || row.clientName || '',
  rawSubtotal: Number(row.raw_subtotal ?? row.rawSubtotal ?? row.subtotal ?? 0),
  discountTotal: Number(row.discount_total ?? row.discountTotal ?? 0),
  subtotal: Number(row.subtotal || 0),
  productTotal: Number(row.product_total || 0),
  serviceTotal: Number(row.service_total || 0),
  items: Array.isArray(row.items) ? row.items : [],
  promotionId: row.promotion_id || row.promotionId || null,
  promotionName: row.promotion_name || row.promotionName || '',
  discountLabel: row.discount_label || row.discountLabel || '',
  notes: row.notes || '',
  canceledAt: (() => {
    try {
      return row.notes ? JSON.parse(row.notes)?.canceledAt || null : null;
    } catch {
      return null;
    }
  })(),
  canceledBy: (() => {
    try {
      return row.notes ? JSON.parse(row.notes)?.canceledBy || null : null;
    } catch {
      return null;
    }
  })(),
  cancellationReason: (() => {
    try {
      return row.notes ? JSON.parse(row.notes)?.cancellationReason || '' : '';
    } catch {
      return '';
    }
  })(),
  createdBy: row.created_by || null,
  createdAt: row.created_at,
});

const toUiCashSession = (row) => ({
  id: row.id,
  salonId: row.salon_id || null,
  branchId: row.branch_id || null,
  openedBy: row.opened_by || null,
  closedBy: row.closed_by || null,
  openedAt: row.opened_at,
  closedAt: row.closed_at || null,
  openingAmount: Number(row.opening_amount || 0),
  closingAmount: Number(row.closing_amount ?? row.counted_cash_amount ?? 0),
  expectedCashAmount: Number(row.expected_cash_amount || 0),
  countedCashAmount: Number(row.counted_cash_amount ?? row.closing_amount ?? 0),
  differenceAmount: Number(row.difference_amount || 0),
  status: row.status || (row.closed_at ? 'closed' : 'open'),
  notes: row.notes || '',
});

const toUiCashMovement = (row) => ({
  id: row.id,
  cashSessionId: row.cash_session_id || null,
  salonId: row.salon_id || null,
  branchId: row.branch_id || null,
  type: row.type || 'in',
  movementKind: row.movement_kind || 'manual',
  paymentMethod: row.payment_method || 'cash',
  amount: Number(row.amount || 0),
  notes: row.notes || '',
  referenceType: row.reference_type || null,
  referenceId: row.reference_id || null,
  createdBy: row.created_by || null,
  createdAt: row.created_at,
});

const toUiAppointment = (row) => ({
  id: row.id,
  clientId: row.client_id,
  stylistId: row.stylist_id,
  rawStylistId: row.raw_stylist_id || row.stylist_id,
  stylistName: row.stylist_name || '',
  serviceId: row.service_id,
  service: row.service_name || '',
  price: Number(row.price || 0),
  grossAmount: Number(row.gross_amount ?? row.grossAmount ?? row.price ?? 0),
  discountAmount: Number(row.discount_amount ?? row.discountAmount ?? 0),
  promotionName: row.promotion_name || row.promotionName || '',
  date: row.appointment_date,
  time: safeTime(row.appointment_time),
  durationMinutes: Number(row.duration_minutes || 30),
  type: row.type || 'reserva',
  status: normalizeDbStatus(row.status),
  cancellationReason: row.cancellation_reason || '',
  checkInAt: row.check_in_at,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  cancelledAt: row.cancelled_at,
  reminderSentAt: row.reminder_sent_at,
  clientConfirmedAt: row.client_confirmed_at,
  isPaid: Boolean(row.is_paid),
  paidAt: row.paid_at,
  rating: row.rating,
  notes: row.notes || '',
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toUiRole = (row) => ({
  roleName: row.role_name,
  description: row.description || '',
});

const toUiPayrollPayment = (row) => ({
  id: row.id,
  salonId: row.salon_id,
  branchId: row.branch_id,
  stylistId: row.stylist_id,
  paymentScope: row.payment_scope || 'individual',
  periodStart: row.period_start,
  periodEnd: row.period_end,
  paymentDate: row.payment_date,
  paymentMethod: row.payment_method || 'cash',
  baseAmount: Number(row.base_amount || 0),
  commissionAmount: Number(row.commission_amount || 0),
  totalAmount: Number(row.total_amount || 0),
  servicesCount: Number(row.services_count || 0),
  salesTotal: Number(row.sales_total || 0),
  commissionRate: Number(row.commission_rate || 0),
  notes: row.notes || '',
  status: row.status || 'paid',
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  items: (row.payroll_payment_items || row.items || []).map((item) => ({
    id: item.id,
    payrollPaymentId: item.payroll_payment_id,
    appointmentId: item.appointment_id,
    stylistId: item.stylist_id,
    serviceName: item.service_name || '',
    serviceAmount: Number(item.service_amount || 0),
    commissionRate: Number(item.commission_rate || 0),
    commissionAmount: Number(item.commission_amount || 0),
    createdAt: item.created_at,
  })),
});

const toUiSalon = (row) => ({
  id: row.id,
  name: row.name,
  slug: row.slug || normalizeSlug(row.name),
  ownerEmail: row.owner_email || '',
  phone: row.phone || '',
  city: row.city || '',
  plan: row.plan || 'starter',
  openTime: safeTime(row.open_time || '08:00'),
  closeTime: safeTime(row.close_time || '18:00'),
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
});

const toUiBranch = (row, salonMap) => ({
  id: row.id,
  salonId: row.salon_id,
  salonName: salonMap.get(row.salon_id)?.name || row.salon_name || 'Negocio sin nombre',
  name: row.name,
  code: row.code || '',
  city: row.city || '',
  address: row.address || '',
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
});

const toUiProfile = (row, roleMap, salonMap, branchMap) => {
  const resolvedBranch = row.branch_id ? branchMap.get(row.branch_id) : null;
  const resolvedSalonId = row.salon_id || resolvedBranch?.salonId || null;
  const resolvedSalonName = resolvedSalonId
    ? salonMap.get(resolvedSalonId)?.name
      || resolvedBranch?.salonName
      || row.salon_name
      || 'Negocio sin nombre'
    : '';

  return {
    id: row.id,
    email: row.email || '',
    fullName: row.full_name || row.name || row.email || 'Usuario',
    createdAt: row.created_at,
    roles: roleMap.get(row.id) || [],
    salonId: resolvedSalonId,
    salonName: resolvedSalonName,
    branchId: row.branch_id || null,
    branchName: row.branch_id ? resolvedBranch?.name || 'Sucursal sin nombre' : '',
  };
};

const withScopeIds = (payload, salonId, branchId = null) => ({
  ...payload,
  ...(salonId ? { salon_id: salonId } : {}),
  ...(branchId ? { branch_id: branchId } : {}),
});

const normalizeLegacyStylistId = (stylistId, stylists = []) => {
  if (stylistId === null || stylistId === undefined || stylistId === '') return stylistId;
  const normalizedStylists = Array.isArray(stylists) ? stylists : [];
  const hasExactMatch = normalizedStylists.some((stylist) => String(stylist.id) === String(stylistId));
  if (hasExactMatch) return stylistId;

  const legacyIndex = Number.parseInt(String(stylistId), 10);
  if (Number.isNaN(legacyIndex) || legacyIndex < 1) return stylistId;

  return normalizedStylists[legacyIndex - 1]?.id || stylistId;
};

const normalizeLegacyEntityId = (entityId, items = []) => {
  if (entityId === null || entityId === undefined || entityId === '') return entityId;
  const normalizedItems = Array.isArray(items) ? items : [];
  const hasExactMatch = normalizedItems.some((item) => String(item.id) === String(entityId));
  if (hasExactMatch) return entityId;

  const legacyIndex = Number.parseInt(String(entityId), 10);
  if (Number.isNaN(legacyIndex) || legacyIndex < 1) return entityId;

  return normalizedItems[legacyIndex - 1]?.id || entityId;
};

const toDbClient = (client, salonId) =>
  withScopeIds({
    id: client.id,
    name: client.name,
    phone: client.phone || '',
    notes: client.notes || '',
    points: Number(client.points || 0),
    completed_visits: Number(client.completedVisits || 0),
    total_spent: Number(client.totalSpent || 0),
    last_visit_at: client.lastVisitAt || null,
    favorite_stylist_id: client.favoriteStylistId || null,
    favorite_stylist_name: client.favoriteStylistName || null,
    favorite_service_name: client.favoriteServiceName || null,
    stats_updated_at: client.statsUpdatedAt || null,
  }, salonId, null);

const toDbStylist = (stylist, salonId, branchId = null) => {
  const resolvedSalonId = stylist.salonId ?? salonId ?? null;
  const resolvedBranchId = stylist.branchId ?? branchId ?? null;

  return withScopeIds({
    id: stylist.id,
    name: stylist.name,
    full_name: stylist.fullName || stylist.name || '',
    cedula: stylist.cedula || '',
    phone: stylist.phone || null,
    email: stylist.email || null,
    payment_mode: stylist.paymentMode || 'salario',
    salary: Number(stylist.salary || 0),
    commission: Number(stylist.commission || 0),
    payment_frequency: stylist.paymentFrequency || 'Quincenal',
    level: stylist.level || 'Junior',
    color: stylist.color || null,
    bg: stylist.bg || null,
    shadow: stylist.shadow || null,
    avatar: stylist.avatar || null,
    is_active: stylist.isActive ?? true,
  }, resolvedSalonId, resolvedBranchId);
};

const toDbService = (service, salonId) => ({
  id: service.id,
  name: service.name,
  category: service.category,
  price: Number(service.price || 0),
  applies_to: isPromotionService(service) ? (service.appliesTo || 'General') : null,
  discount_type: isPromotionService(service) ? (service.discountType || 'percentage') : null,
  discount_value: isPromotionService(service) ? Number(service.discountValue || 0) : 0,
  target_service_ids: isPromotionService(service)
    ? (Array.isArray(service.targetServiceIds) ? service.targetServiceIds : [])
    : [],
  is_optional: isPromotionService(service) ? (service.isOptional ?? true) : true,
  is_active: service.isActive ?? true,
  ...(salonId ? { salon_id: salonId } : {}),
  branch_id: null,
});

const toDbInventoryProduct = (product, salonId, branchId = null, currentUserId = null) =>
  withScopeIds({
    id: product.id,
    service_id: product.serviceId || null,
    product_name: product.productName || product.name,
    product_category: product.productCategory || 'Otros',
    usage_type: product.usageType || 'retail',
    sku: product.sku || null,
    barcode: product.barcode || null,
    unit_name: product.unitName || 'unidad',
    track_stock: product.trackStock !== false,
    min_stock: Number(product.minStock || 0),
    max_stock: product.maxStock === '' || product.maxStock == null ? null : Number(product.maxStock),
    cost_price: Number(product.costPrice || 0),
    sale_price: Number(product.salePrice || product.price || 0),
    current_stock: Number(product.currentStock || 0),
    notes: product.notes || null,
    is_active: product.isActive ?? true,
    created_by: product.id ? undefined : currentUserId || null,
    updated_by: currentUserId || null,
  }, salonId, branchId);

const toDbSalon = (salon) => ({
  id: salon.id,
  name: salon.name,
  slug: normalizeSlug(salon.slug || salon.name),
  owner_email: salon.ownerEmail || '',
  phone: salon.phone || null,
  city: salon.city || null,
  plan: salon.plan || 'starter',
  open_time: salon.openTime || '08:00',
  close_time: salon.closeTime || '18:00',
  is_active: salon.isActive ?? true,
});

const toDbBranch = (branch) => ({
  id: branch.id,
  salon_id: branch.salonId,
  name: branch.name,
  code: branch.code || null,
  city: branch.city || null,
  address: branch.address || null,
  is_active: branch.isActive ?? true,
});

const toDbAppointment = (appointment, services = [], salonId, branchId = null, stylists = [], clients = []) => {
  const matchedService = (services || []).find((service) => service.name === appointment.service);
  const normalizedStylistId = normalizeLegacyStylistId(appointment.stylistId, stylists);
  const matchedStylist = (stylists || []).find((stylist) => String(stylist.id) === String(normalizedStylistId));
  const normalizedClientId = appointment.clientId
    ? normalizeLegacyEntityId(appointment.clientId, clients)
    : null;
  const normalizedServiceId = matchedService?.id || normalizeLegacyEntityId(appointment.serviceId, services) || null;
  const netPrice = Number(appointment.price || 0);
  const discountAmount = Number(appointment.discountAmount || 0);
  const grossAmount = Number(
    appointment.grossAmount
      ?? (discountAmount > 0 ? netPrice + discountAmount : netPrice),
  );

  return withScopeIds({
    id: appointment.id,
    client_id: normalizedClientId,
    stylist_id: normalizedStylistId,
    stylist_name: appointment.stylistName || matchedStylist?.name || null,
    service_id: normalizedServiceId,
    service_name: appointment.service || matchedService?.name || null,
    price: netPrice,
    gross_amount: grossAmount,
    discount_amount: discountAmount,
    promotion_name: appointment.promotionName || null,
    appointment_date: appointment.date,
    appointment_time: safeTime(appointment.time),
    duration_minutes: Number(appointment.durationMinutes || 30),
    type: appointment.type || 'reserva',
    status: STATUS_TO_DB[appointment.status] || 'confirmada',
    cancellation_reason: appointment.cancellationReason || null,
    check_in_at: appointment.checkInAt || null,
    started_at: appointment.startedAt || null,
    finished_at: appointment.finishedAt || null,
    cancelled_at: appointment.cancelledAt || null,
    reminder_sent_at: appointment.reminderSentAt || null,
    client_confirmed_at: appointment.clientConfirmedAt || null,
    is_paid: Boolean(appointment.isPaid),
    rating: appointment.rating ?? null,
    notes: appointment.notes || null,
    created_by: appointment.createdBy || null,
    updated_by: appointment.updatedBy || null,
  }, salonId, branchId);
};

const toDbPosSale = (sale, salonId, branchId = null, createdBy = null) =>
  withScopeIds({
    id: sale.id,
    cash_session_id: sale.cashSessionId || null,
    payment_method: sale.paymentMethod || 'cash',
    client_id: sale.clientId || null,
    client_name: sale.clientName || null,
    raw_subtotal: Number(sale.rawSubtotal || sale.subtotal || 0),
    discount_total: Number(sale.discountTotal || 0),
    subtotal: Number(sale.subtotal || 0),
    product_total: Number(sale.productTotal || 0),
    service_total: Number(sale.serviceTotal || 0),
    items: Array.isArray(sale.items) ? sale.items : [],
    promotion_id: sale.promotionId || null,
    promotion_name: sale.promotionName || null,
    discount_label: sale.discountLabel || null,
    notes: sale.notes || null,
    created_by: createdBy || sale.createdBy || null,
  }, salonId, branchId);

const fetchActiveCashSessionRow = async (salonId, branchId) => {
  const { data, error } = await supabase
    .from('cash_sessions')
    .select('*')
    .eq('salon_id', salonId)
    .eq('branch_id', branchId)
    .eq('status', 'open')
    .is('closed_at', null)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw normalizeError(error, 'No se pudo validar la caja abierta.');
  return data || null;
};

const getComboRows = (services = []) =>
  services
    .filter((service) => service.category === 'Combo' && Array.isArray(service.items))
    .flatMap((combo) =>
      combo.items.map((itemId) => ({
        combo_service_id: combo.id,
        item_service_id: itemId,
      })),
    );

const getComboRowKey = (comboServiceId, itemServiceId) => `${comboServiceId}::${itemServiceId}`;

const resolveUserScope = async (currentUserId, scopeOverride = {}) => {
  if (!currentUserId) return { isSuperAdmin: false, currentSalonId: null, currentBranchId: null };

  try {
    const [{ data: profile, error: profileError }, { data: userRoles, error: rolesError }] = await Promise.all([
      supabase.from('profiles').select('id, salon_id, branch_id').eq('id', currentUserId).maybeSingle(),
      supabase.from('user_roles').select('role_name').eq('user_id', currentUserId),
    ]);

    if (profileError) throw profileError;
    if (rolesError) throw rolesError;

    const currentUserRoles = (userRoles || []).map((row) => row.role_name);
    const hasSalonOverride = Boolean(scopeOverride?.currentSalonId);
    const effectiveSalonId = hasSalonOverride
      ? scopeOverride.currentSalonId
      : profile?.salon_id || null;
    const effectiveBranchId = Object.prototype.hasOwnProperty.call(scopeOverride || {}, 'currentBranchId')
      ? scopeOverride.currentBranchId
      : (hasSalonOverride ? null : profile?.branch_id || null);

    return {
      isSuperAdmin: currentUserRoles.includes('super_admin') && !hasSalonOverride,
      currentSalonId: effectiveSalonId,
      currentBranchId: effectiveBranchId,
    };
    } catch (error) {
    console.error('No se pudo resolver el scope del usuario actual en Supabase.', {
      currentUserId,
      error,
    });
    return { isSuperAdmin: false, currentSalonId: null, currentBranchId: null };
  }
};

export async function fetchSalonSnapshot(currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const appointmentsRange = getOperationalAppointmentsRange();

  const [
    { data: servicesData, error: servicesError },
    { data: comboItemsData, error: comboItemsError },
    { data: clientsData, error: clientsError },
    { data: stylistsData, error: stylistsError },
    { data: appointmentsData, error: appointmentsError },
    posSalesResult,
    cashSessionsResult,
    cashMovementsResult,
    payrollPaymentsResult,
    inventoryItemsResult,
  ] = await Promise.all([
    applyTenantScope(
      supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      scope,
      { branchColumn: null, includeLegacySalonRows: true },
    ),
    supabase
      .from('service_combo_items')
      .select('*'),
    applyTenantScope(
      supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: true }),
      scope,
      { branchColumn: null },
    ),
    applyTenantScope(
      supabase
        .from('stylists')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      scope,
    ),
    applyTenantScope(
      supabase
        .from('appointments')
        .select('*')
        .gte('appointment_date', appointmentsRange.from)
        .lte('appointment_date', appointmentsRange.to)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true }),
      scope,
    ),
    applyTenantScope(
      supabase
        .from('pos_sales')
        .select('*')
        .gte('created_at', `${appointmentsRange.from}T00:00:00`)
        .lte('created_at', `${appointmentsRange.to}T23:59:59.999`)
        .order('created_at', { ascending: true }),
      scope,
    ).then((result) => result, (error) => ({ data: [], error })),
    applyTenantScope(
      supabase
        .from('cash_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(30),
      scope,
      { includeGlobalBranchRows: false },
    ).then((result) => result, (error) => ({ data: [], error })),
    applyTenantScope(
      supabase
        .from('cash_movements')
        .select('*')
        .gte('created_at', `${appointmentsRange.from}T00:00:00`)
        .lte('created_at', `${appointmentsRange.to}T23:59:59.999`)
        .order('created_at', { ascending: true }),
      scope,
      { includeGlobalBranchRows: false },
    ).then((result) => result, (error) => ({ data: [], error })),
    applyTenantScope(
      supabase
        .from('payroll_payments')
        .select('*, payroll_payment_items(*)')
        .gte('payment_date', `${appointmentsRange.from}T00:00:00`)
        .lte('payment_date', `${appointmentsRange.to}T23:59:59.999`)
        .order('payment_date', { ascending: false }),
      scope,
      { includeGlobalBranchRows: false },
    ).then((result) => result, (error) => ({ data: [], error })),
    applyTenantScope(
      supabase
        .from('inventory_items')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      scope,
      { includeGlobalBranchRows: true },
    ).then((result) => result, (error) => ({ data: [], error })),
  ]);

  if (servicesError) throw normalizeError(servicesError, 'No se pudieron cargar los servicios.');
  if (clientsError) throw normalizeError(clientsError, 'No se pudieron cargar los clientes.');
  if (stylistsError) throw normalizeError(stylistsError, 'No se pudo cargar el equipo.');
  if (appointmentsError) throw normalizeError(appointmentsError, 'No se pudo cargar la agenda.');
  if (comboItemsError) {
    console.warn('No se pudieron cargar los combos para el snapshot principal:', comboItemsError);
  }

  let posSalesData = [];
  let posSalesLoadError = null;
  if (posSalesResult?.error) {
    const normalizedError = normalizeError(posSalesResult.error, 'No se pudieron cargar las ventas de POS para el rango operativo actual.');
    posSalesLoadError = normalizedError.message;
    console.warn('No se pudieron cargar las ventas de POS para el snapshot principal:', normalizedError);
  } else {
    posSalesData = posSalesResult?.data || [];
  }

  let cashSessionsData = [];
  let cashMovementsData = [];
  let cashLoadError = null;
  if (cashSessionsResult?.error || cashMovementsResult?.error) {
    const normalizedError = normalizeError(
      cashSessionsResult?.error || cashMovementsResult?.error,
      'No se pudo cargar la caja para el rango operativo actual.',
    );
    cashLoadError = normalizedError.message;
    console.warn('No se pudo cargar caja para el snapshot principal:', normalizedError);
  } else {
    cashSessionsData = cashSessionsResult?.data || [];
    cashMovementsData = cashMovementsResult?.data || [];
  }

  let payrollPaymentsData = [];
  let payrollLoadError = null;
  if (payrollPaymentsResult?.error) {
    const normalizedError = normalizeError(
      payrollPaymentsResult.error,
      'No se pudo cargar el historial de nómina.',
    );
    payrollLoadError = normalizedError.message;
    console.warn('No se pudo cargar historial de nómina:', normalizedError);
  } else {
    payrollPaymentsData = payrollPaymentsResult?.data || [];
  }

  let inventoryItemsData = [];
  let inventoryLoadError = null;
  if (inventoryItemsResult?.error) {
    const normalizedError = normalizeError(
      inventoryItemsResult.error,
      'No se pudo cargar el inventario.',
    );
    inventoryLoadError = normalizedError.message;
    console.warn('No se pudo cargar inventario:', normalizedError);
  } else {
    inventoryItemsData = inventoryItemsResult?.data || [];
  }

  const scopedServiceIds = new Set((servicesData || []).map((row) => row.id));
  const comboMap = new Map();
  for (const row of comboItemsData || []) {
    if (scopedServiceIds.size && !scopedServiceIds.has(row.combo_service_id)) continue;
    const current = comboMap.get(row.combo_service_id) || [];
    comboMap.set(row.combo_service_id, [...current, row.item_service_id]);
  }

  const inventoryItems = (inventoryItemsData || []).map(toUiInventoryItem);
  const inventoryServiceIds = new Set(
    inventoryItems
      .map((item) => item.serviceId)
      .filter(Boolean)
      .map(String),
  );
  const baseServices = (servicesData || [])
    .filter((row) => row.category !== 'Producto' || !inventoryServiceIds.has(String(row.id)))
    .map((row) => toUiService(row, comboMap));
  const inventoryProductServices = inventoryItems
    .filter((item) => ['retail', 'both'].includes(item.usageType))
    .map(inventoryItemToProductService);
  const services = [...baseServices, ...inventoryProductServices];
  const clients = (clientsData || []).map(toUiClient);
  const stylists = (stylistsData || []).map(toUiStylist);
  const appointments = (appointmentsData || []).map((row) =>
    toUiAppointment({
      ...row,
      raw_stylist_id: row.stylist_id,
      stylist_id: normalizeLegacyStylistId(row.stylist_id, stylists),
    }),
  );
  const posSales = (posSalesData || []).map(toUiPosSale);
  const cashSessions = (cashSessionsData || []).map(toUiCashSession);
  const cashMovements = (cashMovementsData || []).map(toUiCashMovement);
  const payrollPayments = (payrollPaymentsData || []).map(toUiPayrollPayment);
  return {
    services,
    clients,
    stylists,
    appointments,
    posSales,
    cashSessions,
    cashMovements,
    payrollPayments,
    inventoryItems,
    posSalesLoadError,
    cashLoadError,
    payrollLoadError,
    inventoryLoadError,
  };
}

export async function fetchScopedClients(currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);

  const clientsQuery = applyTenantScope(
    supabase.from('clients').select('*').order('created_at', { ascending: true }),
    scope,
    { branchColumn: null },
  );

  const { data, error } = await clientsQuery;
  if (error) throw normalizeError(error, 'No se pudieron cargar los clientes.');

  return (data || []).map(toUiClient);
}

export async function fetchScopedServices(currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);

  const servicesQuery = applyTenantScope(
    supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    scope,
    { branchColumn: null, includeLegacySalonRows: true },
  );

  const { data: servicesData, error: servicesError } = await servicesQuery;
  if (servicesError) throw normalizeError(servicesError, 'No se pudieron cargar los servicios.');

  const { data: comboItemsData, error: comboItemsError } = await supabase
    .from('service_combo_items')
    .select('*');
  if (comboItemsError) {
    console.warn('No se pudieron cargar los combos para la lista de servicios:', comboItemsError);
  }

  const scopedServiceIds = new Set((servicesData || []).map((row) => row.id));
  const comboMap = new Map();
  for (const row of comboItemsData || []) {
    if (scopedServiceIds.size && !scopedServiceIds.has(row.combo_service_id)) continue;
    const current = comboMap.get(row.combo_service_id) || [];
    comboMap.set(row.combo_service_id, [...current, row.item_service_id]);
  }

  return (servicesData || []).map((row) => toUiService(row, comboMap));
}

export async function fetchScopedStylists(currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);

  const stylistsQuery = applyTenantScope(
    supabase.from('stylists').select('*').eq('is_active', true).order('created_at', { ascending: true }),
    scope,
  );

  const { data, error } = await stylistsQuery;
  if (error) throw normalizeError(error, 'No se pudieron cargar los estilistas.');

  return (data || []).map(toUiStylist);
}

export async function fetchClientDirectorySnapshot(currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const salonWideScope = { ...scope, currentBranchId: null };
  const clientDirectoryRange = getClientDirectoryAppointmentsRange();
  const warnings = [];

  const [
    { data: clientsData, error: clientsError },
    stylistsResult,
    appointmentsResult,
  ] = await Promise.all([
    applyTenantScope(
      supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: true }),
      salonWideScope,
      { branchColumn: null },
    ),
    settleQuery(applyTenantScope(
      supabase
        .from('stylists')
        .select('id, name, full_name')
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      salonWideScope,
    ), []),
    settleQuery(applyTenantScope(
      supabase
        .from('appointments')
        .select('id, client_id, stylist_id, stylist_name, service_name, price, appointment_date, appointment_time, status')
        .eq('status', 'finalizada')
        .gte('appointment_date', clientDirectoryRange.from)
        .lte('appointment_date', clientDirectoryRange.to)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true }),
      salonWideScope,
    ), []),
  ]);

  if (clientsError) throw normalizeError(clientsError, 'No se pudieron cargar los clientes.');

  const stylistsData = stylistsResult?.data || [];
  if (stylistsResult?.error) {
    const normalizedError = normalizeError(stylistsResult.error, 'No se pudo cargar el equipo para la vista de clientes.');
    warnings.push(normalizedError.message);
    console.error('No se pudo cargar el equipo para clientes:', normalizedError);
  }

  const appointmentsData = appointmentsResult?.data || [];
  if (appointmentsResult?.error) {
    const normalizedError = normalizeError(appointmentsResult.error, 'No se pudo cargar el historial de clientes para calcular visitas y favoritos.');
    warnings.push(normalizedError.message);
    console.error('No se pudo cargar el historial de clientes:', normalizedError);
  }

  return {
    clients: (clientsData || []).map(toUiClient),
    stylists: (stylistsData || []).map(toUiStylist),
    appointments: (appointmentsData || []).map((row) =>
      toUiAppointment({
        ...row,
        raw_stylist_id: row.stylist_id,
        stylist_id: normalizeLegacyStylistId(row.stylist_id, stylistsData || []),
      }),
    ),
    warnings,
  };
}

export async function fetchAccessControlSnapshot(currentUserId) {
  assertSupabase();

  const [
    { data: rolesData, error: rolesError },
    { data: currentProfile, error: currentProfileError },
    { data: currentUserRoleRows, error: currentUserRolesError },
  ] = await Promise.all([
    supabase
      .from('roles')
      .select('*')
      .order('role_name', { ascending: true }),
    supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUserId)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', currentUserId)
      .order('role_name', { ascending: true }),
  ]);
  if (rolesError) throw normalizeError(rolesError, 'No se pudieron cargar los roles.');
  if (currentProfileError) throw normalizeError(currentProfileError, 'No se pudo cargar el perfil del usuario actual.');
  if (currentUserRolesError) throw normalizeError(currentUserRolesError, 'No se pudieron cargar los permisos del usuario actual.');

  const currentUserRoles = (currentUserRoleRows || []).map((row) => row.role_name);
  const isSuperAdmin = currentUserRoles.includes('super_admin');
  const currentSalonId = currentProfile?.salon_id || null;
  const currentBranchId = currentProfile?.branch_id || null;

  const salonsPromise = isSuperAdmin
    ? supabase
      .from('salons')
      .select('*')
      .order('created_at', { ascending: true })
    : currentSalonId
      ? supabase
        .from('salons')
        .select('*')
        .eq('id', currentSalonId)
        .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null });

  const branchesPromise = isSuperAdmin
    ? supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    : currentSalonId
      ? supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .eq('salon_id', currentSalonId)
        .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null });

  const [
    { data: salonsData, error: salonsError },
    { data: branchesData, error: branchesError },
  ] = await Promise.all([salonsPromise, branchesPromise]);

  if (salonsError) {
    throw normalizeError(salonsError, 'No se pudieron cargar los salones visibles para este usuario.');
  }
  if (branchesError) {
    throw normalizeError(branchesError, 'No se pudieron cargar las sucursales visibles para este usuario.');
  }

  let profilesData = [];
  if (isSuperAdmin) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw normalizeError(error, 'No se pudieron cargar los perfiles.');
    profilesData = data || [];
  } else if (currentSalonId) {
    const branchIds = branchesData.map((branch) => branch.id);
    const [{ data: profilesBySalon, error: profilesBySalonError }, { data: profilesByBranch, error: profilesByBranchError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('salon_id', currentSalonId)
        .order('created_at', { ascending: true }),
      branchIds.length
        ? supabase
          .from('profiles')
          .select('*')
          .in('branch_id', branchIds)
          .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profilesBySalonError) throw normalizeError(profilesBySalonError, 'No se pudieron cargar los perfiles.');
    if (profilesByBranchError) throw normalizeError(profilesByBranchError, 'No se pudieron cargar los perfiles.');

    const mergedProfiles = [...(profilesBySalon || []), ...(profilesByBranch || []), ...(currentProfile ? [currentProfile] : [])];
    profilesData = Array.from(new Map(mergedProfiles.map((profile) => [String(profile.id), profile])).values());
  } else {
    profilesData = currentProfile ? [currentProfile] : [];
  }

  const scopedUserIds = Array.from(new Set(profilesData.map((profile) => profile.id).filter(Boolean)));
  let userRolesData = currentUserRoleRows || [];
  if (isSuperAdmin) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('role_name', { ascending: true });
    if (error) throw normalizeError(error, 'No se pudieron cargar los permisos.');
    userRolesData = data || [];
  } else if (scopedUserIds.length) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .in('user_id', scopedUserIds)
      .order('role_name', { ascending: true });
    if (error) throw normalizeError(error, 'No se pudieron cargar los permisos.');
    userRolesData = data || [];
  }

  const roleMap = new Map();
  for (const row of userRolesData || []) {
    const current = roleMap.get(row.user_id) || [];
    roleMap.set(row.user_id, [...current, row.role_name]);
  }

  const salonMap = new Map((salonsData || []).map((row) => [row.id, toUiSalon(row)]));
  const branchMap = new Map((branchesData || []).map((row) => [row.id, toUiBranch(row, salonMap)]));
  const roles = (rolesData || []).map(toUiRole);
  const users = (profilesData || []).map((row) => toUiProfile(row, roleMap, salonMap, branchMap));
  const salons = (salonsData || []).map(toUiSalon);
  const branches = (branchesData || []).map((row) => toUiBranch(row, salonMap));

  return {
    roles,
    users,
    currentUserRoles,
    currentSalonId,
    currentBranchId,
    salons,
    branches,
  };
}

export async function upsertClients(clients, salonId = null) {
  assertSupabase();
  if (!clients?.length) return;

  const { error } = await supabase
    .from('clients')
    .upsert(clients.map((client) => toDbClient(client, salonId)), { onConflict: 'id' });
  if (error) throw normalizeError(error, 'No se pudieron guardar los clientes.');
}

export async function deleteClientRecord(clientId) {
  assertSupabase();
  const { error } = await supabase.from('clients').delete().eq('id', clientId);
  if (error) throw normalizeError(error, 'No se pudo eliminar el cliente.');
}

export async function replaceUserRoles(userId, roleNames = []) {
  assertSupabase();

  const uniqueRoles = [...new Set((roleNames || []).filter(Boolean))];
  const { data: existingRows, error: existingError } = await supabase
    .from('user_roles')
    .select('role_name')
    .eq('user_id', userId);
  if (existingError) throw normalizeError(existingError, 'No se pudieron leer los roles actuales.');

  const currentRoles = [...new Set((existingRows || []).map((row) => row.role_name).filter(Boolean))];
  const rolesToInsert = uniqueRoles.filter((roleName) => !currentRoles.includes(roleName));
  const rolesToDelete = currentRoles.filter((roleName) => !uniqueRoles.includes(roleName));

  if (rolesToInsert.length) {
    const { error: insertError } = await supabase
      .from('user_roles')
      .upsert(
        rolesToInsert.map((roleName) => ({ user_id: userId, role_name: roleName })),
        { onConflict: 'user_id,role_name' },
      );
    if (insertError) throw normalizeError(insertError, 'No se pudieron guardar los nuevos roles.');
  }

  if (rolesToDelete.length) {
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .in('role_name', rolesToDelete);
    if (deleteError) throw normalizeError(deleteError, 'No se pudieron retirar los roles anteriores.');
  }
}

export async function upsertSalon(salon) {
  assertSupabase();

  const { data, error } = await supabase
    .from('salons')
    .upsert([toDbSalon(salon)], { onConflict: 'id' })
    .select()
    .single();
  if (error) throw normalizeError(error, 'No se pudo guardar el negocio.');

  return toUiSalon(data);
}

export async function upsertBranch(branch) {
  assertSupabase();

  const { data, error } = await supabase
    .from('branches')
    .upsert([toDbBranch(branch)], { onConflict: 'id' })
    .select()
    .single();
  if (error) throw normalizeError(error, 'No se pudo guardar la sucursal.');

  return data;
}

export async function assignProfileSalon(userId, salonId) {
  assertSupabase();

  const { error } = await supabase
    .from('profiles')
    .update({ salon_id: salonId || null })
    .eq('id', userId);
  if (error) throw normalizeError(error, 'No se pudo asociar el usuario al negocio.');
}

export async function assignProfileBranch(userId, branchId) {
  assertSupabase();

  const { error } = await supabase
    .from('profiles')
    .update({ branch_id: branchId || null })
    .eq('id', userId);
  if (error) throw normalizeError(error, 'No se pudo asociar el usuario a la sucursal.');
}

export async function updateManagedUserProfile(userId, payload = {}) {
  assertSupabase();

  let nextSalonId = Object.prototype.hasOwnProperty.call(payload, 'salonId')
    ? payload.salonId || null
    : undefined;
  const nextBranchId = Object.prototype.hasOwnProperty.call(payload, 'branchId')
    ? payload.branchId || null
    : undefined;

  if (nextBranchId && !nextSalonId) {
    const { data: branchData, error: branchError } = await supabase
      .from('branches')
      .select('id, salon_id')
      .eq('id', nextBranchId)
      .maybeSingle();

    if (branchError) throw normalizeError(branchError, 'No se pudo validar la sucursal del usuario.');
    if (!branchData) throw normalizeError(null, 'La sucursal seleccionada no existe.');

    nextSalonId = branchData.salon_id || null;
  }

  if (nextBranchId) {
    await validateBranchBelongsToSalon(
      nextSalonId !== undefined ? nextSalonId : null,
      nextBranchId,
    );
  }

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'fullName')) {
    updates.full_name = payload.fullName || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'salonId')) {
    updates.salon_id = nextSalonId;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'branchId')) {
    updates.branch_id = nextBranchId;
  }

  if (!Object.keys(updates).length) return;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw normalizeError(error, 'No se pudo actualizar el perfil del usuario.');
}

export async function createManagedUser(payload, currentUserId = null) {
  assertSupabase();

  let normalizedPayload = { ...(payload || {}) };
  if (currentUserId) {
    const scope = await resolveUserScope(currentUserId);

    if (!scope.isSuperAdmin) {
      if (!scope.currentSalonId) {
        throw normalizeError(null, 'Tu usuario administrador no tiene un salón asignado.');
      }

      normalizedPayload = {
        ...normalizedPayload,
        salonId: scope.currentSalonId,
      };

      if (normalizedPayload.branchId) {
        await validateBranchBelongsToSalon(scope.currentSalonId, normalizedPayload.branchId);
      }
    } else if (normalizedPayload.branchId && normalizedPayload.salonId) {
      await validateBranchBelongsToSalon(normalizedPayload.salonId, normalizedPayload.branchId);
    }
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token || null;
  if (!accessToken) throw normalizeError(null, 'No se encontró una sesión válida para crear usuarios.');
  if (!supabaseUrl || !supabasePublishableKey) throw normalizeError(null, 'Falta la configuración de Supabase.');

  const response = await fetch(`${supabaseUrl}/functions/v1/create-system-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(normalizedPayload),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const backendMessage =
      body?.error ||
      body?.message ||
      body?.msg ||
      'La función devolvió un error al crear el usuario.';
    throw normalizeError(null, backendMessage);
  }

  if (body?.error) {
    throw normalizeError(body.error, body?.error?.error || body?.error?.message || 'No se pudo crear el usuario.');
  }

  return body;
}

export async function resetManagedUserPassword(payload) {
  assertSupabase();

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token || null;
  if (!accessToken) throw normalizeError(null, 'No se encontró una sesión válida para restablecer contraseñas.');
  if (!supabaseUrl || !supabasePublishableKey) throw normalizeError(null, 'Falta la configuración de Supabase.');

  const response = await fetch(`${supabaseUrl}/functions/v1/reset-system-user-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const backendMessage =
      body?.error ||
      body?.message ||
      body?.msg ||
      'La función devolvió un error al restablecer la contraseña.';
    throw normalizeError(null, backendMessage);
  }

  if (body?.error) {
    throw normalizeError(body.error, body?.error?.error || body?.error?.message || 'No se pudo restablecer la contraseña.');
  }

  return body;
}

export async function upsertStylists(stylists, salonId = null, branchId = null, currentUserId = null) {
  assertSupabase();
  if (!stylists?.length) return;

  let resolvedSalonId = salonId;
  let resolvedBranchId = branchId;
  let scope = null;

  if (currentUserId) {
    scope = await resolveUserScope(currentUserId);
    resolvedSalonId = resolvedSalonId || scope.currentSalonId || null;
    resolvedBranchId = resolvedBranchId ?? scope.currentBranchId ?? null;
  }

  const normalizedStylists = [];
  for (const stylist of stylists) {
    const stylistSalonId = stylist.salonId || resolvedSalonId || null;
    const stylistBranchId = stylist.branchId ?? resolvedBranchId ?? null;
    if (!stylistBranchId) {
      throw normalizeError(
        null,
        'Cada estilista debe tener una sucursal asignada antes de guardarse.',
      );
    }
    if (stylistBranchId && !stylistSalonId) {
      throw normalizeError(
        null,
        scope?.currentSalonId
          ? 'No se pudo resolver el salón del estilista antes de asignar la sucursal.'
          : 'Tu usuario no tiene un salón asignado. Asigna primero el salón del administrador.',
      );
    }
    await validateBranchBelongsToSalon(stylistSalonId, stylistBranchId);
    normalizedStylists.push({
      ...stylist,
      salonId: stylistSalonId,
      branchId: stylistBranchId,
    });
  }

  const { error } = await supabase
    .from('stylists')
    .upsert(
      normalizedStylists.map((stylist) => toDbStylist(stylist, stylist.salonId, stylist.branchId)),
      { onConflict: 'id' },
    );
  if (error) throw normalizeError(error, 'No se pudo guardar el estilista.');
}

export async function deleteStylistRecord(stylistId) {
  assertSupabase();
  const { error } = await supabase.from('stylists').delete().eq('id', stylistId);
  if (error) throw normalizeError(error, 'No se pudo eliminar el estilista.');
}

export async function upsertServices(services, salonId = null) {
  assertSupabase();
  if (!services?.length) return;

  const { error } = await supabase
    .from('services')
    .upsert(services.map((service) => toDbService(service, salonId)), { onConflict: 'id' });
  if (error) throw normalizeError(error, 'No se pudieron guardar los servicios.');
}

export async function upsertInventoryProducts(products, currentUserId, scopeOverride = {}) {
  assertSupabase();
  if (!products?.length) return [];

  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedSalonId = scope.currentSalonId || products.find((product) => product.salonId)?.salonId || null;
  const resolvedBranchId = scope.currentBranchId ?? products.find((product) => product.branchId !== undefined)?.branchId ?? null;

  if (!resolvedSalonId) throw normalizeError(null, 'No se pudo resolver el salón para guardar el producto.');

  const rows = products.map((product) => {
    const row = toDbInventoryProduct(product, resolvedSalonId, product.branchId ?? resolvedBranchId, currentUserId);
    return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
  });

  const { data, error } = await supabase
    .from('inventory_items')
    .upsert(rows, { onConflict: 'id' })
    .select('*');
  if (error) throw normalizeError(error, 'No se pudieron guardar los productos de inventario.');

  return (data || []).map(toUiInventoryItem);
}

export async function deleteInventoryProduct(productId) {
  assertSupabase();
  const { error } = await supabase
    .from('inventory_items')
    .update({ is_active: false })
    .eq('id', productId);
  if (error) throw normalizeError(error, 'No se pudo desactivar el producto de inventario.');
}

export async function syncServiceComboItems(services) {
  assertSupabase();
  const scopedServices = services || [];
  const comboServices = scopedServices.filter((service) => service.category === 'Combo');
  const scopedServiceIds = scopedServices.map((service) => service.id).filter(Boolean);
  if (!scopedServiceIds.length) return;

  const desiredRows = getComboRows(comboServices);
  const desiredKeys = new Set(desiredRows.map((row) => getComboRowKey(row.combo_service_id, row.item_service_id)));

  const { data: existingRows, error: existingRowsError } = await supabase
    .from('service_combo_items')
    .select('combo_service_id, item_service_id')
    .in('combo_service_id', scopedServiceIds);
  if (existingRowsError) throw normalizeError(existingRowsError, 'No se pudieron leer los combos actuales.');

  const normalizedExistingRows = existingRows || [];
  const existingKeys = new Set(normalizedExistingRows.map((row) => getComboRowKey(row.combo_service_id, row.item_service_id)));

  const rowsToInsert = desiredRows.filter((row) => !existingKeys.has(getComboRowKey(row.combo_service_id, row.item_service_id)));
  if (rowsToInsert.length) {
    const { error: insertError } = await supabase
      .from('service_combo_items')
      .insert(rowsToInsert);
    if (insertError) throw normalizeError(insertError, 'No se pudieron guardar los combos.');
  }

  const rowsToDelete = normalizedExistingRows.filter((row) => !desiredKeys.has(getComboRowKey(row.combo_service_id, row.item_service_id)));
  for (const row of rowsToDelete) {
    const { error: deleteError } = await supabase
      .from('service_combo_items')
      .delete()
      .eq('combo_service_id', row.combo_service_id)
      .eq('item_service_id', row.item_service_id);
    if (deleteError) throw normalizeError(deleteError, 'No se pudieron depurar los combos obsoletos.');
  }
}

export async function deleteServiceRecord(serviceId) {
  assertSupabase();
  const { error } = await supabase.from('services').delete().eq('id', serviceId);
  if (error) throw normalizeError(error, 'No se pudo eliminar el servicio.');
}

export async function openCashSession(payload = {}, currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedSalonId = payload.salonId || scope.currentSalonId || null;
  const resolvedBranchId = payload.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedSalonId) throw normalizeError(null, 'No se pudo resolver el salón para abrir caja.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para abrir caja.');
  await validateBranchBelongsToSalon(resolvedSalonId, resolvedBranchId);

  const existingSession = await fetchActiveCashSessionRow(resolvedSalonId, resolvedBranchId);
  if (existingSession) {
    throw normalizeError(null, 'Ya hay una caja abierta para esta sucursal.');
  }

  const { data, error } = await supabase.rpc('open_cash_session_atomic', {
    p_salon_id: resolvedSalonId,
    p_branch_id: resolvedBranchId,
    p_opened_by: currentUserId || null,
    p_opening_amount: Math.max(Number(payload.openingAmount || 0), 0),
    p_notes: payload.notes || null,
  });

  if (error) throw normalizeError(error, 'No se pudo abrir la caja.');

  return {
    session: toUiCashSession(data.session),
    movement: toUiCashMovement(data.movement),
  };
}

export async function createCashMovement(payload = {}, currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedSalonId = payload.salonId || scope.currentSalonId || null;
  const resolvedBranchId = payload.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedSalonId) throw normalizeError(null, 'No se pudo resolver el salón para registrar el movimiento.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para registrar el movimiento.');
  await validateBranchBelongsToSalon(resolvedSalonId, resolvedBranchId);

  const sessionRow = payload.cashSessionId
    ? await supabase
      .from('cash_sessions')
      .select('*')
      .eq('id', payload.cashSessionId)
      .eq('salon_id', resolvedSalonId)
      .eq('branch_id', resolvedBranchId)
      .eq('status', 'open')
      .is('closed_at', null)
      .maybeSingle()
    : { data: await fetchActiveCashSessionRow(resolvedSalonId, resolvedBranchId), error: null };
  if (sessionRow.error) throw normalizeError(sessionRow.error, 'No se pudo validar la caja abierta.');
  const cashSessionId = sessionRow.data?.id || null;
  if (!cashSessionId) throw normalizeError(null, 'Debes abrir caja antes de registrar movimientos.');

  const amount = Math.max(Number(payload.amount || 0), 0);
  if (amount <= 0) throw normalizeError(null, 'El monto del movimiento debe ser mayor a cero.');

  const movementType = payload.type === 'out' ? 'out' : 'in';
  const { data, error } = await supabase
    .from('cash_movements')
    .insert({
      cash_session_id: cashSessionId,
      salon_id: resolvedSalonId,
      branch_id: resolvedBranchId,
      type: movementType,
      movement_kind: 'manual',
      payment_method: 'cash',
      amount,
      notes: payload.notes || (movementType === 'out' ? 'Salida manual de caja' : 'Entrada manual de caja'),
      created_by: currentUserId || null,
    })
    .select('*')
    .single();

  if (error) throw normalizeError(error, 'No se pudo registrar el movimiento de caja.');
  return toUiCashMovement(data);
}

export async function createCashAuditMovement(payload = {}, currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedSalonId = payload.salonId || scope.currentSalonId || null;
  const resolvedBranchId = payload.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedSalonId) throw normalizeError(null, 'No se pudo resolver el salón para registrar auditoría de caja.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para registrar auditoría de caja.');
  if (!payload.cashSessionId) throw normalizeError(null, 'No se pudo resolver la caja para registrar auditoría.');
  await validateBranchBelongsToSalon(resolvedSalonId, resolvedBranchId);

  const amount = Math.max(Number(payload.amount || 0), 0);
  const { data, error } = await supabase
    .from('cash_movements')
    .insert({
      cash_session_id: payload.cashSessionId,
      salon_id: resolvedSalonId,
      branch_id: resolvedBranchId,
      type: payload.type === 'out' ? 'out' : 'in',
      movement_kind: payload.movementKind || 'closing_adjustment',
      payment_method: payload.paymentMethod || 'cash',
      amount,
      notes: payload.notes || 'Movimiento de auditoría',
      reference_type: payload.referenceType || null,
      reference_id: payload.referenceId || null,
      created_by: currentUserId || null,
    })
    .select('*')
    .single();

  if (error) throw normalizeError(error, 'No se pudo registrar el movimiento de auditoría.');
  return toUiCashMovement(data);
}

export async function closeCashSession(payload = {}, currentUserId, scopeOverride = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedSalonId = payload.salonId || scope.currentSalonId || null;
  const resolvedBranchId = payload.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedSalonId) throw normalizeError(null, 'No se pudo resolver el salón para cerrar caja.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para cerrar caja.');
  await validateBranchBelongsToSalon(resolvedSalonId, resolvedBranchId);

  const activeSession = payload.cashSessionId
    ? { id: payload.cashSessionId }
    : await fetchActiveCashSessionRow(resolvedSalonId, resolvedBranchId);
  const cashSessionId = activeSession?.id || null;
  if (!cashSessionId) throw normalizeError(null, 'No hay una caja abierta para cerrar.');

  const { data, error } = await supabase.rpc('close_cash_session_atomic', {
    p_cash_session_id: cashSessionId,
    p_salon_id: resolvedSalonId,
    p_branch_id: resolvedBranchId,
    p_closed_by: currentUserId || null,
    p_counted_cash_amount: Math.max(Number(payload.countedCashAmount ?? payload.closingAmount ?? 0), 0),
    p_notes: payload.notes || null,
  });

  if (error) throw normalizeError(error, 'No se pudo cerrar la caja.');
  return toUiCashSession(data);
}

export async function upsertAppointments(appointments, services, salonId = null, branchId = null, stylists = [], clients = []) {
  assertSupabase();
  if (!appointments?.length) return;

  const payload = appointments.map((appointment) => toDbAppointment(appointment, services, salonId, branchId, stylists, clients));
  const { error } = await supabase
    .from('appointments')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw normalizeError(error, 'No se pudo guardar la cita.');
}

export async function createPayrollPayment(payment, currentUserId, scopeOverride = {}) {
  assertSupabase();
  if (!payment) return null;

  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedSalonId = payment.salonId || scope.currentSalonId || null;
  const resolvedBranchId = payment.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedSalonId) throw normalizeError(null, 'No se pudo resolver el salón para registrar nómina.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para registrar nómina.');
  await validateBranchBelongsToSalon(resolvedSalonId, resolvedBranchId);

  const paymentDate = payment.paymentDate || new Date().toISOString();
  const appointmentIds = (payment.appointmentIds || [])
    .filter(Boolean)
    .map((id) => String(id));

  const paymentPayload = {
    salon_id: resolvedSalonId,
    branch_id: resolvedBranchId,
    stylist_id: payment.stylistId || null,
    payment_scope: payment.paymentScope || 'individual',
    period_start: payment.periodStart || null,
    period_end: payment.periodEnd || null,
    payment_date: paymentDate,
    payment_method: payment.paymentMethod || 'cash',
    base_amount: Number(payment.baseAmount || 0),
    commission_amount: Number(payment.commissionAmount || 0),
    total_amount: Number(payment.totalAmount || 0),
    services_count: Number(payment.servicesCount || 0),
    sales_total: Number(payment.salesTotal || 0),
    commission_rate: Number(payment.commissionRate || 0),
    notes: payment.notes || null,
    status: payment.status || 'paid',
    created_by: currentUserId || null,
  };

  const { data: paymentRow, error: paymentError } = await supabase
    .from('payroll_payments')
    .insert(paymentPayload)
    .select('*')
    .single();
  if (paymentError) throw normalizeError(paymentError, 'No se pudo registrar el pago de nómina.');

  const itemPayload = (payment.items || []).map((item) => ({
    payroll_payment_id: paymentRow.id,
    appointment_id: item.appointmentId || null,
    stylist_id: item.stylistId || payment.stylistId || null,
    service_name: item.serviceName || null,
    service_amount: Number(item.serviceAmount || 0),
    commission_rate: Number(item.commissionRate || payment.commissionRate || 0),
    commission_amount: Number(item.commissionAmount || 0),
  }));

  let itemRows = [];
  if (itemPayload.length) {
    const { data, error } = await supabase
      .from('payroll_payment_items')
      .insert(itemPayload)
      .select('*');
    if (error) throw normalizeError(error, 'No se pudo registrar el detalle de nómina.');
    itemRows = data || [];
  }

  if (appointmentIds.length) {
    const { error } = await supabase
      .from('appointments')
      .update({ is_paid: true, paid_at: paymentDate })
      .in('id', appointmentIds)
      .eq('salon_id', resolvedSalonId);
    if (error) throw normalizeError(error, 'No se pudieron marcar los servicios como pagados.');
  }

  return toUiPayrollPayment({
    ...paymentRow,
    payroll_payment_items: itemRows,
  });
}

export async function createPosSale(sale, currentUserId, scopeOverride = {}) {
  assertSupabase();
  if (!sale) return null;

  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedSalonId = sale.salonId || scope.currentSalonId || null;
  const resolvedBranchId = sale.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedSalonId) {
    throw normalizeError(null, 'No se pudo resolver el salón para registrar la venta.');
  }

  if (!resolvedBranchId) {
    throw normalizeError(null, 'No se pudo resolver la sucursal para registrar la venta.');
  }

  await validateBranchBelongsToSalon(resolvedSalonId, resolvedBranchId);

  const activeCashSession = sale.cashSessionId
    ? await supabase
      .from('cash_sessions')
      .select('*')
      .eq('id', sale.cashSessionId)
      .eq('salon_id', resolvedSalonId)
      .eq('branch_id', resolvedBranchId)
      .eq('status', 'open')
      .is('closed_at', null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) throw normalizeError(error, 'No se pudo validar la caja abierta.');
        return data;
      })
    : await fetchActiveCashSessionRow(resolvedSalonId, resolvedBranchId);
  if (!activeCashSession?.id) {
    throw normalizeError(null, 'Debes abrir caja antes de registrar ventas.');
  }

  const payload = toDbPosSale(
    { ...sale, cashSessionId: activeCashSession.id, paymentMethod: sale.paymentMethod || 'cash' },
    resolvedSalonId,
    resolvedBranchId,
    currentUserId,
  );
  const { data, error } = await supabase.rpc('register_pos_sale_atomic', {
    p_sale_id: payload.id || null,
    p_salon_id: resolvedSalonId,
    p_branch_id: resolvedBranchId,
    p_cash_session_id: activeCashSession.id,
    p_payment_method: payload.payment_method || 'cash',
    p_raw_subtotal: Number(payload.raw_subtotal || 0),
    p_discount_total: Number(payload.discount_total || 0),
    p_subtotal: Number(payload.subtotal || 0),
    p_product_total: Number(payload.product_total || 0),
    p_service_total: Number(payload.service_total || 0),
    p_items: payload.items || [],
    p_promotion_id: payload.promotion_id || null,
    p_promotion_name: payload.promotion_name || null,
    p_discount_label: payload.discount_label || null,
    p_notes: payload.notes || null,
    p_client_id: payload.client_id || null,
    p_client_name: payload.client_name || null,
    p_created_by: currentUserId || null,
  });

  if (error) throw normalizeError(error, 'No se pudo registrar la venta de POS.');

  return {
    ...sale,
    ...toUiPosSale(data.sale),
    cashMovement: data.movement ? toUiCashMovement(data.movement) : null,
    ticketNumber: Number(data.sale?.ticket_number ?? sale.ticketNumber ?? 0),
  };
}

export async function deletePosSaleRecord(saleId, currentUserId, scopeOverride = {}, saleScope = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedSalonId = saleScope.salonId || scope.currentSalonId || null;
  const resolvedBranchId = saleScope.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedSalonId) throw normalizeError(null, 'No se pudo resolver el salón para cancelar la venta.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para cancelar la venta.');
  await validateBranchBelongsToSalon(resolvedSalonId, resolvedBranchId);

  const { error } = await supabase.rpc('cancel_pos_sale_atomic', {
    p_sale_id: saleId,
    p_salon_id: resolvedSalonId,
    p_branch_id: resolvedBranchId,
  });
  if (error) throw normalizeError(error, 'No se pudo cancelar la venta de POS.');
}

export async function cancelPosSaleWithReversal(sale, reason = '', currentUserId, scopeOverride = {}) {
  assertSupabase();
  if (!sale?.id) throw normalizeError(null, 'No se pudo resolver la venta para anular.');
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedSalonId = sale.salonId || scope.currentSalonId || null;
  const resolvedBranchId = sale.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedSalonId) throw normalizeError(null, 'No se pudo resolver el salón para cancelar la venta.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para cancelar la venta.');
  await validateBranchBelongsToSalon(resolvedSalonId, resolvedBranchId);

  const canceledAt = new Date().toISOString();
  const cancellationPayload = {
    source: 'cancel_pos_sale',
    previousNotes: sale.notes || '',
    canceledAt,
    canceledBy: currentUserId || null,
    cancellationReason: reason || 'Sin motivo especificado',
  };

  const { data: updatedSales, error: saleError } = await supabase
    .from('pos_sales')
    .update({ notes: JSON.stringify(cancellationPayload) })
    .eq('id', sale.id)
    .eq('salon_id', resolvedSalonId)
    .eq('branch_id', resolvedBranchId)
    .select('*');
  if (saleError) throw normalizeError(saleError, 'No se pudo marcar la venta como anulada.');
  const updatedSale = Array.isArray(updatedSales) && updatedSales.length > 0
    ? toUiPosSale(updatedSales[0])
    : {
      ...sale,
      notes: JSON.stringify(cancellationPayload),
      canceledAt,
      canceledBy: currentUserId || null,
      cancellationReason: reason || 'Sin motivo especificado',
    };

  const movement = await createCashAuditMovement({
    cashSessionId: sale.cashSessionId,
    salonId: resolvedSalonId,
    branchId: resolvedBranchId,
    type: 'out',
    movementKind: 'sale',
    paymentMethod: sale.paymentMethod || 'cash',
    amount: Number(sale.subtotal || 0),
    notes: `Anulación venta POS #${sale.ticketNumber || ''} - ${reason || 'Sin motivo'}`,
    referenceType: 'pos_sale_void',
    referenceId: sale.id,
    ticketNumber: sale.ticketNumber || 0,
  }, currentUserId, scopeOverride);

  return {
    sale: updatedSale,
    movement,
  };
}

export async function deleteCashMovementRecord(movementId, currentUserId, scopeOverride = {}, movementScope = {}) {
  assertSupabase();
  const scope = await resolveUserScope(currentUserId, scopeOverride);
  const resolvedSalonId = movementScope.salonId || scope.currentSalonId || null;
  const resolvedBranchId = movementScope.branchId ?? scope.currentBranchId ?? null;

  if (!resolvedSalonId) throw normalizeError(null, 'No se pudo resolver el salón para anular el movimiento.');
  if (!resolvedBranchId) throw normalizeError(null, 'No se pudo resolver la sucursal para anular el movimiento.');
  await validateBranchBelongsToSalon(resolvedSalonId, resolvedBranchId);

  const { error } = await supabase.rpc('cancel_cash_movement_atomic', {
    p_movement_id: movementId,
    p_salon_id: resolvedSalonId,
    p_branch_id: resolvedBranchId,
  });
  if (error) throw normalizeError(error, 'No se pudo anular el movimiento de caja.');
}
