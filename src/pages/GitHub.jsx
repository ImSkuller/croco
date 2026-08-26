import { useState } from 'react'
import { useData, EMPTY_LIST } from '../lib/store'
import OverviewPanel from '../components/GitHub/OverviewPanel'
import ReleasesTagsPanel from '../components/GitHub/ReleasesTagsPanel'
import ChangelogPanel from '../components/GitHub/ChangelogPanel'
import InsightsPanel from '../components/GitHub/InsightsPanel'

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'releases',  label: 'Releases & Tags' },
  { id: 'changelog', label: 'Changelog' },
  { id: 'insights',  label: 'Insights' },
]

function EmptyLinkedState() {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--dimmer)', fontSize: 13 }}>
      No GitHub-linked projects yet.<br />
      Publish a project to GitHub from its Git tab to see it here.
    </div>
  )
}

export default function GitHubPage() {
  const projects = useData('projects') || EMPTY_LIST
  const [tab, setTab] = useState('overview')

  const linkedProjects = projects.filter(p => p.github && !p.archived)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>GitHub</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {TABS.find(t => t.id === tab)?.label}
        </span>
      </div>

      <div style={{ display: 'flex', padding: '0 28px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '11px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontFamily: 'Geist, sans-serif', fontWeight: tab === t.id ? 500 : 400,
              color: tab === t.id ? 'var(--text)' : 'var(--dim)',
              borderBottom: tab === t.id ? '2px solid var(--orange)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.12s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div key={tab} className="pm-tab-content" style={{ padding: '20px 28px' }}>
          {tab === 'overview'  && (linkedProjects.length ? <OverviewPanel projects={linkedProjects} /> : <EmptyLinkedState />)}
          {tab === 'releases'  && (linkedProjects.length ? <ReleasesTagsPanel projects={linkedProjects} /> : <EmptyLinkedState />)}
          {tab === 'changelog' && (linkedProjects.length ? <ChangelogPanel projects={linkedProjects} /> : <EmptyLinkedState />)}
          {/* Insights always renders — "Overall" mode uses cross-project data even with no linked repos */}
          {tab === 'insights'  && <InsightsPanel projects={linkedProjects} />}
        </div>
      </div>
    </div>
  )
}
