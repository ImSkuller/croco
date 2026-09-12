import { useState, useMemo, lazy, Suspense } from 'react'
import { useData, EMPTY_LIST } from '../lib/store'
import { FolderIcon } from '../constants/SimpleSvgExports'

// Lazy — monaco-editor is several MB and must never sit in the main bundle
// for users who don't enable the IDE module (see lib/monacoSetup.js).
const CodeEditor = lazy(() => import('../components/IDE/CodeEditor'))

// Standalone IDE page (Settings → Modules → IDE, beta). Same CodeEditor
// component ProjectDetail's "Code" tab uses — this just adds the project
// picker so it's reachable without opening a specific project first.
export default function IDE() {
  const projects = useData('projects') || EMPTY_LIST
  const [projectId, setProjectId] = useState(null)

  const activeProjects = useMemo(() => projects.filter(p => !p.trashedAt && !p.archived), [projects])
  const selected = activeProjects.find(p => p.id === projectId) || null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>IDE</span>
        {selected && <>
          <span style={{ color: 'var(--dimmer)' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{selected.name}</span>
        </>}
        <select
          value={projectId || ''}
          onChange={e => setProjectId(e.target.value || null)}
          style={{
            marginLeft: 'auto', background: 'var(--card)', color: 'var(--text)',
            border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px',
            fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
          }}
        >
          <option value="">Choose a project…</option>
          {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {selected ? (
          <Suspense fallback={<CodeEditorLoading />}>
            <CodeEditor key={selected.id} projectId={selected.id} />
          </Suspense>
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--dimmer)' }}>
            <FolderIcon size={28} />
            <span style={{ fontSize: 13 }}>Choose a project above to start editing</span>
          </div>
        )}
      </div>
    </div>
  )
}

function CodeEditorLoading() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dimmer)', fontSize: 13 }}>
      Loading editor…
    </div>
  )
}
