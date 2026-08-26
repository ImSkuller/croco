import {
  GithubIcon, CommitIcon, DownloadIcon, RefreshIcon, BranchIcon, ExternalLinkIcon,
} from '../../constants/SimpleSvgExports'
import { authorColor, initials } from '../../lib/projectDetailHelpers'
import InfoSection from './InfoSection'
import Chip from './Chip'
import Spinner from './Spinner'
import DiffView from './DiffView'

export default function GitPanel({
  project, projectId, toast,
  isRepo, setIsRepo, initingRepo, setInitingRepo,
  gitLoading, gitStatus, setGitStatus, gitLog, setGitLog, branches, setBranches,
  syncLoading, aheadBehind, behindCount, aheadCount, checkRemote,
  openDiff, diffLoading, diffText, toggleDiff,
  handleStageFiles, handleUnstageFiles,
  showCommit, setShowCommit, commitMsg, setCommitMsg, commitResult, setCommitResult, committing, handleCommit,
  pulling, handlePull, pushing, handlePush,
  setPublishName, setPublishDesc, setPublishError, setPublishModal,
  branchOp, branchOpen, setBranchOpen, newBranch, setNewBranch, handleCreateBranch, handleSwitchBranch,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {!isRepo ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📦</div>
          <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 6 }}>No git repository at project path</div>
          <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginBottom: 16 }}>{project.paths?.projectRoot}</div>
          <button
            disabled={initingRepo}
            onClick={async () => {
              setInitingRepo(true)
              try {
                await window.api.git.initRepo(projectId)
                setIsRepo(true)
                toast.show({ title: 'Repository initialised', type: 'success' })
                const [st, log, br] = await Promise.all([
                  window.api.git.status(projectId),
                  window.api.git.getLog(projectId, 50),
                  window.api.git.getBranches(projectId),
                ])
                setGitStatus(st); setGitLog(log || []); setBranches(br || [])
              } catch (e) {
                toast.show({ title: 'Init failed', body: e?.message || String(e), type: 'error' })
              } finally {
                setInitingRepo(false)
              }
            }}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: initingRepo ? 'not-allowed' : 'pointer', opacity: initingRepo ? 0.6 : 1 }}
          >
            {initingRepo ? 'Initialising…' : 'Initialize Repository'}
          </button>
        </div>
      ) : gitLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0' }}>
          <Spinner size={14} />
          <span style={{ fontSize: 12, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Loading git data…</span>
        </div>
      ) : (
        <>
          {/* Status card */}
          {gitStatus && (
            <div style={{
              background: 'var(--card)',
              border: `1px solid ${gitStatus.clean ? 'var(--border)' : 'rgba(255,107,53,0.25)'}`,
              borderRadius: 10, padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: gitStatus.clean ? 0 : 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)', fontFamily: 'Geist Mono, monospace' }}>
                  <BranchIcon />
                  <span style={{ fontWeight: 600 }}>{gitStatus.branch}</span>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {gitStatus.clean ? (
                    <Chip c="#4aff91" bg="rgba(74,255,145,0.1)">✓ clean</Chip>
                  ) : (
                    <>
                      {(gitStatus.staged  || []).length > 0 && <Chip c="#4aff91"       bg="rgba(74,255,145,0.1)">{gitStatus.staged.length} staged</Chip>}
                      {(gitStatus.modified|| []).length > 0 && <Chip c="var(--orange)" bg="rgba(255,107,53,0.1)">{gitStatus.modified.length} modified</Chip>}
                      {(gitStatus.untracked||[]).length > 0 && <Chip c="var(--dim)"    bg="var(--border)">{gitStatus.untracked.length} untracked</Chip>}
                    </>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {syncLoading
                    ? <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>checking remote…</span>
                    : aheadBehind && !aheadBehind.unavailable
                    ? <span style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', color: behindCount > 0 ? '#4aff91' : aheadCount > 0 ? 'var(--orange)' : 'var(--dimmer)' }}>
                        {behindCount > 0 ? `↓ ${behindCount} behind` : aheadCount > 0 ? `↑ ${aheadCount} ahead` : '✓ synced with remote'}
                      </span>
                    : null
                  }
                  <button onClick={checkRemote} title="Refresh remote status"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', padding: 2, display: 'flex', borderRadius: 4, transition: 'color 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--dim)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--dimmer)'}
                  ><RefreshIcon /></button>
                </div>
              </div>

              {/* Changed files list */}
              {!gitStatus.clean && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {(gitStatus.modified?.length || gitStatus.untracked?.length) > 0 && (gitStatus.staged?.length || 0) > 0 && (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                      <button onClick={() => handleStageFiles([...(gitStatus.modified || []), ...(gitStatus.untracked || [])])}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--dimmer)', padding: 0, fontFamily: 'Geist Mono, monospace' }}>
                        stage all
                      </button>
                      <button onClick={() => handleUnstageFiles(gitStatus.staged || [])}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--dimmer)', padding: 0, fontFamily: 'Geist Mono, monospace' }}>
                        unstage all
                      </button>
                    </div>
                  )}
                  {[
                    ...(gitStatus.staged   || []).map(f => ({ f, type: 'staged'    })),
                    ...(gitStatus.modified || []).map(f => ({ f, type: 'modified'  })),
                    ...(gitStatus.untracked|| []).map(f => ({ f, type: 'untracked' })),
                  ].map(({ f, type }, idx) => {
                    const key = `${type}:${f}`
                    const isOpen = openDiff === key
                    return (
                    <div key={type + f + idx}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 9, fontFamily: 'Geist Mono, monospace', padding: '2px 6px',
                          borderRadius: 3, flexShrink: 0, minWidth: 62, textAlign: 'center',
                          color:      type === 'staged' ? '#4aff91' : type === 'modified' ? 'var(--orange)' : 'var(--dim)',
                          background: type === 'staged' ? 'rgba(74,255,145,0.1)' : type === 'modified' ? 'rgba(255,107,53,0.1)' : 'var(--border)',
                        }}>{type}</span>
                        <span
                          onClick={() => toggleDiff(type, f)}
                          title="View diff"
                          style={{ fontSize: 11, fontFamily: 'Geist Mono, monospace', color: isOpen ? 'var(--text)' : 'var(--dim)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        >{f}</span>
                        <button
                          onClick={() => type === 'staged' ? handleUnstageFiles([f]) : handleStageFiles([f])}
                          title={type === 'staged' ? 'Unstage' : 'Stage'}
                          style={{
                            flexShrink: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 4, border: '1px solid var(--border)', background: 'transparent',
                            color: 'var(--dimmer)', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0,
                          }}
                        >{type === 'staged' ? '−' : '+'}</button>
                      </div>
                      {isOpen && (
                        <DiffView loading={diffLoading === key} text={diffText[key]} />
                      )}
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Publish to GitHub — shown when no remote is configured */}
          {aheadBehind?.unavailable && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>No remote configured</div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>Publish this repository to GitHub to enable push/pull.</div>
              </div>
              <button
                onClick={() => { setPublishName(project.name || ''); setPublishDesc(project.description || ''); setPublishError(''); setPublishModal(true) }}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#24292e', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <GithubIcon /> Publish to GitHub
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowCommit(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8,
                border: '1px solid var(--border)',
                background: showCommit ? 'rgba(255,107,53,0.08)' : 'var(--card)',
                color: showCommit ? 'var(--orange)' : 'var(--dim)',
                fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer', transition: 'all 0.12s',
              }}>
              <CommitIcon /> Commit
            </button>

            <button onClick={handlePull} disabled={!behindCount || pulling}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8,
                border: `1px solid ${behindCount > 0 ? 'rgba(74,255,145,0.3)' : 'var(--border)'}`,
                background: behindCount > 0 ? 'rgba(74,255,145,0.06)' : 'var(--card)',
                color: behindCount > 0 ? '#4aff91' : 'var(--dimmer)',
                fontSize: 12, fontFamily: 'Geist, sans-serif',
                cursor: behindCount > 0 && !pulling ? 'pointer' : 'not-allowed',
                opacity: behindCount > 0 ? 1 : 0.55, transition: 'all 0.12s',
              }}>
              <DownloadIcon />
              {pulling ? 'Pulling…' : behindCount > 0 ? `Pull (↓ ${behindCount})` : 'Pull (up to date)'}
            </button>

            <button onClick={handlePush} disabled={pushing || aheadCount === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8,
                border: `1px solid ${aheadCount > 0 ? 'rgba(255,107,53,0.3)' : 'var(--border)'}`,
                background: aheadCount > 0 ? 'rgba(255,107,53,0.06)' : 'var(--card)',
                color: aheadCount > 0 ? 'var(--orange)' : 'var(--dimmer)',
                fontSize: 12, fontFamily: 'Geist, sans-serif',
                cursor: aheadCount > 0 && !pushing ? 'pointer' : 'not-allowed',
                opacity: aheadCount > 0 ? 1 : 0.55, transition: 'all 0.12s',
              }}>
              <ExternalLinkIcon />
              {pushing ? 'Pushing…' : aheadCount > 0 ? `Push (↑ ${aheadCount})` : 'Push (synced)'}
            </button>
          </div>

          {/* Commit panel */}
          {showCommit && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
                {(gitStatus?.staged?.length || 0) > 0
                  ? `Committing ${gitStatus.staged.length} staged file${gitStatus.staged.length === 1 ? '' : 's'}`
                  : 'No files staged — all changes will be committed'}
              </div>
              <textarea
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                placeholder="Describe your changes…"
                rows={3}
                style={{
                  width: '100%', background: 'var(--base)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)',
                  fontFamily: 'Geist, sans-serif', resize: 'vertical', minHeight: 72,
                  outline: 'none', lineHeight: 1.5, transition: 'border-color 0.12s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              {commitResult && (
                <div style={{
                  fontSize: 11, padding: '7px 10px', borderRadius: 6, fontFamily: 'Geist Mono, monospace',
                  background: commitResult.ok ? 'rgba(74,255,145,0.08)' : 'rgba(255,68,68,0.08)',
                  border: `1px solid ${commitResult.ok ? 'rgba(74,255,145,0.2)' : 'rgba(255,68,68,0.2)'}`,
                  color: commitResult.ok ? '#4aff91' : '#ff4444',
                }}>
                  {commitResult.ok
                    ? commitResult.pushed ? '✓ Committed and pushed to remote' : '✓ Committed (push skipped — no remote or push failed)'
                    : `✗ ${commitResult.message}`}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowCommit(false); setCommitMsg(''); setCommitResult(null) }}
                  style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleCommit} disabled={!commitMsg.trim() || committing}
                  style={{
                    padding: '7px 16px', borderRadius: 7, border: 'none',
                    background: commitMsg.trim() && !committing ? 'var(--orange)' : 'var(--dimmer)',
                    color: '#fff', fontSize: 12, fontWeight: 500, fontFamily: 'Geist, sans-serif',
                    cursor: commitMsg.trim() && !committing ? 'pointer' : 'not-allowed',
                  }}>
                  {committing ? 'Committing…' : 'Commit & Push'}
                </button>
              </div>
            </div>
          )}

          {/* Branch switcher */}
          <InfoSection label="Branches">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {branches.map(b => (
                <button key={b.name}
                  onClick={() => !b.current && !branchOp && handleSwitchBranch(b.name)}
                  disabled={b.current || !!branchOp}
                  style={{
                    fontFamily: 'Geist Mono, monospace', fontSize: 11, padding: '4px 10px', borderRadius: 5,
                    background: b.current ? 'rgba(255,107,53,0.1)' : 'var(--card)',
                    border: `1px solid ${b.current ? 'rgba(255,107,53,0.3)' : 'var(--border)'}`,
                    color: b.current ? 'var(--orange)' : 'var(--dim)',
                    cursor: b.current ? 'default' : 'pointer',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { if (!b.current) e.currentTarget.style.borderColor = 'var(--border-bright)' }}
                  onMouseLeave={e => { if (!b.current) e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  {b.current ? '● ' : '○ '}{b.name}
                  {branchOp === 'switching' && !b.current ? ' …' : ''}
                </button>
              ))}

              {/* New branch */}
              {!branchOpen ? (
                <button onClick={() => setBranchOpen(true)}
                  style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, padding: '4px 10px', borderRadius: 5,
                    background: 'transparent', border: '1px dashed var(--border)', color: 'var(--dimmer)',
                    cursor: 'pointer', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--dim)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--dimmer)' }}
                >+ new</button>
              ) : (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <input
                    autoFocus
                    value={newBranch}
                    onChange={e => setNewBranch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateBranch(); if (e.key === 'Escape') { setBranchOpen(false); setNewBranch('') } }}
                    placeholder="branch-name"
                    style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, padding: '4px 8px', borderRadius: 5,
                      background: 'var(--base)', border: '1px solid var(--border-bright)', color: 'var(--text)',
                      outline: 'none', width: 130 }}
                  />
                  <button onClick={handleCreateBranch} disabled={!newBranch.trim() || !!branchOp}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: 'none',
                      background: newBranch.trim() ? 'var(--orange)' : 'var(--dimmer)', color: '#fff',
                      cursor: newBranch.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Geist, sans-serif' }}>
                    {branchOp === 'creating' ? '…' : 'Create'}
                  </button>
                  <button onClick={() => { setBranchOpen(false); setNewBranch('') }}
                    style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--dim)', cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </InfoSection>

          {/* Commit history */}
          <InfoSection label={`Commit History${gitLog.length > 0 ? ` (${gitLog.length})` : ''}`}>
            {gitLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--dimmer)', fontSize: 12 }}>No commits yet</div>
            ) : (
              <div style={{ marginTop: 4 }}>
                {gitLog.map((commit, i) => (
                  <div key={commit.hash} style={{ display: 'flex' }}>
                    {/* Timeline column */}
                    <div style={{ width: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{
                        width: 9, height: 9, borderRadius: '50%', marginTop: 18, flexShrink: 0,
                        background: authorColor(commit.author || ''),
                        boxShadow: `0 0 0 2px var(--surface)`,
                        zIndex: 1,
                      }} />
                      {i < gitLog.length - 1 && (
                        <div style={{ width: 1, flex: 1, background: 'var(--border)', minHeight: 10 }} />
                      )}
                    </div>
                    {/* Commit info */}
                    <div style={{ flex: 1, padding: '10px 6px 14px 6px', borderBottom: i < gitLog.length - 1 ? '1px solid var(--border)' : 'none', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--orange)', flexShrink: 0, paddingTop: 1 }}>
                          {commit.hash}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.45, flex: 1 }}>{commit.message}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          background: authorColor(commit.author || ''),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 7, fontWeight: 800, color: '#000', letterSpacing: 0,
                        }}>{initials(commit.author || '')}</div>
                        <span style={{ fontSize: 10, color: 'var(--dim)' }}>{commit.author || 'Unknown'}</span>
                        <span style={{ fontSize: 10, color: 'var(--dimmer)' }}>·</span>
                        <span style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>{commit.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InfoSection>
        </>
      )}
    </div>
  )
}
