import { AlertTriangleIcon } from '../../constants/SimpleSvgExports'

export default function ConfirmModal({ modal, input, onInput, loading, error, onConfirm, onCancel }) {
  const needsTyping = !!modal.requireTyping
  const canConfirm  = !needsTyping || input === modal.requireTyping

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget && !loading) onCancel() }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '24px 24px 20px', maxWidth: 440, width: '90%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        animation: 'pmFadeDown 0.18s ease both',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, color: '#ff5555' }}>
          <AlertTriangleIcon />
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{modal.title}</div>
        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.65, marginBottom: modal.warning ? 10 : 18, whiteSpace: 'pre-line' }}>{modal.desc}</div>

        {modal.warning && (
          <div style={{ fontSize: 11, color: '#ffaa55', background: 'rgba(255,170,85,0.07)', border: '1px solid rgba(255,170,85,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: 18, fontFamily: 'Geist Mono, monospace' }}>
            ⚠ {modal.warning}
          </div>
        )}

        {needsTyping && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 7, fontFamily: 'Geist Mono, monospace' }}>
              Type <span style={{ color: 'var(--orange)' }}>{modal.requireTyping}</span> to confirm:
            </div>
            <input
              value={input}
              onChange={e => onInput(e.target.value)}
              placeholder={modal.requireTyping}
              autoFocus
              style={{ width: '100%', background: 'var(--base)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: 'var(--text)', fontFamily: 'Geist Mono, monospace', outline: 'none', transition: 'border-color 0.12s' }}
              onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        )}

        {error && (
          <div style={{ fontSize: 11, color: '#ff5555', background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontFamily: 'Geist Mono, monospace' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={loading}
            style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: loading ? 'default' : 'pointer' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={!canConfirm || loading}
            style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: canConfirm && !loading ? (modal.confirmRed ? '#ff4444' : 'var(--orange)') : 'var(--dimmer)',
              color: '#fff', fontSize: 12, fontWeight: 500, fontFamily: 'Geist, sans-serif',
              cursor: canConfirm && !loading ? 'pointer' : 'not-allowed', transition: 'background 0.12s',
            }}>
            {loading ? 'Working…' : modal.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
