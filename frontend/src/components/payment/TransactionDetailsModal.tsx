import React, { useEffect, useState } from 'react';
import { ShieldCheck, Scale, Clock, User } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { PaymentTransaction } from '../../types';
import { apiFetch } from '../../services/api';

interface TransactionDetailsModalProps {
  transaction: PaymentTransaction | null;
  onClose: () => void;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  transaction,
  onClose
}) => {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!transaction) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setDetailError(null);
        const res = await apiFetch<any>(`/payments/transactions/${transaction.transactionId}`);
        if (active && res.success && res.data) {
          setDetail(res.data);
        } else if (active) {
          setDetailError(res.message || 'Could not load linked ledger records.');
        }
      } catch (err: any) {
        if (active) {
          setDetail(transaction);
          setDetailError(err?.message || 'Unable to load full ledger details from server.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDetail();
    return () => {
      active = false;
    };
  }, [transaction]);

  const tx = detail || transaction;

  return (
    <Modal
      isOpen={!!transaction}
      onClose={onClose}
      title="Transaction Complete Source & Ledger Details"
      subtitle={transaction?.transactionId}
      maxWidth="6xl"
      fullScreen={true}
    >
      {tx && (
        <div className="space-y-4 text-xs">
          {loading && (
            <div className="text-[11px] text-indigo-500 font-semibold">Loading linked approvals & audit history...</div>
          )}
          {detailError && (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200 font-semibold">
              {detailError}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
            <div>
              <div className="text-slate-400 uppercase font-bold text-[10px]">Transaction ID</div>
              <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">{tx.transactionId}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase font-bold text-[10px]">Source Reference</div>
              <div className="font-mono font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{tx.referenceId}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase font-bold text-[10px]">Classification</div>
              <div className="mt-0.5">
                <Badge
                  variant={
                    tx.financialClassification === 'Income'
                      ? 'success'
                      : tx.financialClassification === 'Liability'
                        ? 'primary'
                        : 'danger'
                  }
                >
                  {tx.financialClassification}
                </Badge>
              </div>
            </div>

            <div>
              <div className="text-slate-400 uppercase font-bold text-[10px]">Transaction Purpose</div>
              <div className="font-bold text-slate-900 dark:text-white mt-0.5">{tx.transactionType}</div>
            </div>
            <div>
              <div className="text-slate-400 uppercase font-bold text-[10px]">Payment Status</div>
              <div className="mt-0.5">
                <Badge
                  variant={
                    tx.status === 'COMPLETED'
                      ? 'success'
                      : tx.status === 'FAILED'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {tx.status}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-slate-400 uppercase font-bold text-[10px]">Payment Date</div>
              <div className="font-medium mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {new Date(tx.transactionDate).toLocaleString()}
              </div>
            </div>

            <div>
              <div className="text-slate-400 uppercase font-bold text-[10px]">From Party</div>
              <div className="font-semibold mt-0.5">
                {tx.fromParty?.name} <span className="text-[10px] text-slate-400">({tx.fromParty?.type}: {tx.fromParty?.id})</span>
              </div>
            </div>
            <div>
              <div className="text-slate-400 uppercase font-bold text-[10px]">To Party</div>
              <div className="font-semibold mt-0.5">
                {tx.toParty?.name} <span className="text-[10px] text-slate-400">({tx.toParty?.type}: {tx.toParty?.id})</span>
              </div>
            </div>
            <div>
              <div className="text-slate-400 uppercase font-bold text-[10px]">Handled By</div>
              <div className="font-medium mt-0.5 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                {tx.handledByEmployeeName || 'System'} ({tx.handledByEmployeeId || 'AUTO'})
              </div>
            </div>

            <div>
              <div className="text-slate-400 uppercase font-bold text-[10px]">Payment Method</div>
              <div className="font-semibold mt-0.5">{tx.paymentMethod}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-slate-400 uppercase font-bold text-[10px]">Gateway / Bank Reference</div>
              <div className="font-mono mt-0.5">{tx.gatewayReference || 'Internal Ledger'}</div>
            </div>
          </div>

          {/* Monetary Breakdown */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Gross</div>
              <div className="font-bold">₹{(tx.grossAmount ?? tx.amount ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Tax</div>
              <div className="font-bold">₹{(tx.tax ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Discount</div>
              <div className="font-bold">-₹{(tx.discount ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Commission</div>
              <div className="font-bold">₹{(tx.commission ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Deductions</div>
              <div className="font-bold">-₹{(tx.deductions ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-indigo-500 uppercase font-bold">Final Paid</div>
              <div className="font-black text-indigo-600">₹{(tx.finalAmount ?? tx.amount ?? 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Metadata Source Details */}
          {tx.metadata && Object.keys(tx.metadata).length > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Source Record Attributes</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(tx.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1">
                    <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked Maker-Checker Approval & History */}
          {detail?.approvalRecord && (
            <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Linked Maker-Checker Approval: {detail.approvalRecord.approvalId}</span>
                </div>
                <Badge variant="success">{detail.approvalRecord.status}</Badge>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                Maker: <span className="font-semibold">{detail.approvalRecord.makerName}</span> | Checker:{' '}
                <span className="font-semibold">{detail.approvalRecord.checkerName || 'Pending'}</span>
              </div>
              {Array.isArray(detail.approvalRecord.history) && detail.approvalRecord.history.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-indigo-100 dark:border-indigo-900">
                  {detail.approvalRecord.history.map((h: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[11px] text-slate-500">
                      <span><strong className="text-slate-700 dark:text-slate-300">{h.action}</strong> — {h.details}</span>
                      <span className="shrink-0 ml-2">{new Date(h.timestamp).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Linked Agent Deposit Liability */}
          {detail?.liabilityRecord && (
            <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-300">
                <Scale className="w-4 h-4" />
                <span>Linked Liability Record: {detail.liabilityRecord.liabilityId}</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                Outstanding Balance: ₹{detail.liabilityRecord.currentOutstandingBalance?.toLocaleString()} ({detail.liabilityRecord.status})
              </div>
            </div>
          )}

          {tx.notes && (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              Notes: {tx.notes}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

