import { useEffect } from 'react'
import { useData, useDataStore, EMPTY_LIST } from '../lib/store'
import { RefreshIcon } from '../constants/SimpleSvgExports'
import SummaryStrip from '../components/Patterns/SummaryStrip'
import StreakHero from '../components/Patterns/StreakHero'
import StreakCard from '../components/Patterns/StreakCard'
import CommitRhythmCard from '../components/Patterns/CommitRhythmCard'
import TodoCompletionCard from '../components/Patterns/TodoCompletionCard'
import ProjectAttentionCard from '../components/Patterns/ProjectAttentionCard'
import NotesRhythmCard from '../components/Patterns/NotesRhythmCard'
import CommitHeatmapCard from '../components/Patterns/CommitHeatmapCard'
import WeeklyTrendCard from '../components/Patterns/WeeklyTrendCard'
import LanguageMixCard from '../components/Patterns/LanguageMixCard'

const COMMIT_SCAN_TTL_MS = 5 * 60 * 1000 // rescan git logs at most every 5 min on auto-visit

export default function Patterns() {
  const profile  = useData('personality')
  const projects = useData('projects') || EMPTY_LIST
  const ensure   = useDataStore(s => s.ensure)

  useEffect(() => {
    if (!window.api || !profile) return
    // Untouched defaults on first-ever visit — backfill once from the
    // (capped) activity log so existing users see something meaningful
    // instead of a blank slate.
    if (profile.totalCommits === 0 && profile.notesCreated === 0 && profile.todosCreated === 0) {
      window.api.personality.backfillFromActivity()
        .then(() => ensure('personality', { force: true }))
        .catch(() => {})
    }
    // Commit stats are derived from `git log` across every tracked project,
    // not just commits made through Croco. Rescan whenever the last scan is
    // missing or stale, so commits made via terminal/another IDE show up
    // without the user having to remember to hit Refresh.
    const lastScan = profile.lastCommitScanAt ? new Date(profile.lastCommitScanAt).getTime() : 0
    if (Date.now() - lastScan > COMMIT_SCAN_TTL_MS) {
      window.api.personality.scanCommits()
        .then(() => ensure('personality', { force: true }))
        .catch(() => {})
    }
  }, [profile, ensure])

  function rescan() {
    if (!window.api) return
    window.api.personality.scanCommits()
      .catch(() => {})
      .finally(() => ensure('personality', { force: true }))
  }

  if (profile === null) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 13 }}>
        Loading patterns…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>Patterns</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Your work habits</span>
        <button
          onClick={rescan}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, cursor: 'pointer', fontFamily: 'Geist, sans-serif' }}
        >
          <RefreshIcon /> Refresh
        </button>
      </div>

      <div style={{ padding: 20, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, alignContent: 'start' }}>
        <StreakHero commitDates={profile.commitDates || []} appOpenDates={profile.appOpenDates || []} />
        <SummaryStrip profile={profile} projectsTracked={projects.length} />
        <CommitHeatmapCard commitDates={profile.commitDates || []} />
        <StreakCard dates={profile.commitDates || []} label="Commit Streak" accentColor="var(--accent)" />
        <StreakCard dates={profile.appOpenDates || []} label="App Login Streak" accentColor="var(--blue)" />
        <WeeklyTrendCard commitDates={profile.commitDates || []} />
        <CommitRhythmCard
          commitsByHour={profile.commitsByHour || Array(24).fill(0)}
          commitsByWeekday={profile.commitsByWeekday || Array(7).fill(0)}
          totalCommits={profile.totalCommits || 0}
        />
        <TodoCompletionCard todosCreated={profile.todosCreated || 0} todosCompleted={profile.todosCompleted || 0} />
        <NotesRhythmCard notesCreated={profile.notesCreated || 0} notesByWeekday={profile.notesByWeekday || Array(7).fill(0)} />
        <LanguageMixCard projects={projects} />
        <ProjectAttentionCard projectStats={profile.projectStats || {}} projects={projects} />
      </div>
    </div>
  )
}
