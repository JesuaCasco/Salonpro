import React, { useMemo, useState } from 'react';
import { Gift, Package, Plus, Scissors, Sparkles, Trash2, X, Zap } from 'lucide-react';

import {
  CATEGORY_LABELS,
  CATEGORIES,
  clampPromotionDiscountValue,
  isPromotionService,
} from './shared';

export function ServiceEditorModal({ services, inventoryItems = [], onClose, onSave, initial }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '',
    price: initial?.price || '',
    category: initial?.category || 'Cabello',
    items: initial?.items || [],
    inventoryUsage: initial?.inventoryUsage || [],
    appliesTo: initial?.appliesTo || 'General',
    discountType: initial?.discountType || 'percentage',
    discountValue: initial?.discountValue !== undefined && initial?.discountValue !== null
      ? String(clampPromotionDiscountValue(initial?.discountType || 'percentage', initial.discountValue))
      : '',
    isOptional: initial?.isOptional ?? true,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [supplySearch, setSupplySearch] = useState('');

  const isPromotion = formData.category === 'Promocion';
  const isCombo = formData.category === 'Combo';
  const canConfigureSupplies = !isPromotion && !isCombo && formData.category !== 'Producto';
  const serviceCategories = useMemo(
    () => CATEGORIES.filter((category) => category !== 'Producto'),
    [],
  );
  const availableItems = useMemo(
    () => (services || []).filter((service) => (
      service.name.toLowerCase().includes(searchTerm.toLowerCase())
      && service.category !== 'Combo'
      && service.category !== 'Producto'
      && !isPromotionService(service)
    )),
    [services, searchTerm],
  );
  const supplyItems = useMemo(
    () => (inventoryItems || []).filter((item) => {
      const isSupply = ['internal', 'both'].includes(item.usageType || 'retail');
      const matches = [item.productName, item.name, item.productCategory, item.sku]
        .some((value) => String(value || '').toLowerCase().includes(supplySearch.toLowerCase()));
      return isSupply && matches && item.isActive !== false;
    }),
    [inventoryItems, supplySearch],
  );
  const supplyById = useMemo(
    () => new Map((inventoryItems || []).map((item) => [String(item.id), item])),
    [inventoryItems],
  );

  const calculateComboPrice = (items) => (
    (items || []).reduce((acc, itemId) => {
      const itemPrice = Number(services.find((service) => service.id === itemId)?.price || 0);
      return acc + itemPrice;
    }, 0)
  );

  const toggleItem = (id) => {
    const newItems = formData.items.includes(id)
      ? formData.items.filter((itemId) => itemId !== id)
      : [...formData.items, id];
    const newPrice = formData.category === 'Combo'
      ? calculateComboPrice(newItems)
      : Number(formData.price || 0);

    setFormData({ ...formData, items: newItems, price: newPrice });
  };

  const addSupply = (item) => {
    if (formData.inventoryUsage.some((usage) => String(usage.inventoryItemId) === String(item.id))) return;
    setFormData((prev) => ({
      ...prev,
      inventoryUsage: [
        ...prev.inventoryUsage,
        { inventoryItemId: item.id, quantity: 1 },
      ],
    }));
  };

  const updateSupplyQuantity = (inventoryItemId, quantity) => {
    setFormData((prev) => ({
      ...prev,
      inventoryUsage: prev.inventoryUsage.map((usage) => (
        String(usage.inventoryItemId) === String(inventoryItemId)
          ? { ...usage, quantity }
          : usage
      )),
    }));
  };

  const removeSupply = (inventoryItemId) => {
    setFormData((prev) => ({
      ...prev,
      inventoryUsage: prev.inventoryUsage.filter((usage) => String(usage.inventoryItemId) !== String(inventoryItemId)),
    }));
  };

  const supplyCost = useMemo(
    () => formData.inventoryUsage.reduce((sum, usage) => {
      const item = supplyById.get(String(usage.inventoryItemId));
      return sum + (Number(usage.quantity || 0) * Number(item?.costPrice || 0));
    }, 0),
    [formData.inventoryUsage, supplyById],
  );
  const estimatedMargin = Math.max(Number(formData.price || 0) - supplyCost, 0);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#24181f]/80 p-4 backdrop-blur-xl animate-in fade-in text-[#302530] no-print">
      <div className="w-full max-w-5xl max-h-[95vh] overflow-hidden rounded-[2rem] border border-[#ee9fbc] bg-white shadow-[0_30px_90px_rgba(52,31,42,0.38)] animate-in zoom-in-95 flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-[#f2c1d4] bg-[#fff7fb] px-5 md:px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d94f83] text-white shadow-[0_14px_30px_rgba(217,79,131,0.25)]">
              {isCombo ? <Zap size={26} /> : isPromotion ? <Gift size={26} /> : formData.category === 'Producto' ? <Package size={26} /> : ['Uñas', 'Facial', 'Tratamientos'].includes(formData.category) ? <Sparkles size={26} /> : <Scissors size={26} />}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d94f83]">Catálogo de salón</p>
              <h3 className="mt-1 text-2xl font-black uppercase italic tracking-tighter leading-none text-[#302530]">{initial?.id ? 'Editar servicio' : 'Nuevo servicio'}</h3>
            </div>
          </div>
          <button onClick={onClose} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#ee9fbc] bg-white text-[#9b6076] transition-all hover:bg-[#fff7fb]">
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const normalizedDiscountValue = clampPromotionDiscountValue(
              formData.discountType || 'percentage',
              formData.discountValue,
            );
            const normalized = {
              ...formData,
              price: formData.category === 'Promocion' ? 0 : Number(formData.price) || 0,
              discountValue: normalizedDiscountValue,
              items: formData.category === 'Combo' ? formData.items : [],
              inventoryUsage: canConfigureSupplies
                ? formData.inventoryUsage
                  .map((usage) => ({
                    ...usage,
                    quantity: Number(usage.quantity || 0),
                  }))
                  .filter((usage) => usage.inventoryItemId && usage.quantity > 0)
                : [],
              targetServiceIds: [],
            };
            onSave(normalized);
          }}
          className="flex-1 overflow-y-auto custom-scrollbar"
        >
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 p-5 md:p-8">
            <div className="space-y-5">
              <section className="rounded-[1.8rem] border border-[#f2c1d4] bg-white p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-2">
                    <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#9b6076]">Categoría</span>
                    <select
                      className="w-full rounded-2xl border border-[#ee9fbc] bg-[#fff7fb] px-5 py-4 text-sm font-black uppercase italic text-[#302530] outline-none focus:border-[#d94f83]"
                      value={formData.category}
                      onChange={(event) => setFormData({
                        ...formData,
                        category: event.target.value,
                        items: event.target.value === 'Combo' ? formData.items : [],
                        inventoryUsage: ['Combo', 'Promocion', 'Producto'].includes(event.target.value) ? [] : formData.inventoryUsage,
                      })}
                    >
                      {serviceCategories.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category] || category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#9b6076]">Nombre</span>
                    <input
                      required
                      placeholder={isPromotion ? 'Ej. Servicio gratis por fidelidad' : 'Ej. Tinte, manicure o tratamiento'}
                      className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-5 py-4 text-sm font-black uppercase italic text-[#302530] outline-none focus:border-[#d94f83]"
                      value={formData.name}
                      onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    />
                  </label>
                </div>

                {!isPromotion ? (
                  <label className="mt-5 block space-y-2">
                    <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#9b6076]">Precio final (C$)</span>
                    <div className="relative">
                      <input
                        required
                        type="number"
                        className="w-full rounded-[1.8rem] border border-[#ee9fbc] bg-[#fff7fb] py-6 pl-20 pr-8 text-4xl font-black italic leading-none text-[#302530] outline-none focus:border-[#6fb89b]"
                        value={formData.price}
                        onChange={(event) => setFormData({ ...formData, price: event.target.value ? Number(event.target.value) : 0 })}
                      />
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 text-2xl font-black italic leading-none text-[#4f8674]">C$</span>
                    </div>
                  </label>
                ) : null}
              </section>

              {isPromotion ? (
                <section className="space-y-5 rounded-[1.8rem] border border-[#b7d8c7] bg-[#edf7f2] p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#4f8674]">Cobertura</span>
                      <input readOnly value="GENERAL" className="w-full rounded-2xl border border-[#b7d8c7] bg-white px-5 py-4 text-sm font-black uppercase italic text-[#302530] outline-none" />
                    </label>
                    <label className="space-y-2">
                      <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#4f8674]">Tipo de descuento</span>
                      <select
                        className="w-full rounded-2xl border border-[#b7d8c7] bg-white px-5 py-4 text-sm font-black uppercase italic text-[#302530] outline-none focus:border-[#6fb89b]"
                        value={formData.discountType}
                        onChange={(event) => setFormData({
                          ...formData,
                          discountType: event.target.value,
                          discountValue: String(clampPromotionDiscountValue(event.target.value, formData.discountValue)),
                        })}
                      >
                        <option value="percentage">Porcentaje</option>
                        <option value="fixed">Monto fijo</option>
                      </select>
                    </label>
                  </div>
                  <label className="block space-y-2">
                    <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#4f8674]">
                      {formData.discountType === 'fixed' ? 'Descuento en córdobas' : 'Porcentaje de descuento'}
                    </span>
                    <input
                      required
                      type="text"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-[#b7d8c7] bg-white px-5 py-4 text-lg font-black italic text-[#302530] outline-none focus:border-[#6fb89b]"
                      value={formData.discountValue}
                      onChange={(event) => {
                        const rawValue = event.target.value.replace(',', '.');
                        if (!/^\d*\.?\d*$/.test(rawValue)) return;
                        if (rawValue === '') {
                          setFormData({ ...formData, discountValue: '' });
                          return;
                        }
                        setFormData({ ...formData, discountValue: String(clampPromotionDiscountValue(formData.discountType, rawValue)) });
                      }}
                    />
                  </label>
                </section>
              ) : null}

              {isCombo ? (
                <section className="space-y-4 rounded-[1.8rem] border border-[#f2c1d4] bg-[#fff7fb] p-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d94f83]">Componer combo</p>
                    <p className="mt-1 text-[11px] font-bold text-[#856a75]">Selecciona servicios para calcular el precio base.</p>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar ítems"
                    className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-5 py-4 text-xs font-black uppercase italic text-[#302530] outline-none"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {availableItems.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${formData.items.includes(item.id) ? 'border-[#6fb89b] bg-[#edf7f2]' : 'border-[#ee9fbc] bg-white'}`}
                      >
                        <span className="text-[11px] font-black uppercase italic text-[#302530]">{item.name}</span>
                        <span className="text-[11px] font-black italic text-[#4f8674]">C$ {item.price}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {canConfigureSupplies ? (
                <section className="space-y-4 rounded-[1.8rem] border border-[#f2c1d4] bg-[#fff7fb] p-5">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d94f83]">Insumos del servicio</p>
                      <p className="mt-1 text-[11px] font-bold text-[#856a75]">Configura lo que se descontará del inventario al cobrar.</p>
                    </div>
                    <div className="rounded-2xl border border-[#b7d8c7] bg-white px-4 py-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#4f8674]">Costo estimado</p>
                      <p className="text-lg font-black italic text-[#2f6f61]">C$ {supplyCost.toLocaleString('es-NI')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Buscar insumo"
                        className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-5 py-4 text-xs font-black uppercase italic text-[#302530] outline-none"
                        value={supplySearch}
                        onChange={(event) => setSupplySearch(event.target.value)}
                      />
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {supplyItems.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => addSupply(item)}
                            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#ee9fbc] bg-white p-3 text-left transition-all hover:bg-[#fff7fb]"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-black uppercase italic text-[#302530]">{item.productName || item.name}</p>
                              <p className="mt-1 text-[9px] font-bold uppercase text-[#856a75]">{item.productCategory || 'Insumo'} · {item.unitName || 'unidad'}</p>
                            </div>
                            <Plus size={16} className="shrink-0 text-[#d94f83]" />
                          </button>
                        ))}
                        {!supplyItems.length && (
                          <div className="rounded-2xl border border-dashed border-[#ee9fbc] bg-white p-5 text-center text-[10px] font-black uppercase tracking-[0.14em] text-[#9b6076]">
                            No hay insumos disponibles
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                      {formData.inventoryUsage.map((usage) => {
                        const item = supplyById.get(String(usage.inventoryItemId));
                        return (
                          <div key={usage.inventoryItemId} className="rounded-2xl border border-[#ee9fbc] bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-black uppercase italic text-[#302530]">{item?.productName || item?.name || 'Insumo'}</p>
                                <p className="mt-1 text-[9px] font-bold uppercase text-[#856a75]">Costo unitario C$ {Number(item?.costPrice || 0).toLocaleString('es-NI')}</p>
                              </div>
                              <button type="button" onClick={() => removeSupply(usage.inventoryItemId)} className="rounded-xl border border-[#f2c1d4] p-2 text-[#d94f83]">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={usage.quantity}
                                onChange={(event) => updateSupplyQuantity(usage.inventoryItemId, event.target.value)}
                                className="w-full rounded-xl border border-[#ee9fbc] bg-[#fff7fb] px-4 py-3 text-sm font-black text-[#302530] outline-none"
                              />
                              <span className="text-[10px] font-black uppercase text-[#856a75]">{item?.unitName || 'unidad'}</span>
                            </div>
                          </div>
                        );
                      })}
                      {!formData.inventoryUsage.length && (
                        <div className="rounded-2xl border border-dashed border-[#ee9fbc] bg-white p-8 text-center text-[10px] font-black uppercase tracking-[0.14em] text-[#9b6076]">
                          Este servicio todavía no tiene insumos
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-4">
              <div className="rounded-[1.8rem] border border-[#b7d8c7] bg-[#edf7f2] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4f8674]">Resumen</p>
                <h4 className="mt-3 text-lg font-black uppercase italic leading-tight text-[#302530]">{formData.name || 'Servicio sin nombre'}</h4>
                <div className="mt-5 space-y-3 text-sm font-black">
                  <div className="flex justify-between gap-3 border-b border-[#b7d8c7] pb-3">
                    <span className="text-[#856a75]">Precio</span>
                    <span className="text-[#302530]">C$ {Number(formData.price || 0).toLocaleString('es-NI')}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-[#b7d8c7] pb-3">
                    <span className="text-[#856a75]">Insumos</span>
                    <span className="text-[#4f8674]">C$ {supplyCost.toLocaleString('es-NI')}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#856a75]">Margen bruto</span>
                    <span className="text-[#d94f83]">C$ {estimatedMargin.toLocaleString('es-NI')}</span>
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full rounded-[1.6rem] bg-[#d94f83] px-6 py-5 text-[11px] font-black uppercase italic tracking-[0.16em] text-white shadow-[0_16px_34px_rgba(217,79,131,0.25)] transition-all hover:bg-[#c83f75]">
                Guardar catálogo
              </button>
              <button type="button" onClick={onClose} className="w-full rounded-[1.6rem] border border-[#ee9fbc] bg-white px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#9b6076]">
                Cancelar
              </button>
            </aside>
          </div>
        </form>
      </div>
    </div>
  );
}
