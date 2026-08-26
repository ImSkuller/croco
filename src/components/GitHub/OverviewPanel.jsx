import RepoInfoCard from './RepoInfoCard'

export default function OverviewPanel({ projects }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, alignContent: 'start' }}>
      {projects.map(p => <RepoInfoCard key={p.id} project={p} />)}
    </div>
  )
}
