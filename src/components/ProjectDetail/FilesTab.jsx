import { FolderOpenIcon } from '../../constants/SimpleSvgExports'
import Spinner from './Spinner'
import FileTreeNodes from './FileTreeNodes'
import { EmptyState } from '../ui/EmptyState'

export default function FilesTab({ expanded, fileLoading, fileTree, loadFiles, project, setCtxMenu, setExpanded }) {
  return (
    <div>
      {fileLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0' }}>
          <Spinner size={14} />
          <span style={{ fontSize: 12, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Reading files…</span>
        </div>
      ) : !fileTree || fileTree.length === 0 ? (
        <EmptyState compact mono
          icon={<FolderOpenIcon size={24} />}
          title="Project folder is empty"
          body={project.paths?.projectRoot}
          action={<button onClick={loadFiles} style={{ padding: '7px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>Refresh</button>}
        />
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{project.paths?.projectRoot}</span>
            <button onClick={loadFiles} style={{ padding: '4px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>Refresh</button>
          </div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', fontFamily: 'Geist Mono, monospace' }}>
            <FileTreeNodes nodes={fileTree} depth={0} expanded={expanded} setExpanded={setExpanded} onOpenFile={p => window.api?.system.openPath(p)} onContextMenu={(e, entry) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, entry }) }} />
          </div>
        </div>
      )}
    </div>
  )
}
