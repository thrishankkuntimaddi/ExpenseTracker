import { useState } from 'react';
import {
  X, RotateCcw, Trash2, Filter,
  TrendingDown, TrendingUp, ReceiptText,
} from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { formatAmount, formatDateShort } from '../utils/dateHelpers';

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    return formatDateShort(dateStr);
  } catch {
    return dateStr;
  }
}

function formatDeletedTime(deletedAtStr) {
  if (!deletedAtStr) return '';
  try {
    const d = new Date(deletedAtStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Deleted just now';
    if (diffMins < 60) return `Deleted ${diffMins}m ago`;
    if (diffHours < 24) return `Deleted ${diffHours}h ago`;
    if (diffDays === 1) return 'Deleted yesterday';
    if (diffDays < 30) return `Deleted ${diffDays}d ago`;
    return `Deleted ${formatDate(deletedAtStr)}`;
  } catch {
    return '';
  }
}

export default function RecentlyDeletedModal({
  isOpen,
  onClose,
  recentlyDeleted = [],
  onRestoreItem,
  onPermanentlyDeleteItem,
  onEmptyTrash,
}) {
  const [filter, setFilter] = useState('all'); // 'all' | 'expense' | 'income' | 'billing'
  const [permDeleteId, setPermDeleteId] = useState(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  if (!isOpen) return null;

  function showToast(msg) {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  }

  const filteredItems = recentlyDeleted.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'expense') return item.itemType === 'expense' || item.itemType === 'transaction';
    if (filter === 'income') return item.itemType === 'income';
    if (filter === 'billing') return item.itemType === 'billing';
    return true;
  });

  const countExpense = recentlyDeleted.filter((i) => i.itemType === 'expense' || i.itemType === 'transaction').length;
  const countIncome = recentlyDeleted.filter((i) => i.itemType === 'income').length;
  const countBilling = recentlyDeleted.filter((i) => i.itemType === 'billing').length;

  async function handleRestore(item) {
    if (!onRestoreItem) return;
    await onRestoreItem(item);
    showToast(`Restored "${item.name}"`);
  }

  async function handleConfirmPermDelete() {
    if (!permDeleteId || !onPermanentlyDeleteItem) return;
    const target = recentlyDeleted.find((i) => i.id === permDeleteId);
    await onPermanentlyDeleteItem(permDeleteId);
    setPermDeleteId(null);
    if (target) showToast(`Permanently deleted "${target.name}"`);
  }

  async function handleConfirmEmptyTrash() {
    if (!onEmptyTrash) return;
    await onEmptyTrash();
    setShowEmptyConfirm(false);
    showToast('Trash emptied permanently');
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        padding: 16,
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px 16px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'var(--expense-bg)',
                color: 'var(--expense)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <RotateCcw size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                  Recently Deleted
                </h2>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 99,
                    background: 'var(--surface2)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {recentlyDeleted.length}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                Items can be restored to active ledger or deleted permanently.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {recentlyDeleted.length > 0 && (
              <button
                onClick={() => setShowEmptyConfirm(true)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--expense-border)',
                  background: 'var(--expense-bg)',
                  color: 'var(--expense)',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <Trash2 size={14} />
                <span>Empty Trash</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Feedback Toast */}
        {feedbackMsg && (
          <div
            style={{
              padding: '10px 16px',
              background: 'var(--income-bg)',
              borderBottom: '1px solid var(--income-border)',
              color: 'var(--income)',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            {feedbackMsg}
          </div>
        )}

        {/* Filter Pills */}
        <div
          style={{
            padding: '12px 24px',
            background: 'var(--surface2)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
          }}
        >
          <Filter size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          {[
            { id: 'all', label: `All (${recentlyDeleted.length})` },
            { id: 'expense', label: `Expenses (${countExpense})` },
            { id: 'income', label: `Income (${countIncome})` },
            { id: 'billing', label: `Billings (${countBilling})` },
          ].map(({ id, label }) => {
            const active = filter === id;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 99,
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  background: active ? 'var(--accent)' : 'var(--surface)',
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: active ? 'var(--shadow-sm)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Item List Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', background: 'var(--surface)' }}>
          {filteredItems.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={26} />
              </div>
              <div style={{ maxWidth: 320 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  {recentlyDeleted.length === 0 ? 'Trash is Empty' : 'No matching items'}
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {recentlyDeleted.length === 0
                    ? 'Deleted expenses, income, or billing sessions will show up here so you can revert them.'
                    : 'Try selecting a different filter above.'}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredItems.map((item) => {
                const isExpense = item.itemType === 'expense' || item.itemType === 'transaction';
                const isIncome = item.itemType === 'income';
                const isBilling = item.itemType === 'billing';

                const badgeColor = isIncome
                  ? 'var(--income)'
                  : isBilling
                  ? 'var(--external)'
                  : 'var(--expense)';
                const badgeBg = isIncome
                  ? 'var(--income-bg)'
                  : isBilling
                  ? 'var(--external-bg)'
                  : 'var(--expense-bg)';
                const badgeBorder = isIncome
                  ? 'var(--income-border)'
                  : isBilling
                  ? 'var(--external-border)'
                  : 'var(--expense-border)';
                const badgeLabel = isIncome
                  ? 'Income'
                  : isBilling
                  ? 'Billing'
                  : 'Expense';

                const Icon = isIncome ? TrendingUp : isBilling ? ReceiptText : TrendingDown;

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: badgeBg,
                          border: `1px solid ${badgeBorder}`,
                          color: badgeColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={20} />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: 'var(--text)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 220,
                            }}
                          >
                            {item.name}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 99,
                              background: badgeBg,
                              border: `1px solid ${badgeBorder}`,
                              color: badgeColor,
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                            }}
                          >
                            {badgeLabel}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            marginTop: 4,
                            fontSize: 11,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <span>Date: {formatDate(item.date)}</span>
                          {item.deletedAt && (
                            <>
                              <span>•</span>
                              <span style={{ color: 'var(--text-muted)' }}>
                                {formatDeletedTime(item.deletedAt)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: isIncome ? 'var(--income)' : 'var(--text)',
                          }}
                        >
                          {formatAmount(item.amount)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => handleRestore(item)}
                          title="Restore / Revert to active ledger"
                          style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: '1px solid var(--income-border)',
                            background: 'var(--income-bg)',
                            color: 'var(--income)',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <RotateCcw size={14} />
                          <span>Revert</span>
                        </button>

                        <button
                          onClick={() => setPermDeleteId(item.id)}
                          title="Delete Permanently"
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            border: '1px solid var(--border)',
                            background: 'var(--surface3)',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Single Item Permanent Delete Modal */}
      {permDeleteId && (
        <ConfirmDeleteModal
          title="Delete permanently?"
          message="This action cannot be undone. The item will be permanently removed from trash."
          confirmLabel="Delete Permanently"
          onConfirm={handleConfirmPermDelete}
          onCancel={() => setPermDeleteId(null)}
        />
      )}

      {/* Empty Trash Confirmation Modal */}
      {showEmptyConfirm && (
        <ConfirmDeleteModal
          title="Empty entire trash?"
          message={`Are you sure you want to permanently delete all ${recentlyDeleted.length} items from trash? This cannot be undone.`}
          confirmLabel="Empty Trash"
          onConfirm={handleConfirmEmptyTrash}
          onCancel={() => setShowEmptyConfirm(false)}
        />
      )}
    </div>
  );
}
