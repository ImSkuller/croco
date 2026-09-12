import { useState } from 'react'
import {
  GithubIcon, CommitIcon, DownloadIcon, RefreshIcon, BranchIcon, ExternalLinkIcon,
  PackageIcon, CheckIcon, XCircleIcon, AIIcon, TrashIcon,
} from '../../constants/SimpleSvgExports'
import OpenPrModal from './OpenPrModal'
import { authorColor, initials } from '../../lib/projectDetailHelpers'
import { useData } from '../../lib/store'
import InfoSection from './InfoSection'
import Chip from './Chip'
import Spinner from './Spinner'
import DiffView from './DiffView'
import { EmptyState } from '../ui/EmptyState'
import StashPanel from './StashPanel'

export default function GitPanel({
  project, projectId, toast,
  isRepo, setIsRepo, initingRepo, setInitingRepo,
  gitLoading, gitStatus, setGitStatus, gitLog, setGitLog, branches, setBranches,
  syncLoading, aheadBehind, behindCount, aheadCount, checkRemote,
  openDiff, diffLoading, diffText, toggleDiff,
  handleStageFiles, handleUnstageFiles, handleDiscardFile, refreshGitStatus,
  showCommit, setShowCommit, commitMsg, setCommitMsg, commitResult, setCommitResult, committing, handleCommit,
  pulling, handlePull, pushing, handlePush,
  setPublishName, setPublishDesc, setPublishError, setPublishModal,
  branchOp, branchOpen, setBranchOpen, newBranch, setNewBranch, handleCreateBranch, handleSwitchBranch,
  handleDeleteBranch, dirtySwitch, setDirtySwitch,
}) {
  const settings = useData('settings')
  const aiEnabled = !!settings?.ai?.commitMessages?.enabled
  const [generatingMsg, setGeneratingMsg] = useState(false)
  const [amendCommit, setAmendCommit] = useState(false)
  const [prOpen, setPrOpen] = useState(false)
  // Same click-to-arm pattern as discard, for branch deletion.
  const [deleteArmed, setDeleteArmed] = useState(null)
  const headPushed = !!gitStatus?.headPushed
  const canOpenPr = !!project.github && aheadBehind && !aheadBehind.unavailable && !!gitStatus?.branch
  // Two-step confirm (click to arm, click again to actually discard) rather
  // than a native confirm() dialog — matches the click-again pattern used
  // elsewhere in Settings for destructive-but-quick actions, and it's an
  // irreversible action (untracked files are gone for good; tracked ones
  // lose their uncommitted work) so a bare button would be too easy to fat-finger.
  const [discardArmed, setDiscardArmed] = useState(null)

  const handleDiscardClick = (type, f) => {
    const key = `${type}:${f}`
    if (discardArmed === key) {
      setDiscardArmed(null)
      handleDiscardFile(f, type)
    } else {
      setDiscardArmed(key)
      setTimeout(() => setDiscardArmed(prev => (prev === key ? null : prev)), 3000)
    }
  }

  const handleGenerateCommitMessage = async () => {
    if (!window.api || generatingMsg) return
    setGeneratingMsg(true)
    try {
      const message = await window.api.git.generateCommitMessage(projectId)
      setCommitMsg(message)
    } catch (e) {
      toast.error('Could not generate message', e.message)
    } finally {
      setGeneratingMsg(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {!isRepo ? (
        <EmptyState compact mono
          icon={<PackageIcon size={24} />}
          title="No git repository at project path"
          body={project.paths?.projectRoot}
          action={<button
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
            style={{ padding: '8px 18px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: initingRepo ? 'not-allowed' : 'pointer', opacity: initingRepo ? 0.6 : 1 }}
          >
            {initingRepo ? 'Initialising…' : 'Initialize Repository'}
          </button>}
        />
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
              borderRadius: 'var(--r-lg)', padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: gitStatus.clean ? 0 : 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text)', fontFamily: 'Geist Mono, monospace' }}>
                  <BranchIcon />
                  <span style={{ fontWeight: 600 }}>{gitStatus.branch}</span>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {gitStatus.clean ? (
                    <Chip c="#4aff91" bg="rgba(74,255,145,0.1)"><CheckIcon size={10} /> clean</Chip>
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
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: 'Geist Mono, monospace', color: behindCount > 0 ? '#4aff91' : aheadCount > 0 ? 'var(--orange)' : 'var(--dimmer)' }}>
                        {behindCount > 0 ? `↓ ${behindCount} behind` : aheadCount > 0 ? `↑ ${aheadCount} ahead` : <><CheckIcon size={10} /> synced with remote</>}
                      </span>
                    : null
                  }
                  <button onClick={checkRemote} title="Refresh remote status"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', padding: 2, display: 'flex', borderRadius: 'var(--r-sm)', transition: 'color var(--transition-fast)' }}
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
                          borderRadius: 'var(--r-sm)', flexShrink: 0, minWidth: 62, textAlign: 'center',
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
                            borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent',
                            color: 'var(--dimmer)', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0,
                          }}
                        >{type === 'staged' ? '−' : '+'}</button>
                        {type !== 'staged' && (
                          <button
                            onClick={() => handleDiscardClick(type, f)}
                            title={discardArmed === `${type}:${f}` ? 'Click again to discard permanently' : (type === 'untracked' ? 'Delete file' : 'Discard changes')}
                            style={{
                              flexShrink: 0, height: 18, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: 'var(--r-sm)', border: `1px solid ${discardArmed === `${type}:${f}` ? '#ff4444' : 'var(--border)'}`,
                              background: discardArmed === `${type}:${f}` ? 'rgba(255,68,68,0.12)' : 'transparent',
                              color: discardArmed === `${type}:${f}` ? '#ff4444' : 'var(--dimmer)',
                              cursor: 'pointer', fontSize: 9, fontFamily: 'Geist Mono, monospace', whiteSpace: 'nowrap',
                            }}
                          >{discardArmed === `${type}:${f}` ? 'confirm?' : 'discard'}</button>
                        )}
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
            <div style={{ padding: '12px 16px', borderRadius: 'var(--r-lg)', background: 'var(--card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>No remote configured</div>
                <div style={{ fontSize: 11, color: 'var(--dimmer)' }}>Publish this repository to GitHub to enable push/pull.</div>
              </div>
              <button
                onClick={() => { setPublishName(project.name || ''); setPublishDesc(project.description || ''); setPublishError(''); setPublishModal(true) }}
                style={{ padding: '7px 14px', borderRadius: 'var(--r-md)', border: 'none', background: '#24292e', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <GithubIcon /> Publish to GitHub
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowCommit(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                background: showCommit ? 'rgba(255,107,53,0.08)' : 'var(--card)',
                color: showCommit ? 'var(--orange)' : 'var(--dim)',
                fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer', transition: 'all var(--transition-fast)',
              }}>
              <CommitIcon /> Commit
            </button>

            <button onClick={handlePull} disabled={!behindCount || pulling}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--r-md)',
                border: `1px solid ${behindCount > 0 ? 'rgba(74,255,145,0.3)' : 'var(--border)'}`,
                background: behindCount > 0 ? 'rgba(74,255,145,0.06)' : 'var(--card)',
                color: behindCount > 0 ? '#4aff91' : 'var(--dimmer)',
                fontSize: 12, fontFamily: 'Geist, sans-serif',
                cursor: behindCount > 0 && !pulling ? 'pointer' : 'not-allowed',
                opacity: behindCount > 0 ? 1 : 0.55, transition: 'all var(--transition-fast)',
              }}>
              <DownloadIcon />
              {pulling ? 'Pulling…' : behindCount > 0 ? `Pull (↓ ${behindCount})` : 'Pull (up to date)'}
            </button>

            <button onClick={handlePush} disabled={pushing || aheadCount === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--r-md)',
                border: `1px solid ${aheadCount > 0 ? 'rgba(255,107,53,0.3)' : 'var(--border)'}`,
                background: aheadCount > 0 ? 'rgba(255,107,53,0.06)' : 'var(--card)',
                color: aheadCount > 0 ? 'var(--orange)' : 'var(--dimmer)',
                fontSize: 12, fontFamily: 'Geist, sans-serif',
                cursor: aheadCount > 0 && !pushing ? 'pointer' : 'not-allowed',
                opacity: aheadCount > 0 ? 1 : 0.55, transition: 'all var(--transition-fast)',
              }}>
              <ExternalLinkIcon />
              {pushing ? 'Pushing…' : aheadCount > 0 ? `Push (↑ ${aheadCount})` : 'Push (synced)'}
            </button>

            {canOpenPr && (
              <button onClick={() => setPrOpen(true)} title="Open a pull request from this branch on GitHub"
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--dim)',
                  fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer', transition: 'all var(--transition-fast)',
                }}>
                <BranchIcon /> Open PR
              </button>
            )}
          </div>

          {prOpen && (
            <OpenPrModal
              projectId={projectId}
              headBranch={gitStatus.branch}
              fallbackBase={settings?.defaults?.gitBranch || 'main'}
              onClose={() => setPrOpen(false)}
            />
          )}

          {/* Commit panel */}
          {showCommit && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
                  {(gitStatus?.staged?.length || 0) > 0
                    ? `Committing ${gitStatus.staged.length} staged file${gitStatus.staged.length === 1 ? '' : 's'}`
                    : 'No files staged — all changes will be committed'}
                </div>
                {aiEnabled && (
                  <button
                    onClick={handleGenerateCommitMessage}
                    disabled={generatingMsg}
                    title="Generate a commit message from the diff with AI"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                      padding: '4px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--dim)', fontSize: 11,
                      fontFamily: 'Geist, sans-serif', cursor: generatingMsg ? 'default' : 'pointer',
                      opacity: generatingMsg ? 0.6 : 1,
                    }}
                  >
                    <AIIcon size={12} /> {generatingMsg ? 'Generating…' : 'Generate with AI'}
                  </button>
                )}
              </div>
              <textarea
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                placeholder="Describe your changes…"
                rows={3}
                style={{
                  width: '100%', background: 'var(--base)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)', padding: '10px 12px', fontSize: 13, color: 'var(--text)',
                  fontFamily: 'Geist, sans-serif', resize: 'vertical', minHeight: 72,
                  outline: 'none', lineHeight: 1.5, transition: 'border-color var(--transition-fast)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--border-bright)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              {commitResult && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, padding: '7px 10px', borderRadius: 'var(--r-md)', fontFamily: 'Geist Mono, monospace',
                  background: commitResult.ok ? 'rgba(74,255,145,0.08)' : 'rgba(255,68,68,0.08)',
                  border: `1px solid ${commitResult.ok ? 'rgba(74,255,145,0.2)' : 'rgba(255,68,68,0.2)'}`,
                  color: commitResult.ok ? '#4aff91' : '#ff4444',
                }}>
                  {commitResult.ok
                    ? <><CheckIcon size={12} /> {commitResult.pushed ? 'Committed and pushed to remote' : commitResult.pushRequested === false ? 'Committed locally' : 'Committed (push skipped — no remote or push failed)'}</>
                    : <><XCircleIcon size={12} /> {commitResult.message}</>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label
                  title={headPushed ? 'The last commit is already on the remote — amending it would rewrite shared history' : 'Replace the last commit instead of adding a new one'}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: headPushed ? 'var(--dimmer)' : 'var(--dim)', cursor: headPushed ? 'not-allowed' : 'pointer', marginRight: 'auto' }}
                >
                  <input type="checkbox" checked={amendCommit} disabled={headPushed} onChange={e => setAmendCommit(e.target.checked)} />
                  Amend last commit
                </label>
                <button onClick={() => { setShowCommit(false); setCommitMsg(''); setCommitResult(null); setAmendCommit(false) }}
                  style={{ padding: '7px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => handleCommit(false, amendCommit)} disabled={!commitMsg.trim() || committing}
                  title="Commit locally without pushing"
                  style={{
                    padding: '7px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
                    background: 'var(--card)', color: commitMsg.trim() && !committing ? 'var(--text)' : 'var(--dimmer)',
                    fontSize: 12, fontWeight: 500, fontFamily: 'Geist, sans-serif',
                    cursor: commitMsg.trim() && !committing ? 'pointer' : 'not-allowed',
                  }}>
                  {amendCommit ? 'Amend' : 'Commit'}
                </button>
                <button onClick={() => handleCommit(true, amendCommit)} disabled={!commitMsg.trim() || committing}
                  style={{
                    padding: '7px 16px', borderRadius: 'var(--r-md)', border: 'none',
                    background: commitMsg.trim() && !committing ? 'var(--orange)' : 'var(--dimmer)',
                    color: '#fff', fontSize: 12, fontWeight: 500, fontFamily: 'Geist, sans-serif',
                    cursor: commitMsg.trim() && !committing ? 'pointer' : 'not-allowed',
                  }}>
                  {committing ? 'Committing…' : amendCommit ? 'Amend & Push' : 'Commit & Push'}
                </button>
              </div>
            </div>
          )}

          {/* Branch switcher */}
          <InfoSection label="Branches">
            {dirtySwitch && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10,
                padding: '9px 12px', borderRadius: 'var(--r-md)',
                background: 'rgba(255,107,53,0.06)', border: '1px solid rgba(255,107,53,0.25)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, minWidth: 200 }}>
                  Uncommitted changes are blocking the switch to <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--orange)' }}>{dirtySwitch.branch}</span>.
                </span>
                <button onClick={() => handleSwitchBranch(dirtySwitch.branch, true)} disabled={!!branchOp}
                  style={{ padding: '5px 12px', borderRadius: 'var(--r-sm)', border: 'none', background: 'var(--orange)', color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                  {branchOp === 'switching' ? 'Switching…' : 'Stash & switch'}
                </button>
                <button onClick={() => setDirtySwitch(null)}
                  style={{ padding: '5px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                  Dismiss
                </button>
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {branches.map(b => (
                <div key={b.name} style={{ display: 'inline-flex', alignItems: 'stretch' }}>
                  <button
                    onClick={() => !b.current && !branchOp && handleSwitchBranch(b.name)}
                    disabled={b.current || !!branchOp}
                    style={{
                      fontFamily: 'Geist Mono, monospace', fontSize: 11, padding: '4px 10px',
                      borderRadius: b.current ? 'var(--r-sm)' : 'var(--r-sm) 0 0 var(--r-sm)',
                      background: b.current ? 'rgba(255,107,53,0.1)' : 'var(--card)',
                      border: `1px solid ${b.current ? 'rgba(255,107,53,0.3)' : 'var(--border)'}`,
                      color: b.current ? 'var(--orange)' : 'var(--dim)',
                      cursor: b.current ? 'default' : 'pointer',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={e => { if (!b.current) e.currentTarget.style.borderColor = 'var(--border-bright)' }}
                    onMouseLeave={e => { if (!b.current) e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    {b.current ? '● ' : '○ '}{b.name}
                    {branchOp === 'switching' && !b.current ? ' …' : ''}
                  </button>
                  {!b.current && (
                    deleteArmed === b.name ? (
                      <>
                        <button onClick={() => { setDeleteArmed(null); handleDeleteBranch(b.name, false) }} title="Delete the local branch only"
                          style={{ fontSize: 10, padding: '0 8px', border: '1px solid #ff4444', borderLeft: 'none', background: 'rgba(255,68,68,0.12)', color: '#ff4444', cursor: 'pointer', fontFamily: 'Geist Mono, monospace' }}>
                          local
                        </button>
                        <button onClick={() => { setDeleteArmed(null); handleDeleteBranch(b.name, true) }} title="Delete locally and on origin"
                          style={{ fontSize: 10, padding: '0 8px', borderRadius: '0 var(--r-sm) var(--r-sm) 0', border: '1px solid #ff4444', borderLeft: 'none', background: 'rgba(255,68,68,0.2)', color: '#ff4444', cursor: 'pointer', fontFamily: 'Geist Mono, monospace' }}>
                          + remote
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setDeleteArmed(b.name); setTimeout(() => setDeleteArmed(prev => (prev === b.name ? null : prev)), 4000) }}
                        title="Delete branch"
                        disabled={!!branchOp}
                        style={{ display: 'flex', alignItems: 'center', padding: '0 6px', borderRadius: '0 var(--r-sm) var(--r-sm) 0', border: '1px solid var(--border)', borderLeft: 'none', background: 'var(--card)', color: 'var(--dimmer)', cursor: 'pointer', transition: 'color var(--transition-fast)' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ff4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--dimmer)'}
                      ><TrashIcon size={10} /></button>
                    )
                  )}
                </div>
              ))}

              {/* New branch */}
              {!branchOpen ? (
                <button onClick={() => setBranchOpen(true)}
                  style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, padding: '4px 10px', borderRadius: 'var(--r-sm)',
                    background: 'transparent', border: '1px dashed var(--border)', color: 'var(--dimmer)',
                    cursor: 'pointer', transition: 'all var(--transition-fast)' }}
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
                    style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, padding: '4px 8px', borderRadius: 'var(--r-sm)',
                      background: 'var(--base)', border: '1px solid var(--border-bright)', color: 'var(--text)',
                      outline: 'none', width: 130 }}
                  />
                  <button onClick={handleCreateBranch} disabled={!newBranch.trim() || !!branchOp}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--r-sm)', border: 'none',
                      background: newBranch.trim() ? 'var(--orange)' : 'var(--dimmer)', color: '#fff',
                      cursor: newBranch.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Geist, sans-serif' }}>
                    {branchOp === 'creating' ? '…' : 'Create'}
                  </button>
                  <button onClick={() => { setBranchOpen(false); setNewBranch('') }}
                    style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--dim)', cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </InfoSection>

          <StashPanel projectId={projectId} toast={toast} onChanged={refreshGitStatus} />

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
