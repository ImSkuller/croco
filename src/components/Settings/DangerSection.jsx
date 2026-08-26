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
      <SectionTitle icon={<ShieldIcon />} title="Danger Zone" desc="Irreversible actions. Be careful." />

      <div style={{ background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 12, overflow: 'hidden' }}>

        <DangerRow
          title="Re-run Setup Wizard"
          desc="Takes you back through the onboarding flow to reconfigure your name, tag, GitHub, data path, and close behavior. The app will reload."
          action="Re-run Setup"
          onAction={() => setRerunConfirm(true)}
        />

        <div style={{ height: 1, background: 'rgba(255,68,68,0.15)' }} />

        <DangerRow
          title="Reset All Settings"
          desc="Resets all settings to their default values. Your projects and data are not affected."
          action="Reset Settings"
          onAction={() => setResetConfirm(true)}
        />

        <div style={{ height: 1, background: 'rgba(255,68,68,0.15)' }} />

        <DangerRow
          title="Clear All Todos"
          desc="Permanently deletes all todos across all projects. This cannot be undone."
          action="Clear Todos"
          onAction={() => setDangerConfirm('todos')}
        />

        <div style={{ height: 1, background: 'rgba(255,68,68,0.15)' }} />

        <DangerRow
          title="Clear All Notes"
          desc="Permanently deletes all notes across all projects. This cannot be undone."
          action="Clear Notes"
          onAction={() => setDangerConfirm('notes')}
        />

        <div style={{ height: 1, background: 'rgba(255,68,68,0.15)' }} />

        <DangerRow
          title="Delete All Projects"
          desc="Removes all project metadata from the app. Your actual code folders are not deleted."
          action="Delete All"
          onAction={() => setDangerConfirm('projects')}
        />

      </div>

      {/* Re-run setup confirm modal */}
      {rerunConfirm && (
        <ConfirmModal
          title="Re-run setup wizard?"
          body="The app will reload and take you back through the setup flow. Your projects, notes, and todos are not affected."
          confirm="Re-run Setup"
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
