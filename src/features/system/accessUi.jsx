import React, { useEffect, useMemo, useState } from 'react';
import {
  Edit2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { PASSWORD_MIN_LENGTH, ROLE_META, getPrimaryRole, styleTag } from '../app/shared';

const getDisplayErrorMessage = (error, fallback = 'Ocurrió un problema inesperado.') => {
  if (!error) return fallback;
  if (typeof error === 'string') {
    const normalized = error.trim();
    if (!normalized || normalized === '{}' || normalized === '[]' || normalized === 'null' || normalized === 'undefined') {
      return fallback;
    }
    return normalized;
  }

  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim();
  if (typeof error?.error_description === 'string' && error.error_description.trim()) return error.error_description.trim();
  if (typeof error?.details === 'string' && error.details.trim()) return error.details.trim();

  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== '{}' ? serialized : fallback;
  } catch {
    return fallback;
  }
};

export function LoginScreen({ onSignIn, authBusy, authError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const displayError = localError || getDisplayErrorMessage(authError, '');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');

    if (!email.trim()) {
      setLocalError('Ingresa tu correo.');
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setLocalError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      await onSignIn(email.trim(), password);
    } catch (error) {
      setLocalError(getDisplayErrorMessage(error, 'No pude iniciar sesión. Intenta de nuevo.'));
    }
  };

  return (
    <div className="min-h-screen bg-[#171012] text-white flex items-center justify-center p-3 md:p-5 overflow-y-auto">
      <style>{styleTag}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(216,181,106,0.22),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(209,111,146,0.2),transparent_26%),radial-gradient(circle_at_50%_95%,rgba(133,170,148,0.16),transparent_30%),linear-gradient(145deg,#171012_0%,#24181e_52%,#151012_100%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.16] pointer-events-none bg-[linear-gradient(90deg,rgba(251,245,239,0.08)_1px,transparent_1px),linear-gradient(rgba(251,245,239,0.06)_1px,transparent_1px)] bg-[size:54px_54px]" />
      <div className="relative w-full max-w-6xl grid lg:grid-cols-[1.02fr_0.98fr] rounded-[2.2rem] overflow-hidden border border-[#efb5c8]/25 shadow-[0_30px_90px_rgba(15,8,11,0.78)] lg:h-[min(860px,calc(100vh-2.5rem))]">
        <div
          className="relative min-h-[420px] sm:min-h-[540px] lg:min-h-0 lg:h-full overflow-hidden bg-[#140c10] bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/salon-login-bg.png')" }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,12,16,0)_0%,rgba(20,12,16,0.04)_55%,rgba(20,12,16,0.72)_100%)]" />
        </div>

        <div className="relative bg-[#181113] flex items-center overflow-y-auto custom-scrollbar">
          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(232,219,224,0.26) 1px, transparent 0)',
              backgroundSize: '14px 14px',
            }}
          />
          <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[#d8b56a]/55 to-transparent" />
          <div className="relative z-10 w-full p-7 md:p-10 lg:p-12">
            <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto space-y-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-[#ead49a] italic">SalonPro Studio</p>
                <h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-[-0.05em] mt-3 text-white drop-shadow-[0_0_22px_rgba(209,111,146,0.34)]">
                  Bienvenida
                </h2>
              </div>

              {displayError && (
                <div className="bg-rose-500/10 border border-rose-400/30 rounded-[1.6rem] px-5 py-4 text-[11px] font-black uppercase italic leading-relaxed text-rose-200 shadow-[0_0_18px_rgba(244,63,94,0.18)]">
                  {displayError}
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-[0.24em] text-[#ead49a] italic flex items-center gap-2">
                  <Mail size={14} className="text-[#d8b66d]" /> Correo
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  className="w-full bg-[#fbf5ef] border border-[#d8b56a]/60 rounded-[1.6rem] px-6 py-4 text-base font-black text-[#24191f] outline-none placeholder:text-[#9b8790] shadow-[0_16px_34px_rgba(10,6,8,0.2)] focus:border-[#efb5c8] focus:shadow-[0_0_38px_rgba(209,111,146,0.24)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu-correo@ejemplo.com"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase tracking-[0.24em] text-[#ead49a] italic flex items-center gap-2">
                  <Lock size={14} className="text-[#d8b66d]" /> Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="w-full bg-[#fbf5ef] border border-[#d8b56a]/60 rounded-[1.6rem] pl-6 pr-16 py-4 text-base font-black text-[#24191f] outline-none placeholder:text-[#9b8790] shadow-[0_16px_34px_rgba(10,6,8,0.2)] focus:border-[#efb5c8] focus:shadow-[0_0_38px_rgba(209,111,146,0.24)]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tu contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-[#a94f70] hover:text-[#c96f8d] transition-all"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authBusy}
                className="w-full bg-gradient-to-r from-[#f27dad] via-[#e66fa2] to-[#d85f97] hover:from-[#ee73a7] hover:via-[#dc6399] hover:to-[#cc548d] disabled:opacity-60 text-white py-4 rounded-[1.75rem] font-black uppercase italic text-sm tracking-[0.32em] transition-all shadow-[0_18px_38px_rgba(216,95,151,0.28)] flex items-center justify-center gap-3"
              >
                {authBusy ? <Loader2 size={18} className="animate-spin" /> : <UserCheck size={18} />}
                {authBusy ? 'Validando acceso' : 'Entrar al sistema'}
              </button>

              <div className="pt-5 border-t border-white/8">
                <p className="text-sm text-slate-500 leading-relaxed">
                  Si una cuenta nueva no aparece aquí, primero debe iniciar sesión una vez para que puedas asignarle su rol y salón.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PasswordActionModal({
  title,
  subtitle,
  submitLabel,
  busy,
  onClose,
  onSubmit,
  showCurrentPassword = false,
  currentLabel = 'Contraseña actual',
  nextLabel = 'Nueva contraseña',
  nextPlaceholder = 'Mínimo 6 caracteres',
  initialNextPassword = '',
  initialConfirmPassword = '',
  nextInputType = 'password',
  confirmInputType = 'password',
  lockOpen = false,
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState(initialNextPassword);
  const [confirmPassword, setConfirmPassword] = useState(initialConfirmPassword);
  const [localError, setLocalError] = useState('');
  const [localBusy, setLocalBusy] = useState(false);

  useEffect(() => {
    setNextPassword(initialNextPassword);
    setConfirmPassword(initialConfirmPassword);
    setLocalError('');
    setLocalBusy(false);
  }, [initialNextPassword, initialConfirmPassword]);

  const trimmedCurrentPassword = currentPassword.trim();
  const trimmedNextPassword = nextPassword.trim();
  const trimmedConfirmPassword = confirmPassword.trim();
  const isNextPasswordValid = trimmedNextPassword.length >= 6;
  const isConfirmPasswordValid = trimmedConfirmPassword.length > 0 && trimmedNextPassword === trimmedConfirmPassword;

  const handleSubmit = async () => {
    if (busy || localBusy) return;
    setLocalError('');

    if (showCurrentPassword && !trimmedCurrentPassword) {
      setLocalError('Ingresa tu contraseña actual.');
      return;
    }

    if (!trimmedNextPassword || trimmedNextPassword.length < 6) {
      setLocalError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (trimmedNextPassword !== trimmedConfirmPassword) {
      setLocalError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setLocalBusy(true);
    try {
      const success = await onSubmit({
        currentPassword: trimmedCurrentPassword,
        nextPassword: trimmedNextPassword,
      });

      if (success === false) {
        setLocalError('No se pudo guardar la contraseña. Intenta de nuevo.');
      }
    } catch (error) {
      setLocalError(error?.message || 'No se pudo guardar la contraseña. Intenta de nuevo.');
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-xl bg-slate-950 border border-white/10 rounded-[2.6rem] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
        <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[1.3rem] bg-indigo-600 flex items-center justify-center text-white shadow-[0_0_24px_rgba(201,111,141,0.32)]">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">{title}</h3>
              {subtitle && (
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300 mt-2 leading-none">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {!lockOpen && (
            <button
              type="button"
              onClick={onClose}
              className="p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
          className="p-8 space-y-6"
        >
          {localError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-[1.6rem] px-5 py-4 text-[11px] font-black uppercase italic leading-relaxed text-rose-300">
              {localError}
            </div>
          )}

          {showCurrentPassword && (
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{currentLabel}</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                placeholder="Tu contraseña actual"
              />
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{nextLabel}</label>
            <input
              type={nextInputType}
              value={nextPassword}
              onChange={(e) => setNextPassword(e.target.value)}
              className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
              placeholder={nextPlaceholder}
            />
            {!isNextPasswordValid && nextPassword.length > 0 && (
              <p className="text-[11px] font-bold text-amber-300">Debe tener al menos 6 caracteres.</p>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Confirmar contraseña</label>
            <input
              type={confirmInputType}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
              placeholder="Repite la contraseña"
            />
            {confirmPassword.length > 0 && !isConfirmPasswordValid && (
              <p className="text-[11px] font-bold text-amber-300">La confirmación debe coincidir exactamente.</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={busy || localBusy}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-4 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all flex items-center justify-center gap-3"
            >
              {(busy || localBusy) ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {submitLabel}
            </button>
            {!lockOpen && (
              <button
                type="button"
                onClick={onClose}
                className="sm:w-auto px-8 py-4 rounded-[1.6rem] bg-slate-900 border border-slate-800 text-white font-black uppercase italic text-[11px] tracking-[0.22em]"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export function UserEditorModal({
  user,
  roleOptions,
  salons,
  branches,
  isSuperAdmin,
  busy,
  onClose,
  onSubmit,
}) {
  const buildInitialForm = () => ({
    fullName: user?.fullName || '',
    roleName: getPrimaryRole(user) || 'cashier',
    salonId: user?.salonId || '',
    branchId: user?.branchId || '',
  });
  const [form, setForm] = useState(buildInitialForm);
  const [localError, setLocalError] = useState('');

  const branchOptions = useMemo(() => {
    if (!form.salonId) return [];
    return (branches || []).filter((branch) => String(branch.salonId || '') === String(form.salonId));
  }, [branches, form.salonId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');

    if (!form.fullName.trim()) {
      setLocalError('Ingresa el nombre del usuario.');
      return;
    }

    if (!form.roleName) {
      setLocalError('Selecciona un rol.');
      return;
    }

    if (isSuperAdmin && !form.salonId) {
      setLocalError('Selecciona el salón del usuario.');
      return;
    }

    try {
      const success = await onSubmit({
        fullName: form.fullName.trim(),
        roleName: form.roleName,
        salonId: form.salonId || null,
        branchId: form.branchId || null,
      });
      if (success) onClose();
    } catch (error) {
      setLocalError(error?.message || 'No se pudo actualizar el usuario.');
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl bg-slate-950 border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] text-white max-h-[88vh] overflow-y-auto custom-scrollbar">
        <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-[1.6rem] bg-indigo-600 flex items-center justify-center text-white shadow-[0_0_30px_rgba(201,111,141,0.32)]">
              <Edit2 size={24} />
            </div>
            <div>
              <h3 className="text-[2rem] font-black uppercase italic tracking-tighter text-white leading-none">
                Editar usuario
              </h3>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300 mt-2 leading-none">
                Configuración de acceso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 grid grid-cols-1 gap-6">
          {localError && (
            <div className="rounded-[1.4rem] border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-[12px] font-bold text-rose-300">
              {localError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-8">
            <div className="rounded-[2.2rem] border border-white/5 bg-black/20 px-7 py-8 text-center">
              <div className="w-24 h-24 mx-auto rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-[0_0_30px_rgba(201,111,141,0.32)]">
                {(form.fullName || user?.email || 'U').trim().slice(0, 1).toUpperCase()}
              </div>
              <h4 className="mt-6 text-3xl font-black uppercase italic tracking-tighter text-white break-words">
                {form.fullName || 'Usuario'}
              </h4>
              <p className="mt-3 text-sm font-bold text-slate-400 break-all">
                {user?.email || 'Sin correo'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Nombre completo</label>
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Correo</label>
                <div className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-slate-300 italic break-all">
                  {user?.email || 'Sin correo'}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Rol</label>
                <select
                  value={form.roleName}
                  onChange={(e) => setForm((prev) => ({ ...prev, roleName: e.target.value }))}
                  className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                >
                  {roleOptions.map((role) => (
                    <option key={role.roleName} value={role.roleName}>
                      {ROLE_META[role.roleName]?.label || role.roleName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Fecha de alta</label>
                <div className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-slate-300 italic">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin fecha'}
                </div>
              </div>

              {isSuperAdmin && (
                <div className="space-y-3 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Salón</label>
                  <select
                    value={form.salonId}
                    onChange={(e) => setForm((prev) => ({ ...prev, salonId: e.target.value, branchId: '' }))}
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    <option value="">Selecciona un salón</option>
                    {(salons || []).map((shop) => (
                      <option key={shop.id} value={shop.id}>{shop.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-3 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Sucursal</label>
                <select
                  value={form.branchId}
                  onChange={(e) => setForm((prev) => ({ ...prev, branchId: e.target.value }))}
                  className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                >
                  <option value="">General / sin sucursal</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all flex items-center justify-center gap-3 shadow-[0_12px_30px_rgba(201,111,141,0.24)]"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar cambios
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sm:w-[220px] bg-slate-900 border border-slate-800 hover:border-slate-700 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
