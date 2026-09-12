import { Navigate } from 'react-router-dom'
import { useData } from '../../lib/store'

// Guards a module page (e.g. /ai, /ide) against stale navigation — a link
// clicked while the module was on, then the module got disabled, or a
// direct URL/history entry from before it existed. The sidebar already
// only shows these links when enabled; this just covers everything else.
export default function RequireModule({ module, children }) {
  const settings = useData('settings')
  if (settings && !settings.modules?.[module]?.enabled) {
    return <Navigate to="/" replace />
  }
  return children
}
