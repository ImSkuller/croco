import { HashRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { applyTheme } from './lib/theme.js'
import { applyStyle } from './lib/appearanceStyle.js'
import AppShell from './components/layout/AppShell'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Notes from './pages/Notes'
import Settings from './pages/Settings'
import Todo from './pages/Todo'
import Favourites from './pages/Favourites'
import Activity from './pages/Activity'
import Patterns from './pages/Patterns'
import GitHubPage from './pages/GitHub'
import NoteEditor from './pages/NoteEditor'
import Onboarding from './pages/Onboarding'
import ProjectDetail from './pages/ProjectDetail'
import ProjectForm from './pages/ProjectForm'
import Ideas from './pages/Ideas'
import EasterEggs from './pages/EasterEggs'

export default function App() {
  useEffect(() => {
    if (!window.api) return
    window.api.settings.get().then(s => {
      applyTheme(
        s?.appearance?.theme || 'default',
        s?.appearance?.glass || false,
        {
          accentColor: s?.appearance?.accentColor,
          fontBody:    s?.appearance?.fontBody,
          fontDisplay: s?.appearance?.fontDisplay,
          logoBg:      s?.appearance?.logoBg,
        }
      )
      applyStyle(s?.appearance?.style || 'default')
    }).catch(() => {})
    // Once per launch, for the Patterns page's login streak.
    window.api.personality?.trackAppOpen?.().catch(() => {})
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="notes" element={<Notes />} />
          <Route path="settings" element={<Settings />} />
          <Route path="todos" element={<Todo />} />
          <Route path="favourites" element={<Favourites />} />
          <Route path="activity" element={<Activity />} />
          <Route path="patterns" element={<Patterns />} />
          <Route path="github" element={<GitHubPage />} />
          <Route path="ideas" element={<Ideas />} />
          <Route path="easter-eggs" element={<EasterEggs />} />
          <Route path="note-editor" element={<NoteEditor />} />
          <Route path="note-editor/:noteId" element={<NoteEditor />} />

          {/* Initial setup flow shown on first launch */}
          <Route path="onboarding" element={<Onboarding />} />

          {/* Dynamic routes for project detail and creation */}
          <Route path="projects/new" element={<ProjectForm />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />

          {/* Catch-all */}
          <Route path="*" element={<Dashboard />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
