import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { marked } from 'marked'
import { ArrowLeftIcon, StarIcon, TagIcon, FolderIcon } from '../constants/SimpleSvgExports'
import { modKeyHint } from '../lib/platform'

marked.setOptions({ gfm: true, breaks: true })

const EMOJIS = ['📡', '📁', '⚡', '🎨', '🔧', '🌐', '💡', '🗒️', '🔬', '📊', '🛠️', '🚀', '📝', '🧪', '🎯', '🔑']

const TOOLBAR = [
  { label: 'H1',  title: 'Heading 1',      before: '# ',    after: '',     newLine: true  },
  { label: 'H2',  title: 'Heading 2',      before: '## ',   after: '',     newLine: true  },
  { label: 'H3',  title: 'Heading 3',      before: '### ',  after: '',     newLine: true  },
  null,
  { label: 'B',   title: `Bold (${modKeyHint('B')})`,   before: '**',    after: '**',   newLine: false },
  { label: 'I',   title: `Italic (${modKeyHint('I')})`, before: '*',     after: '*',    newLine: false },
  { label: '~~',  title: 'Strikethrough',   before: '~~',    after: '~~',   newLine: false },
  null,
  { label: '`',   title: 'Inline code',     before: '`',     after: '`',    newLine: false },
  { label: '```', title: 'Code block',      before: '```\n', after: '\n```',newLine: true  },
  null,
  { label: '—',   title: 'Bullet list',     before: '- ',    after: '',     newLine: true  },
  { label: '1.',  title: 'Ordered list',    before: '1. ',   after: '',     newLine: true  },
  { label: '☐',  title: 'Task list',       before: '- [ ] ', after: '',    newLine: true  },
  { label: '"',   title: 'Blockquote',      before: '> ',    after: '',     newLine: true  },
  { label: '─',   title: 'Horizontal rule', before: '\n---\n',after: '',    newLine: true  },
  { label: '[…]', title: 'Link',            before: '[',     after: '](url)',newLine: false },
]

