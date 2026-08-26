import { SmallBtn } from './Exports'

export default function ConfirmModal({ title, body, confirm, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, maxWidth: 400, width: '90%', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 24, lineHeight: 1.5 }}>{body}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <SmallBtn onClick={onCancel}>Cancel</SmallBtn>
          <button
            onClick={onConfirm}
            style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#ff4444', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
