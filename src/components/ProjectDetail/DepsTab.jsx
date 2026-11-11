import { PackageIcon } from '../../constants/SimpleSvgExports'
import InfoSection from './InfoSection'
import Spinner from './Spinner'
import DepsBtn from './DepsBtn'
import { EmptyState } from '../ui/EmptyState'

export default function DepsTab({ addPkgDev, addPkgInput, deps, depsLoading, depsOp, depsOutput, loadDeps, project, runDepsOp, setAddPkgDev, setAddPkgInput }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {depsLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0' }}>
          <Spinner size={14} />
          <span style={{ fontSize: 12, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Reading dependencies…</span>
        </div>
      ) : !deps || deps.type === 'unknown' ? (
        <EmptyState compact mono
          icon={<PackageIcon size={24} />}
          title="No dependency file found"
          body="Expected package.json, requirements.txt, go.mod, or Cargo.toml"
          action={<button onClick={loadDeps} style={{ padding: '7px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>Refresh</button>}
        />
      ) : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', padding: '3px 7px', borderRadius: 'var(--r-sm)', background: 'rgba(74,158,255,0.1)', color: '#4a9eff' }}>
              {deps.type}
            </span>
            {deps.name && <span style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace' }}>{deps.name}@{deps.version}</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {deps.type === 'node' && (
                <>
                  <DepsBtn
                    loading={depsOp === 'install'}
                    onClick={() => runDepsOp('install', () => window.api.projects.installDependencies(project.id))}
                  >
                    Install All
                  </DepsBtn>
                  <DepsBtn
                    loading={depsOp === 'update'}
                    onClick={() => runDepsOp('update', () => window.api.projects.updateDependencies(project.id))}
                  >
                    Update All
                  </DepsBtn>
                </>
              )}
              <button onClick={loadDeps} style={{ padding: '5px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                Refresh
              </button>
            </div>
          </div>

          {/* Add dependency (Node only) */}
          {deps.type === 'node' && (
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '10px 12px' }}>
              <input
                value={addPkgInput}
                onChange={e => setAddPkgInput(e.target.value)}
                placeholder="package-name[@version]"
                onKeyDown={e => {
                  if (e.key === 'Enter' && addPkgInput.trim()) {
                    runDepsOp(`add:${addPkgInput}`, () => window.api.projects.addDependency(project.id, addPkgInput.trim(), addPkgDev))
                    setAddPkgInput('')
                  }
                }}
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist Mono, monospace' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--dim)', cursor: 'pointer', flexShrink: 0 }}>
                <input type="checkbox" checked={addPkgDev} onChange={e => setAddPkgDev(e.target.checked)} style={{ accentColor: 'var(--orange)' }} />
                dev
              </label>
              <button
                disabled={!addPkgInput.trim() || !!depsOp}
                onClick={() => {
                  if (!addPkgInput.trim()) return
                  runDepsOp(`add:${addPkgInput}`, () => window.api.projects.addDependency(project.id, addPkgInput.trim(), addPkgDev))
                  setAddPkgInput('')
                }}
                style={{ padding: '5px 12px', borderRadius: 'var(--r-md)', border: 'none', background: addPkgInput.trim() ? 'var(--orange)' : 'var(--dimmer)', color: '#fff', fontSize: 11, cursor: addPkgInput.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Geist, sans-serif', flexShrink: 0 }}
              >
                + Add
              </button>
            </div>
          )}

          {/* Output */}
          {(depsOp || depsOutput) && (
            <div style={{ background: '#0a0a0a', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}>
              {depsOp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: depsOutput ? 8 : 0 }}>
                  <Spinner size={11} />
                  <span style={{ fontSize: 11, color: 'var(--orange)', fontFamily: 'Geist Mono, monospace' }}>
                    Running npm {depsOp.startsWith('add:') ? `install ${depsOp.slice(4)}` : depsOp}…
                  </span>
                </div>
              )}
              {depsOutput && (
                <pre style={{ fontSize: 10, color: 'var(--dim)', fontFamily: 'Geist Mono, monospace', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 160, overflowY: 'auto' }}>
                  {depsOutput}
                </pre>
              )}
            </div>
          )}

          {/* Dep sections */}
          {[
            { key: 'dependencies',     label: 'Dependencies' },
            { key: 'devDependencies',  label: 'Dev Dependencies' },
            { key: 'peerDependencies', label: 'Peer Dependencies' },
          ].map(({ key, label }) => {
            const entries = Object.entries(deps[key] || {})
            if (!entries.length) return null
            return (
              <InfoSection key={key} label={`${label} (${entries.length})`}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                  {entries.map(([pkg, ver], i) => (
                    <div key={pkg} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, fontFamily: 'Geist Mono, monospace' }}>{pkg}</span>
                      <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', flexShrink: 0 }}>{String(ver).slice(0, 20)}</span>
                      {deps.type === 'node' && (
                        <button
                          disabled={!!depsOp}
                          onClick={() => runDepsOp(`remove:${pkg}`, () => window.api.projects.removeDependency(project.id, pkg))}
                          style={{ padding: '3px 8px', borderRadius: 'var(--r-sm)', border: '1px solid rgba(255,68,68,0.2)', background: 'rgba(255,68,68,0.06)', color: '#ff5555', fontSize: 10, cursor: depsOp ? 'not-allowed' : 'pointer', fontFamily: 'Geist, sans-serif', flexShrink: 0, opacity: depsOp ? 0.5 : 1 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </InfoSection>
            )
          })}
        </>
      )}
    </div>
  )
}
