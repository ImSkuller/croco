import { FileIcon } from '../../constants/SimpleSvgExports'
import { renderMarkdown } from '../../lib/projectDetailHelpers'
import Spinner from './Spinner'
import { EmptyState } from '../ui/EmptyState'

export default function ReadmeTab({ readme, readmeLoading }) {
  return (
    <div>
      {readmeLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0' }}>
          <Spinner size={14} />
          <span style={{ fontSize: 12, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>Loading README…</span>
        </div>
      ) : readme === false || !readme ? (
        <EmptyState compact mono icon={<FileIcon size={24} />} title="No README found" body="Add a README.md to your project root" />
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--dimmer)', background: 'var(--border)', padding: '3px 8px', borderRadius: 'var(--r-sm)' }}>
              {readme.filename}
            </span>
          </div>
          <div
            className="markdown-body"
            style={{
              fontSize: 13, lineHeight: 1.7, color: 'var(--text)',
              '--md-code-bg': 'var(--card)',
            }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(readme.content) }}
          />
        </div>
      )}
    </div>
  )
}
