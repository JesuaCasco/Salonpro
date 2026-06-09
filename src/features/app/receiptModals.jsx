import React, { useState } from 'react';
import { Loader2, Printer, HandCoins, CheckCircle2 } from 'lucide-react';
import { getStylistPaymentModeLabel } from './shared';

const noopConfirm = async () => false;

const formatCurrency = (value) => `C$ ${Number(value || 0).toLocaleString('es-NI')}`;

const parseJsonNote = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export function CashClosureReceiptModal({ data, onClose }) {
  if (!data?.cashSession) return null;

  const {
    cashSession,
    cashMovements = [],
    posSales = [],
    salonName = 'SalonPro',
    branchName = 'General',
  } = data;
  const closureNotes = parseJsonNote(cashSession.notes);
  const openedAt = cashSession.openedAt ? new Date(cashSession.openedAt) : null;
  const closedAt = cashSession.closedAt ? new Date(cashSession.closedAt) : new Date();
  const manualIn = cashMovements
    .filter((movement) => movement.movementKind === 'manual' && movement.type === 'in')
    .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
  const manualOut = cashMovements
    .filter((movement) => movement.movementKind === 'manual' && movement.type === 'out')
    .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
  const salesByMethod = posSales.reduce((summary, sale) => {
    const method = sale.paymentMethod || 'cash';
    summary[method] = (summary[method] || 0) + Number(sale.subtotal || 0);
    return summary;
  }, {});
  const expectedCash = Number(closureNotes?.expectedCashAmount ?? cashSession.expectedCashAmount ?? 0);
  const countedCash = Number(closureNotes?.countedCashAmount ?? cashSession.countedCashAmount ?? cashSession.closingAmount ?? 0);
  const cashDifference = countedCash - expectedCash;
  const cardExpected = Number(closureNotes?.expectedCardAmount ?? salesByMethod.card ?? 0);
  const cardCounted = Number(closureNotes?.countedCardAmount ?? 0);
  const transferExpected = Number(closureNotes?.expectedTransferAmount ?? salesByMethod.transfer ?? 0);
  const transferCounted = Number(closureNotes?.countedTransferAmount ?? 0);
  const differenceReason = closureNotes?.differenceReason || '';
  const allBalanced = Math.abs(cashDifference) < 0.01
    && Math.abs(cardCounted - cardExpected) < 0.01
    && Math.abs(transferCounted - transferExpected) < 0.01;

  const handlePrint = () => {
    window.print();
  };

  const rows = [
    { label: 'Efectivo', system: expectedCash, counted: countedCash, diff: cashDifference },
    { label: 'POS / tarjeta', system: cardExpected, counted: cardCounted, diff: cardCounted - cardExpected },
    { label: 'Transferencia', system: transferExpected, counted: transferCounted, diff: transferCounted - transferExpected },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-3 backdrop-blur-xl animate-in fade-in text-white no-print md:p-4">
      <div className="bg-white text-black w-full max-w-4xl rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh]">
        <div className="overflow-y-auto p-4 custom-scrollbar md:p-10" id="printable-receipt">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 md:gap-6 md:pb-6">
            <div>
              <h2 className="text-2xl font-black italic tracking-widest text-slate-900 md:text-3xl">{salonName}</h2>
              <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 md:mt-2 md:text-[10px]">Soporte de cierre de caja</p>
              <p className="mt-2 text-sm font-bold text-slate-600 md:mt-3">{branchName}</p>
            </div>
            <div className="text-right">
              <p className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.14em] md:gap-2 md:px-4 md:py-2 md:text-[10px] ${allBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                <CheckCircle2 size={13} /> {allBalanced ? 'Cuadrada' : 'Con diferencias'}
              </p>
              <p className="mt-3 text-[9px] font-black uppercase text-slate-400 md:mt-4 md:text-[10px]">Cierre</p>
              <p className="text-xs font-bold md:text-sm">{closedAt.toLocaleString('es-NI')}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 md:mt-6 md:gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 md:rounded-[1.4rem] md:p-4">
              <p className="text-[8px] font-black uppercase text-slate-400 md:text-[10px]">Apertura</p>
              <p className="mt-1 hidden text-sm font-bold md:block">{openedAt ? openedAt.toLocaleString('es-NI') : 'Sin fecha'}</p>
              <p className="mt-1 text-lg font-black italic text-slate-900 md:mt-3 md:text-2xl">{formatCurrency(cashSession.openingAmount)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 md:rounded-[1.4rem] md:p-4">
              <p className="text-[8px] font-black uppercase text-slate-400 md:text-[10px]">Entradas</p>
              <p className="mt-1 text-lg font-black italic text-emerald-700 md:mt-3 md:text-2xl">{formatCurrency(manualIn)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 md:rounded-[1.4rem] md:p-4">
              <p className="text-[8px] font-black uppercase text-slate-400 md:text-[10px]">Salidas</p>
              <p className="mt-1 text-lg font-black italic text-rose-700 md:mt-3 md:text-2xl">{formatCurrency(manualOut)}</p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-slate-200 md:mt-6 md:rounded-[1.5rem]">
            <table className="w-full">
              <thead className="bg-slate-100">
                <tr className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-500 md:text-[10px] md:tracking-[0.16em]">
                  <th className="px-2 py-2 text-left md:px-4 md:py-3">Forma</th>
                  <th className="px-2 py-2 text-right md:px-4 md:py-3">Sistema</th>
                  <th className="px-2 py-2 text-right md:px-4 md:py-3">Contado</th>
                  <th className="px-2 py-2 text-right md:px-4 md:py-3">Dif.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-slate-200 text-[11px] md:text-sm">
                    <td className="px-2 py-2 font-black uppercase italic md:px-4 md:py-3">{row.label}</td>
                    <td className="px-2 py-2 text-right font-bold md:px-4 md:py-3">{formatCurrency(row.system)}</td>
                    <td className="px-2 py-2 text-right font-bold md:px-4 md:py-3">{formatCurrency(row.counted)}</td>
                    <td className={`px-2 py-2 text-right font-black md:px-4 md:py-3 ${Math.abs(row.diff) < 0.01 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(row.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!allBalanced && differenceReason ? (
            <div className="mt-6 rounded-[1.4rem] border border-rose-200 bg-rose-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-600">Motivo de diferencia</p>
              <p className="mt-2 text-sm font-bold text-rose-900">{differenceReason}</p>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-6 text-center md:mt-8 md:gap-12">
            <div className="border-t border-slate-300 pt-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cajero / recepción</p>
            </div>
            <div className="border-t border-slate-300 pt-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Administración</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50 p-3 no-print md:gap-4 md:p-5">
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-500 font-black uppercase italic text-[10px] rounded-2xl hover:bg-slate-100 transition-all md:px-6 md:py-4">Cerrar</button>
          <button onClick={handlePrint} className="flex-1 px-4 py-3 bg-emerald-600 text-white font-black uppercase italic text-[10px] rounded-2xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 md:px-6 md:py-4">
            <Printer size={16} /> Imprimir soporte
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaymentReceiptModal({ data, onClose, onConfirmPayment, confirmAction = noopConfirm }) {
  if (!data) return null;
  const { stylist, nomina } = data;
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const legalName = stylist.fullName || stylist.name;
  const legalId = stylist.cedula?.trim() || `ID STAFF ${stylist.id}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-white text-black w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh]">
        <div className="p-10 overflow-y-auto custom-scrollbar" id="printable-receipt">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black italic tracking-widest text-slate-900">SalonPro</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Comprobante Oficial de Pago de Nómina</p>
            <div className="h-0.5 w-16 bg-indigo-600 mx-auto mt-4"></div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Nombre Completo:</span>
              <span className="font-black uppercase italic text-sm text-right">{legalName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Cédula / Identificación:</span>
              <span className="font-bold text-sm text-right">{legalId}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Nombre Comercial:</span>
              <span className="font-bold text-sm text-right">{stylist.name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Fecha de Emisión:</span>
              <span className="font-bold text-sm">{hoy}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-[2rem] space-y-3 mb-10">
            <div className="flex justify-between text-slate-600">
              <span className="text-[10px] font-black uppercase">Salario Base:</span>
              <span className="font-bold">C$ {nomina.base.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600 border-b border-slate-200 pb-3">
              <span className="text-[10px] font-black uppercase">Comisiones Generadas:</span>
              <span className="font-bold">C$ {nomina.comission.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-xs font-black uppercase text-slate-900">Total Neto Pagado:</span>
              <span className="text-2xl font-black text-indigo-600 italic tracking-tighter">C$ {nomina.total.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-20 grid grid-cols-2 gap-12 text-center no-print-section">
            <div className="border-t border-slate-300 pt-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Administración</p>
            </div>
            <div className="border-t border-slate-300 pt-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Firma del Estilista</p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <p className="text-[8px] text-slate-400 italic font-medium leading-relaxed">
              Al firmar este documento, el estilista acepta que ha recibido la cantidad estipulada <br />
              en concepto de sus honorarios por el periodo correspondiente.
            </p>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col gap-3 no-print">
          <button
            onClick={async () => {
              const confirmed = await confirmAction({
                title: 'Confirmar pago',
                message: `¿Confirmas que has entregado C$ ${nomina.total.toLocaleString()} a ${legalName}? Esta acción liquidará las comisiones acumuladas.`,
                confirmLabel: 'Confirmar pago',
              });
              if (confirmed) {
                onConfirmPayment(stylist.id);
              }
            }}
            className="w-full px-6 py-4 bg-indigo-600 text-white font-black uppercase italic text-[11px] rounded-2xl shadow-xl shadow-indigo-900/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <HandCoins size={18} /> CONFIRMAR Y LIQUIDAR PAGO
          </button>
          <div className="flex gap-4">
            <button onClick={onClose} className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-400 font-black uppercase italic text-[10px] rounded-2xl hover:bg-slate-100 transition-all">Cancelar</button>
            <button onClick={handlePrint} className="flex-1 px-6 py-4 bg-emerald-600 text-white font-black uppercase italic text-[10px] rounded-2xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
              <Printer size={16} /> Imprimir Comprobante
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PosSaleReceiptModal({ data, onClose, onCancelSale, confirmAction = noopConfirm }) {
  const [isCancelling, setIsCancelling] = useState(false);
  if (!data?.sale) return null;

  const { sale, salonName, branchName } = data;
  const saleDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const issuedDate = saleDate.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const ticketNumber = String(Number(sale.ticketNumber || 0)).padStart(6, '0');

  const handlePrint = () => {
    window.print();
  };

  const handleCancelSale = async () => {
    if (isCancelling) return;

    const confirmed = await confirmAction({
      title: 'Anular venta',
      message: `¿Deseas anular la venta del ticket ${ticketNumber}? Se registrará un reverso de auditoría en caja.`,
      confirmLabel: 'Anular venta',
      cancelLabel: 'Volver',
    });

    if (confirmed) {
      const reason = window.prompt('Motivo de anulación');
      if (!reason?.trim()) return;
      setIsCancelling(true);
      try {
        await onCancelSale?.(sale.id, reason.trim());
      } finally {
        setIsCancelling(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-white text-black w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh]">
        <div className="p-10 overflow-y-auto custom-scrollbar" id="printable-receipt">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black italic tracking-widest text-slate-900">{salonName || 'SalonPro'}</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Ticket de Venta POS</p>
            <div className="h-0.5 w-16 bg-emerald-600 mx-auto mt-4"></div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Salón:</span>
              <span className="font-black uppercase italic text-sm text-right">{salonName || 'Sin nombre'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Sucursal:</span>
              <span className="font-bold text-sm text-right">{branchName || 'General'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Ticket:</span>
              <span className="font-bold text-sm text-right">{ticketNumber}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Fecha:</span>
              <span className="font-bold text-sm">{issuedDate}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-[2rem] mb-8">
            <div className="space-y-4">
              {(sale.items || []).map((item, index) => (
                <div key={`${item.id || item.name}-${index}`} className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-sm font-black uppercase italic text-slate-900">{item.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                      {item.category || 'Producto'} • {item.qty} x C$ {Number(item.price || 0).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm font-black text-slate-900">C$ {(Number(item.price || 0) * Number(item.qty || 0)).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-[2rem] space-y-3 mb-6">
            {Number(sale.rawSubtotal || 0) > 0 ? (
              <div className="flex justify-between text-slate-600">
                <span className="text-[10px] font-black uppercase">Subtotal base:</span>
                <span className="font-bold">C$ {Number(sale.rawSubtotal || 0).toLocaleString()}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-slate-600">
              <span className="text-[10px] font-black uppercase">Servicios:</span>
              <span className="font-bold">C$ {Number(sale.serviceTotal || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600 border-b border-slate-200 pb-3">
              <span className="text-[10px] font-black uppercase">Productos:</span>
              <span className="font-bold">C$ {Number(sale.productTotal || 0).toLocaleString()}</span>
            </div>
            {Number(sale.discountTotal || 0) > 0 ? (
              <div className="flex justify-between text-emerald-700 border-b border-slate-200 pb-3">
                <span className="text-[10px] font-black uppercase">
                  {sale.discountLabel || sale.promotionName ? `${sale.discountLabel || sale.promotionName}` : 'Descuento'}
                </span>
                <span className="font-bold">- C$ {Number(sale.discountTotal || 0).toLocaleString()}</span>
              </div>
            ) : null}
            <div className="flex justify-between pt-2">
              <span className="text-xs font-black uppercase text-slate-900">Total Pagado:</span>
              <span className="text-2xl font-black text-emerald-600 italic tracking-tighter">C$ {Number(sale.subtotal || 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[8px] text-slate-400 italic font-medium leading-relaxed">
              Gracias por su compra. Este ticket sirve como comprobante interno de la venta registrada.
            </p>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 no-print">
          <button
            onClick={handleCancelSale}
            disabled={isCancelling}
            className="flex-1 px-6 py-4 bg-rose-50 border border-rose-200 text-rose-500 font-black uppercase italic text-[10px] rounded-2xl hover:bg-rose-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCancelling ? <Loader2 size={16} className="animate-spin" /> : null}
            {isCancelling ? 'Cancelando...' : 'Cancelar venta'}
          </button>
          <button
            onClick={onClose}
            disabled={isCancelling}
            className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-500 font-black uppercase italic text-[10px] rounded-2xl hover:bg-slate-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Aceptar
          </button>
          <button
            onClick={handlePrint}
            disabled={isCancelling}
            className="flex-1 px-6 py-4 bg-emerald-600 text-white font-black uppercase italic text-[10px] rounded-2xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Printer size={16} /> Imprimir Ticket
          </button>
        </div>
      </div>
    </div>
  );
}

export function StaffSettlementModal({ data, onClose, onConfirmSettlement, confirmAction = noopConfirm }) {
  if (!data) return null;

  const { rows = [], summary } = data;
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  const handlePrint = () => {
    window.print();
  };

  const handleConfirm = async () => {
    if (!rows.length) return;
    const confirmed = await confirmAction({
      title: 'Liquidar planilla',
      message: `¿Confirmas que deseas liquidar C$ ${summary.total.toLocaleString()} a todo el equipo? Esta acción marcará como pagadas todas las citas finalizadas pendientes.`,
      confirmLabel: 'Liquidar',
    });
    if (confirmed) {
      onConfirmSettlement(rows.map((row) => row.stylist.id));
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-white text-black w-full max-w-7xl rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh]">
        <div className="p-4 md:p-10 overflow-y-auto custom-scrollbar" id="printable-staff-settlement">
          <div className="flex items-start justify-between gap-6 mb-8">
            <div>
              <h2 className="text-3xl font-black italic tracking-widest text-slate-900">SalonPro</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Planilla Consolidada de Liquidación de Nómina</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-400">Fecha de Emisión</p>
              <p className="text-sm font-bold">{hoy}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 mt-4">Equipo incluido</p>
              <p className="text-sm font-bold">{summary.staffCount}</p>
            </div>
          </div>

          <div className="settlement-summary-cards grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase text-slate-400">Total Base</p>
              <p className="text-2xl font-black italic text-slate-900 mt-2">C$ {summary.base.toLocaleString()}</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase text-slate-400">Total Comisiones</p>
              <p className="text-2xl font-black italic text-emerald-600 mt-2">C$ {summary.comission.toLocaleString()}</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase text-slate-400">Servicios Pendientes</p>
              <p className="text-2xl font-black italic text-slate-900 mt-2">{summary.pendingServices}</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-900 p-5">
              <p className="text-[10px] font-black uppercase text-slate-400">Total a Liquidar</p>
              <p className="text-2xl font-black italic text-white mt-2">C$ {summary.total.toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 overflow-x-auto custom-scrollbar">
            <table className="min-w-[1100px] w-full">
              <thead className="bg-slate-100">
                <tr className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-5 py-4 text-left">Estilista</th>
                  <th className="px-5 py-4 text-left">Desglose</th>
                  <th className="px-5 py-4 text-center">Base</th>
                  <th className="px-5 py-4 text-center">Comisiones</th>
                  <th className="px-5 py-4 text-center">Total</th>
                  <th className="px-5 py-4 text-center">Firma Física</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ stylist, nomina }) => (
                  <tr key={stylist.id} className="border-t border-slate-200">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 ${stylist.bg} rounded-xl flex items-center justify-center font-black italic text-white`}>
                          {stylist.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase italic text-slate-900">{stylist.fullName || stylist.name}</p>
                          <p className="text-[10px] font-bold uppercase text-slate-400 mt-1">{stylist.cedula?.trim() || `ID STAFF ${stylist.id}`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[11px] font-black uppercase text-slate-700">{getStylistPaymentModeLabel(stylist.paymentMode, nomina.commissionRate)}</p>
                      <p className="text-[11px] text-slate-500 mt-2">Servicios: {nomina.pendingServices}</p>
                      <p className="text-[11px] text-slate-500">Ventas base comisión: C$ {nomina.salesTotal.toLocaleString()}</p>
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-black italic">C$ {nomina.base.toLocaleString()}</td>
                    <td className="px-5 py-4 text-center text-sm font-black italic text-emerald-600">C$ {nomina.comission.toLocaleString()}</td>
                    <td className="px-5 py-4 text-center text-base font-black italic">C$ {nomina.total.toLocaleString()}</td>
                    <td className="px-5 py-4 signature-cell">
                      <div className="h-full min-h-[70px] flex flex-col justify-end">
                        <div className="border-t border-slate-400 pt-2 text-center">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Firma</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100">
                <tr>
                  <td colSpan="2" className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Totales</td>
                  <td className="px-5 py-4 text-center text-sm font-black italic">C$ {summary.base.toLocaleString()}</td>
                  <td className="px-5 py-4 text-center text-sm font-black italic text-emerald-600">C$ {summary.comission.toLocaleString()}</td>
                  <td className="px-5 py-4 text-center text-base font-black italic">C$ {summary.total.toLocaleString()}</td>
                  <td className="px-5 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border-t border-slate-300 pt-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Administración</p>
            </div>
            <div className="border-t border-slate-300 pt-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vo. Bo. Gerencia</p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-4 no-print">
          <button onClick={onClose} className="md:w-auto px-6 py-4 bg-white border border-slate-200 text-slate-400 font-black uppercase italic text-[10px] rounded-2xl hover:bg-slate-100 transition-all">
            Cerrar
          </button>
          <button onClick={handlePrint} className="flex-1 px-6 py-4 bg-emerald-600 text-white font-black uppercase italic text-[10px] rounded-2xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
            <Printer size={16} /> Imprimir Planilla
          </button>
          <button onClick={handleConfirm} className="flex-1 px-6 py-4 bg-indigo-600 text-white font-black uppercase italic text-[10px] rounded-2xl shadow-xl shadow-indigo-900/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
            <HandCoins size={16} /> Confirmar y Liquidar Todo
          </button>
        </div>
      </div>
    </div>
  );
}
