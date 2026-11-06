import { ShieldIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, DangerRow } from './Exports'
import ConfirmModal from './ConfirmModal'

export default function DangerSection({
  rerunConfirm, setRerunConfirm, handleRerunSetup,
  resetConfirm, setResetConfirm, handleReset,
  dangerConfirm, setDangerConfirm, dangerActions,
}) {
  return (
    <>
      <SectionTitle icon={<ShieldIcon />} title="Danger Zone" desc="These can't be undone. Be careful." />

      <div style={{ background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>

        <DangerRow
          title="Run Setup Again"
          desc="Walks you through the first-time setup again. Croco will reload."
          action="Run Again"
          onAction={() => setRerunConfirm(true)}
        />

        <div style={{ height: 1, background: 'rgba(255,68,68,0.15)' }} />

        <DangerRow
          title="Reset Settings"
          desc="Puts every setting back to how it started. Your projects, notes, and todos are kept."
          action="Reset Settings"
          onAction={() => setResetConfirm(true)}
        />

        <div style={{ height: 1, background: 'rgba(255,68,68,0.15)' }} />

        <DangerRow
          title="Clear All Todos"
          desc="Permanently deletes every todo. This cannot be undone."
          action="Clear Todos"
          onAction={() => setDangerConfirm('todos')}
        />

        <div style={{ height: 1, background: 'rgba(255,68,68,0.15)' }} />

        <DangerRow
          title="Clear All Notes"
          desc="Permanently deletes every note. This cannot be undone."
          action="Clear Notes"
          onAction={() => setDangerConfirm('notes')}
        />

        <div style={{ height: 1, background: 'rgba(255,68,68,0.15)' }} />

        <DangerRow
          title="Delete All Projects"
          desc="Removes every project from Croco. Your code folders on your computer are not deleted."
          action="Delete All"
          onAction={() => setDangerConfirm('projects')}
        />

      </div>

      {/* Re-run setup confirm modal */}
      {rerunConfirm && (
        <ConfirmModal
          title="Run setup again?"
          body="The app will reload and take you back through the setup flow. Your projects, notes, and todos are not affected."
          confirm="Run Again"
          onConfirm={handleRerunSetup}
          onCancel={() => setRerunConfirm(false)}
        />
      )}

      {/* Reset settings confirm modal */}
      {resetConfirm && (
        <ConfirmModal
          title="Reset all settings?"
          body="This will reset your name, paths, defaults, and GitHub token to their original values. Your projects, notes, and todos are not affected."
          confirm="Yes, Reset"
          onConfirm={handleReset}
          onCancel={() => setResetConfirm(false)}
        />
      )}

      {/* Generic danger action confirm modal */}
      {dangerConfirm && dangerActions[dangerConfirm] && (
        <ConfirmModal
          title={dangerActions[dangerConfirm].label}
          body={dangerActions[dangerConfirm].body}
          confirm={dangerActions[dangerConfirm].confirm}
          onConfirm={dangerActions[dangerConfirm].fn}
          onCancel={() => setDangerConfirm(null)}
        />
      )}
    </>
  )
}