export default function NoteEditor() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { noteId } = useParams()
  const editorRef  = useRef(null)
  const previewRef = useRef(null)

  const [title,     setTitle]     = useState('Untitled Note')
  const [content,   setContent]   = useState('')
  const [emoji,     setEmoji]     = useState('📝')
  // Pre-filled from router state when navigated from a project's Notes tab
  // (only relevant for a brand-new note — an existing noteId's projectId
  // gets set from the fetched note itself in the effect below).
  const [projectId, setProjectId] = useState(() => (!noteId && location.state?.projectId) || null)
  const [starred,   setStarred]   = useState(false)
  const [archived,  setArchived]  = useState(false)
  const [tags,      setTags]      = useState([])
  const [tagInput,  setTagInput]  = useState('')
  const [saved,     setSaved]     = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [viewMode,  setViewMode]  = useState(() => location.state?.viewMode || 'split')
  const [showMeta,  setShowMeta]  = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [projects,  setProjects]  = useState([])
  const [createdAt, setCreatedAt] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [currentId, setCurrentId] = useState(noteId || null)

  useEffect(() => {
    if (!noteId || !window.api) return
    window.api.notes.getById(noteId)
      .then(note => {
        if (!note) return
        setTitle(note.title)
        setContent(note.content || '')
        setEmoji(note.emoji || '📝')
        setProjectId(note.projectId || null)
        setStarred(note.starred || false)
        setArchived(note.archived || false)
        setTags(note.tags || [])
        setCreatedAt(note.createdAt)
        setUpdatedAt(note.updatedAt)
        setCurrentId(note.id)
      })
      .catch(console.error)
  }, [noteId])

  useEffect(() => {
    if (!window.api) return
    window.api.projects.getAll().then(setProjects).catch(console.error)
  }, [])

  useEffect(() => { if (viewMode !== 'preview') editorRef.current?.focus() }, [])

  const wordCount   = content.trim() ? content.trim().split(/\s+/).length : 0
  const charCount   = content.length
  const previewHtml = marked.parse(content || '*Start writing to see a preview…*')

  useEffect(() => {
    if (viewMode === 'edit') return
    const container = previewRef.current
    if (!container) return
    const blocks = container.querySelectorAll('pre')
    blocks.forEach(pre => {
      if (pre.querySelector('.copy-btn')) return // already has button
      const btn = document.createElement('button')
      btn.className = 'copy-btn'
      btn.textContent = 'Copy'
      btn.style.cssText = [
        'position:absolute', 'top:8px', 'right:8px', 'padding:3px 9px',
        'border-radius:5px', 'border:1px solid rgba(255,255,255,0.15)',
        'background:rgba(255,255,255,0.08)', 'color:#aaa', 'font-size:10px',
        'font-family:Geist,sans-serif', 'cursor:pointer', 'transition:all 0.15s',
        'z-index:2',
      ].join(';')
      btn.onmouseenter = () => { btn.style.background = 'rgba(255,255,255,0.18)'; btn.style.color = '#fff' }
      btn.onmouseleave = () => { btn.style.background = 'rgba(255,255,255,0.08)'; btn.style.color = '#aaa' }
      btn.onclick = () => {
        const code = pre.querySelector('code')?.textContent || pre.textContent
        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = 'Copied!'
          setTimeout(() => { btn.textContent = 'Copy' }, 1500)
        })
      }
      pre.style.position = 'relative'
      pre.appendChild(btn)
    })
  }, [previewHtml, viewMode])

  const inferredFilename = title !== 'Untitled Note'
    ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.md'
    : 'untitled.md'

  const selectedProject = projects.find(p => p.id === projectId)

  const handleSave = useCallback(async () => {
    if (!window.api) { setSaved(true); setTimeout(() => setSaved(false), 2000); return }
    setSaving(true)
    try {
      if (currentId) {
        const updated = await window.api.notes.update(currentId, { title, content, emoji, starred, archived, projectId, tags })
        setUpdatedAt(updated.updatedAt)
        window.dispatchEvent(new CustomEvent('croco:data-changed'))
      } else {
        const created = await window.api.notes.create({ title, content, emoji, starred, projectId, tags })
        setCurrentId(created.id)
        setCreatedAt(created.createdAt)
        setUpdatedAt(created.updatedAt)
        navigate(`/note-editor/${created.id}`, { replace: true })
        window.dispatchEvent(new CustomEvent('croco:data-changed'))
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save note:', err)
    } finally {
      setSaving(false)
    }
  }, [currentId, title, content, emoji, starred, archived, projectId, tags, navigate])

  const handleArchive = async () => {
    if (!currentId || !window.api) return
    const newVal = !archived
    setArchived(newVal)
    await window.api.notes.update(currentId, { archived: newVal }).catch(console.error)
    window.dispatchEvent(new CustomEvent('croco:data-changed'))
  }

  const insertText = useCallback((before, after = '', newLine = false) => {
    const ta = editorRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const sel   = content.slice(start, end)
    const pre   = newLine && start > 0 && content[start - 1] !== '\n' ? '\n' : ''
    const replacement = pre + before + sel + after
    const newContent  = content.slice(0, start) + replacement + content.slice(end)
    setContent(newContent)
    requestAnimationFrame(() => {
      ta.focus()
      const cursor = start + pre.length + before.length + (sel ? sel.length : 0)
      ta.selectionStart = sel ? cursor : start + pre.length + before.length
      ta.selectionEnd   = sel ? cursor : start + pre.length + before.length
    })
  }, [content])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); insertText('**', '**') }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); insertText('*', '*') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave, insertText])

  const addTag = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const tag = tagInput.trim().replace(/,/g, '')
      if (tag && !tags.includes(tag)) setTags(p => [...p, tag])
      setTagInput('')
    }
    if (e.key === 'Backspace' && !tagInput && tags.length) setTags(p => p.slice(0, -1))
  }

  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
          const ext   = item.type.split('/')[1] || 'png'
          const mdImg = `![image](data:image/${ext};base64,${ev.target.result.split(',')[1]})`
          insertText(mdImg, '', false)
        }
        reader.readAsDataURL(file)
        return
      }
    }
  }

  const fmtDate = (iso) => {
    if (!iso) return 'Just now'
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => navigate('/notes')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', padding: '4px 8px', borderRadius: 6, transition: 'all 0.12s', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--dim)' }}
        >
          <ArrowLeftIcon /> Notes
        </button>

        <span style={{ color: 'var(--dimmer)', flexShrink: 0 }}>/</span>

        {/* Emoji picker */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowEmoji(p => !p)}
            style={{ fontSize: 17, background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 6, lineHeight: 1, transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {emoji}
          </button>
          {showEmoji && (
            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'flex', flexWrap: 'wrap', gap: 4, width: 220, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              {EMOJIS.map(e => (
                <button key={e} onClick={() => { setEmoji(e); setShowEmoji(false) }}
                  style={{ fontSize: 19, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 5px', borderRadius: 6, transition: 'background 0.1s', lineHeight: 1 }}
                  onMouseEnter={e2 => e2.currentTarget.style.background = 'var(--card)'}
                  onMouseLeave={e2 => e2.currentTarget.style.background = 'none'}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Title */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'Geist, sans-serif', letterSpacing: -0.3,
            minWidth: 0,
          }}
        />

        {/* Star */}
        <button
          onClick={() => setStarred(p => !p)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: starred ? 1 : 0.35, transition: 'opacity 0.15s', flexShrink: 0 }}
        >
          <StarIcon filled={starred} />
        </button>

        {/* Archive */}
        {currentId && (
          <button
            onClick={handleArchive}
            title={archived ? 'Unarchive note' : 'Archive note'}
            style={{
              padding: '4px 10px', borderRadius: 6, border: `1px solid ${archived ? 'var(--accent)' : 'var(--border)'}`,
              background: archived ? 'rgba(74,158,255,0.10)' : 'transparent',
              color: archived ? 'var(--accent)' : 'var(--dimmer)',
              fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
            }}
          >
            {archived ? 'Archived' : 'Archive'}
          </button>
        )}

        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 8, flexShrink: 0 }}>
          {['edit', 'split', 'preview'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '4px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontSize: 11, fontFamily: 'Geist, sans-serif', textTransform: 'capitalize',
                background: viewMode === mode ? 'var(--card)'  : 'transparent',
                color:      viewMode === mode ? 'var(--text)'  : 'var(--dimmer)',
                transition: 'all 0.12s',
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Meta toggle */}
        <button
          onClick={() => setShowMeta(p => !p)}
          style={{
            padding: '5px 8px', borderRadius: 7, border: `1px solid ${showMeta ? 'var(--border-bright)' : 'var(--border)'}`,
            background: showMeta ? 'var(--card)' : 'transparent',
            color: showMeta ? 'var(--text)' : 'var(--dimmer)',
            fontSize: 13, cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
          }}
        >
          ⋮
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 7, border: 'none', cursor: saving ? 'default' : 'pointer',
            background: saved ? 'rgba(74,255,145,0.15)' : 'var(--orange)',
            color:      saved ? '#4aff91'               : '#fff',
            fontSize: 12, fontWeight: 500, fontFamily: 'Geist, sans-serif', transition: 'all 0.2s', flexShrink: 0,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save .md'}
        </button>
      </div>

      {/* ── Markdown toolbar ── */}
      {viewMode !== 'preview' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2, padding: '6px 16px',
          borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto', flexWrap: 'nowrap',
        }}>
          {TOOLBAR.map((btn, i) =>
            btn === null ? (
              <div key={`sep-${i}`} style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />
            ) : (
              <button
                key={btn.label}
                title={btn.title}
                onMouseDown={e => { e.preventDefault(); insertText(btn.before, btn.after, btn.newLine) }}
                style={{
                  padding: '4px 8px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: btn.label.length > 2 ? 10 : 12,
                  fontFamily: ['B', 'I'].includes(btn.label) ? 'Geist, sans-serif' : 'Geist Mono, monospace',
                  fontWeight: btn.label === 'B' ? 700 : 400,
                  fontStyle: btn.label === 'I' ? 'italic' : 'normal',
                  color: 'var(--dim)', background: 'transparent', transition: 'all 0.1s',
                  flexShrink: 0, minWidth: 28, textAlign: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--dim)' }}
              >
                {btn.label}
              </button>
            )
          )}
          <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {modKeyHint('B')} bold · {modKeyHint('I')} italic · {modKeyHint('S')} save
          </div>
        </div>
      )}

      {/* ── Main content area ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {viewMode !== 'preview' && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            borderRight: viewMode === 'split' ? '1px solid var(--border)' : 'none',
          }}>
            <textarea
              ref={editorRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              onPaste={handlePaste}
              spellCheck={false}
              placeholder={'# Note title\n\nStart writing in Markdown...\n\n## Section\n\nUse **bold**, *italic*, `code`, and ```code blocks```.'}
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none',
                padding: '28px 32px',
                background: 'var(--base)', color: 'var(--text)',
                fontSize: 13.5, lineHeight: 1.8,
                fontFamily: 'Geist Mono, monospace',
                overflowY: 'auto', caretColor: 'var(--orange)',
              }}
            />
          </div>
        )}

        {viewMode !== 'edit' && (
          <div style={{
            flex: 1, overflowY: 'auto', padding: '28px 40px',
            background: viewMode === 'preview' ? 'var(--base)' : 'var(--surface)',
          }}>
            <div ref={previewRef} className="md-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        )}

        {/* Metadata sidebar */}
        {showMeta && (
          <div style={{
            width: 220, flexShrink: 0, borderLeft: '1px solid var(--border)',
            overflowY: 'auto', padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 18,
          }}>
            <div>
              <MetaLabel icon={<FolderIcon />} label="Project" />
              <select
                value={projectId || ''}
                onChange={e => setProjectId(e.target.value || null)}
                style={{
                  width: '100%', background: 'var(--card)', border: '1px solid var(--border)',
                  color: projectId ? 'var(--text)' : 'var(--dimmer)', borderRadius: 7,
                  padding: '7px 10px', fontSize: 12, fontFamily: 'Geist, sans-serif',
                  cursor: 'pointer', outline: 'none', marginTop: 8,
                }}
              >
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <MetaLabel icon={<TagIcon />} label="Tags" />
              <div style={{
                marginTop: 8, background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '7px 10px', display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 38,
              }}>
                {tags.map(tag => (
                  <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'Geist Mono, monospace', fontSize: 10, background: 'var(--border)', color: 'var(--dim)', padding: '2px 6px', borderRadius: 3 }}>
                    #{tag}
                    <button onClick={() => setTags(p => p.filter(t => t !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dimmer)', fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={addTag}
                  placeholder={tags.length ? '' : 'add tag...'}
                  style={{ background: 'none', border: 'none', outline: 'none', fontSize: 11, color: 'var(--text)', fontFamily: 'Geist Mono, monospace', flex: 1, minWidth: 50 }}
                />
              </div>
              <div style={{ fontSize: 10, color: 'var(--dimmer)', marginTop: 4, fontFamily: 'Geist Mono, monospace' }}>Enter or , to add</div>
            </div>

            <div style={{ height: 1, background: 'var(--border)' }} />

            <MetaRow label="File"     value={inferredFilename} mono />
            <MetaRow label="Created"  value={fmtDate(createdAt)} />
            <MetaRow label="Modified" value={fmtDate(updatedAt)} />
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '6px 20px',
        borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: 'var(--dim)' }}>{wordCount}</span> words
        </span>
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          <span style={{ color: 'var(--dim)' }}>{charCount}</span> chars
        </span>
        <div style={{ width: 1, height: 12, background: 'var(--border)' }} />
        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          {selectedProject ? <span style={{ color: 'var(--dim)' }}>{selectedProject.name}/</span> : null}
          <span style={{ color: 'var(--orange)' }}>{inferredFilename}</span>
        </span>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace' }}>
          {viewMode === 'split' ? 'split view' : viewMode === 'preview' ? 'preview' : 'editing'}
        </div>
      </div>

    </div>
  )
}

function MetaLabel({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      <span style={{ color: 'var(--border-bright)', display: 'flex' }}>{icon}</span>
      {label}
    </div>
  )
}

function MetaRow({ label, value, mono }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--dim)', fontFamily: mono ? 'Geist Mono, monospace' : 'Geist, sans-serif', wordBreak: 'break-all' }}>{value}</div>
    </div>
  )
}
