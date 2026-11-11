import { AlertTriangleIcon } from '../../constants/SimpleSvgExports'
import DangerRow from './DangerRow'

export default function DangerTab({ behindCount, handlePull, isRepo, navigate, openModal, project, pulling, setGitLog, setGitStatus, setIsRepo, syncProject }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ padding: '11px 15px', borderRadius: 'var(--r-md)', background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.18)', fontSize: 11, color: '#ff6666', fontFamily: 'Geist Mono, monospace', display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangleIcon /> Actions on this page cannot be undone. Proceed carefully.
      </div>

      {/* Pull from repo — greyed when in sync */}
      {isRepo && (
        <DangerRow
          title="Pull from Repository"
          desc={behindCount > 0
            ? `Your local copy is ${behindCount} commit${behindCount > 1 ? 's' : ''} behind the remote. Click to pull the latest changes.`
            : 'Your local copy is up to date with the remote. Nothing to pull.'}
          action={pulling ? 'Pulling…' : behindCount > 0 ? `Pull (↓ ${behindCount})` : 'Up to date'}
          actionDisabled={behindCount === 0 || pulling}
          color="#4aff91"
          onClick={handlePull}
        />
      )}

      {/* Toggle visibility */}
      <DangerRow
        title={project.visibility === 'hidden' ? 'Make Project Public' : 'Make Project Private'}
        desc={project.visibility === 'hidden'
          ? 'Change visibility to public. The project folder location on disk will not be moved.'
          : 'Change visibility to hidden/private. The project folder location on disk will not be moved.'}
        action={project.visibility === 'hidden' ? 'Make Public' : 'Make Private'}
        color="var(--blue)"
        onClick={() => openModal({
          title: project.visibility === 'hidden' ? 'Make Project Public?' : 'Make Project Private?',
          desc: 'This updates the visibility metadata only. The folder on disk will not move.',
          confirmLabel: project.visibility === 'hidden' ? 'Make Public' : 'Make Private',
          onConfirm: async () => {
            const newVis = project.visibility === 'public' ? 'hidden' : 'public'
            const u = await window.api.projects.edit(project.id, { visibility: newVis })
            syncProject(u)
          },
        })}
      />

      {/* Remove GitHub repo */}
      <DangerRow
        title="Remove GitHub Repository"
        desc={project.github
          ? `Permanently deletes github.com/${project.github}. Your local files are unaffected. Uses your GitHub API token — 2FA is not required for token-based API calls.`
          : 'No GitHub repository is linked to this project.'}
        action="Delete on GitHub"
        actionDisabled={!project.github}
        color="var(--red)"
        onClick={() => openModal({
          title: 'Delete GitHub Repository?',
          desc: `This permanently deletes github.com/${project.github} from GitHub.\n\nYour local project files will not be touched.\n\nMake sure your GitHub token (in Settings → User) has the delete_repo scope.`,
          warning: '2FA is not required — token auth is used directly via the GitHub API.',
          confirmLabel: 'Delete Repository',
          confirmRed: true,
          requireTyping: project.name,
          onConfirm: async () => {
            const u = await window.api.projects.deleteGithubRepo(project.id)
            syncProject(u)
          },
        })}
      />

      {/* Remove local files */}
      <DangerRow
        title="Remove Local Files"
        desc="Deletes all project files from your drive. Your project entry is preserved here so you can pull from the repository later."
        action="Remove Files"
        color="var(--red)"
        onClick={() => openModal({
          title: 'Remove Local Files?',
          desc: `All files in:\n${project.paths?.projectRoot}\nwill be permanently deleted.\n\nYour project entry stays in Croco so you can pull from GitHub later.`,
          confirmLabel: 'Remove Local Files',
          confirmRed: true,
          onConfirm: async () => {
            await window.api.projects.removeLocalFiles(project.id)
            setIsRepo(false); setGitStatus(null); setGitLog([])
          },
        })}
      />

      {/* Archive project */}
      <DangerRow
        title={project.archived ? 'Unarchive Project' : 'Archive Project'}
        desc={project.archived
          ? 'Restore this project to the active list. No files are moved or deleted.'
          : 'Hide this project from the main list. It can be restored at any time from the archived view. No files are moved or deleted.'}
        action={project.archived ? 'Unarchive' : 'Archive'}
        color="var(--purple)"
        onClick={() => openModal({
          title: project.archived ? 'Unarchive Project?' : 'Archive Project?',
          desc: project.archived
            ? 'This project will appear in your active project list again.'
            : 'This project will be hidden from the main list. You can restore it anytime.',
          confirmLabel: project.archived ? 'Unarchive' : 'Archive',
          onConfirm: async () => {
            const u = await window.api.projects.setArchived(project.id, !project.archived)
            syncProject(u)
          },
        })}
      />

      {/* Remove from Croco — moves to Trash, fully reversible. Files
          and any linked GitHub repo are never touched by this
          action, so unlike "Remove Everywhere" below there's
          something real to restore. */}
      <DangerRow
        title="Remove from Croco"
        desc="Moves this project to Trash. Local files and any linked GitHub repository are left untouched — restore it from Trash within 30 days, or it's removed automatically after that."
        action="Move to Trash"
        color="var(--orange)"
        onClick={() => openModal({
          title: 'Move to Trash?',
          desc: 'This removes the project from your active list. Local files and any GitHub repository are not touched. You can restore it from Trash within 30 days.',
          confirmLabel: 'Move to Trash',
          confirmRed: true,
          onConfirm: async () => {
            await window.api.projects.delete(project.id)
            window.dispatchEvent(new CustomEvent('croco:data-changed'))
            navigate('/projects')
          },
        })}
      />

      {/* Remove everywhere — nuclear. Deletes local files and the
          GitHub repo first, so by the time the tracking entry goes
          too there is nothing left to undo — deletePermanently,
          not the trash-based delete above. */}
      <DangerRow
        title="Remove Everywhere"
        desc="Permanently deletes local project files, the GitHub repository (if linked), and this project entry from Croco. This cannot be undone."
        action="Delete Everything"
        color="var(--red)"
        nuclear
        onClick={() => openModal({
          title: 'Delete Everything?',
          desc: `This will permanently:\n• Delete all local files at ${project.paths?.projectRoot}\n${project.github ? `• Delete github.com/${project.github}\n` : ''}• Remove this project entry from Croco`,
          warning: 'THIS ACTION CANNOT BE UNDONE.',
          confirmLabel: 'Delete Everything',
          confirmRed: true,
          requireTyping: project.name,
          onConfirm: async () => {
            if (project.github) await window.api.projects.deleteGithubRepo(project.id).catch(() => {})
            await window.api.projects.removeLocalFiles(project.id).catch(() => {})
            await window.api.projects.deletePermanently(project.id)
            window.dispatchEvent(new CustomEvent('croco:data-changed'))
            navigate('/projects')
          },
        })}
      />
    </div>
  )
}
