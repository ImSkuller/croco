import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '../components/Toast/useToast.js'
import { useData } from '../lib/store'
import { Button, Card, EmptyState } from '../components/ui'
import { UserIcon, ClockIcon } from '../constants/SimpleSvgExports'
import { renderMarkdown } from '../lib/markdown'

// The social module's home page: Feed / Notifications / Launchpad / Profile
// in one page with local tab state, rather than four separate routes —
// keeps the module's nav footprint to the single sidebar entry every other
// module gets. See docs/social/*.md for the phase plans this implements.
//
// Data here is intentionally NOT routed through lib/store.js's useData()
// SWR cache — feed/notifications/launches are paginated, per-session,
// server-truth data, a different shape from the flat local lists
// (projects/notes/todos/...) that cache is designed around. Extending
// store.js for cursor-paginated remote data was flagged as a real,
// separate design decision in docs/social/04-feed-ranking-discovery.md
// rather than forced through unmodified here.

const TABS = ['Feed', 'Notifications', 'Launchpad', 'Profile']

export default function Social() {
  const [tab, setTab] = useState('Feed')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <UserIcon size={20} />
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, margin: 0 }}>Social</h1>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--accent-dim)', color: 'var(--accent)' }}>BETA</span>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 14px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--text)' : 'var(--dim)', cursor: 'pointer', marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Feed' && <FeedTab />}
      {tab === 'Notifications' && <NotificationsTab />}
      {tab === 'Launchpad' && <LaunchpadTab />}
      {tab === 'Profile' && <ProfileTab />}
    </div>
  )
}

// ─── Feed ────────────────────────────────────────────────────────────

function FeedTab() {
  const toast = useToast()
  const [feedType, setFeedType] = useState('following')
  const [sort, setSort] = useState(undefined) // undefined = algorithmic (server default), 'chrono' = chronological
  const [posts, setPosts] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [composerText, setComposerText] = useState('')
  const [showMdField, setShowMdField] = useState(false)
  const [mdBody, setMdBody] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [githubRepo, setGithubRepo] = useState('')
  const [visibility, setVisibility] = useState('followers')
  const [posting, setPosting] = useState(false)

  const loadFeed = useCallback(() => {
    if (!window.api?.social) return
    window.api.social.getFeed(feedType, sort)
      .then(r => { setPosts(r.posts || []); setNextCursor(r.next_cursor || null) })
      .catch(e => { toast.error('Could not load feed', e); setPosts([]); setNextCursor(null) })
  }, [feedType, sort, toast])

  useEffect(() => { loadFeed() }, [loadFeed])

  // Only the Following feed actually pages — Discover's ranked order
  // isn't stable enough across requests to cursor the same way (the
  // server flags this too, see FeedQuery::cursor's doc comment).
  const loadMore = () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    window.api.social.getFeed(feedType, sort, nextCursor)
      .then(r => { setPosts(prev => [...(prev || []), ...(r.posts || [])]); setNextCursor(r.next_cursor || null) })
      .catch(e => toast.error('Could not load more', e))
      .finally(() => setLoadingMore(false))
  }

  const submitPost = () => {
    if (!composerText.trim()) return
    setPosting(true)
    window.api.social.createPost({
      bodyText: composerText,
      mdBody: showMdField && mdBody.trim() ? mdBody : undefined,
      youtubeUrl: youtubeUrl.trim() || undefined,
      githubRepo: githubRepo.trim() || undefined,
      visibility,
    })
      .then(() => {
        setComposerText(''); setMdBody(''); setYoutubeUrl(''); setGithubRepo(''); setShowMdField(false)
        toast.success('Posted')
        loadFeed()
      })
      .catch(e => toast.error('Could not post', e))
      .finally(() => setPosting(false))
  }

  return (
    <div>
      <Card style={{ padding: 14, marginBottom: 20 }}>
        <textarea
          value={composerText}
          onChange={e => setComposerText(e.target.value)}
          placeholder="Share something with your followers..."
          rows={3}
          style={{ width: '100%', resize: 'vertical', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 10, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13 }}
        />
        {showMdField && (
          <textarea
            value={mdBody}
            onChange={e => setMdBody(e.target.value)}
            placeholder="Markdown attachment (rendered with the same sanitized pipeline as Notes)..."
            rows={4}
            style={{ width: '100%', resize: 'vertical', marginTop: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 10, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Geist Mono, monospace', fontSize: 12 }}
          />
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="YouTube link (optional)"
            style={{ flex: 1, fontSize: 12, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', color: 'var(--text)' }}
          />
          <input
            value={githubRepo} onChange={e => setGithubRepo(e.target.value)} placeholder="owner/repo (optional, public only)"
            style={{ flex: 1, fontSize: 12, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', color: 'var(--text)' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Button size="sm" variant={showMdField ? 'primary' : 'secondary'} onClick={() => setShowMdField(s => !s)}>.md</Button>
            {['public', 'followers', 'private'].map(v => (
              <Button key={v} size="sm" variant={visibility === v ? 'primary' : 'secondary'} onClick={() => setVisibility(v)}>{v}</Button>
            ))}
          </div>
          <Button variant="primary" size="sm" disabled={posting || !composerText.trim()} onClick={submitPost}>
            {posting ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button size="sm" variant={feedType === 'following' ? 'primary' : 'secondary'} onClick={() => setFeedType('following')}>Following</Button>
        <Button size="sm" variant={feedType === 'discover' ? 'primary' : 'secondary'} onClick={() => setFeedType('discover')}>Discover</Button>
        {feedType === 'discover' && (
          <Button size="sm" variant={sort === 'chrono' ? 'primary' : 'secondary'} onClick={() => setSort(sort === 'chrono' ? undefined : 'chrono')}>
            {sort === 'chrono' ? 'Chronological' : 'Ranked'}
          </Button>
        )}
      </div>

      {posts === null && <div style={{ color: 'var(--dim)', fontSize: 13 }}>Loading…</div>}
      {posts?.length === 0 && (
        <EmptyState
          icon={<UserIcon />}
          title={feedType === 'following' ? 'Nothing here yet' : 'No posts to discover yet'}
          body={feedType === 'following' ? 'Follow some people to see their posts here.' : 'Check back once more people have posted.'}
        />
      )}
      {/* Feed items are {post, repo, link} — same enriched shape
          GET /v1/posts/:id already uses — see croco-server's
          social.rs::enrich_posts. */}
      {posts?.map(item => <PostCard key={item.post.id} post={item.post} repo={item.repo} link={item.link} onChanged={loadFeed} />)}
      {feedType === 'following' && nextCursor && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <Button size="sm" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'Loading…' : 'Load more'}</Button>
        </div>
      )}
    </div>
  )
}

function PostCard({ post, repo, link, onChanged }) {
  const toast = useToast()
  const [liked, setLiked] = useState(false)
  const [showComments, setShowComments] = useState(false)
  // Sanitized through the same pipeline as Notes (lib/markdown.js) —
  // this is untrusted, OTHER users' content, unlike a note the local user
  // wrote themselves, so skipping DOMPurify here would be a real stored-
  // XSS vector, not just a theoretical one. See lib/markdown.js's comment.
  const mdHtml = useMemo(() => post.md_body ? renderMarkdown(post.md_body) : null, [post.md_body])

  const like = () => {
    const action = liked ? window.api.social.unlikePost(post.id) : window.api.social.likePost(post.id)
    action.then(() => setLiked(!liked)).catch(e => toast.error('Could not update like', e))
  }
  const feedback = (signal) => {
    window.api.social.postFeedback(post.id, signal)
      .then(() => toast.success(signal === 'not_interested' ? "Won't show more like this" : 'Thanks — showing more like this'))
      .catch(e => toast.error('Could not send feedback', e))
  }
  const report = () => {
    window.api.social.createReport('post', post.id, 'spam').then(() => toast.success('Reported')).catch(e => toast.error('Could not report', e))
  }
  const blockAuthor = () => {
    window.api.social.block(post.author_id).then(() => { toast.success('Blocked'); onChanged?.() }).catch(e => toast.error('Could not block', e))
  }
  const muteAuthor = () => {
    window.api.social.mute(post.author_id).then(() => { toast.success('Muted'); onChanged?.() }).catch(e => toast.error('Could not mute', e))
  }

  return (
    <Card style={{ padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{post.body_text}</div>
      {mdHtml && (
        <div
          className="pm-post-md-body"
          style={{ marginBottom: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: 'var(--text)' }}
          dangerouslySetInnerHTML={{ __html: mdHtml }}
        />
      )}
      {post.youtube_id && (
        <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--dim)' }}>▶ youtube.com/watch?v={post.youtube_id}</div>
      )}
      {post.github_repo && (
        <div style={{ marginBottom: 8, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
          <div style={{ fontSize: 12, fontFamily: 'Geist Mono, monospace', color: 'var(--text)' }}>{post.github_repo}</div>
          {repo?.description && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{repo.description}</div>}
          {(repo?.stars != null || repo?.primary_language) && (
            <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>
              {repo.stars != null && `★ ${repo.stars}`}{repo.primary_language && `  ·  ${repo.primary_language}`}
            </div>
          )}
        </div>
      )}
      {!post.github_repo && link && (link.title || link.description) && (
        <div style={{ marginBottom: 8, padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
          {link.title && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{link.title}</div>}
          {link.description && <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{link.description}</div>}
          {link.site_name && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>{link.site_name}</div>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
        <Button size="sm" variant={liked ? 'primary' : 'secondary'} onClick={like} aria-label={liked ? 'Unlike' : 'Like'}>♥ {post.like_count}</Button>
        <Button size="sm" onClick={() => setShowComments(s => !s)} aria-label={showComments ? 'Hide comments' : 'Show comments'}>💬 {post.comment_count}</Button>
        <Button size="sm" onClick={() => window.api.social.sharePost(post.id).catch(() => {})} aria-label="Share">↗ {post.share_count}</Button>
        <Button size="sm" onClick={() => feedback('not_interested')}>Not interested</Button>
        <Button size="sm" onClick={() => feedback('more_like_this')}>More like this</Button>
        <Button size="sm" onClick={report}>Report</Button>
        <Button size="sm" onClick={muteAuthor}>Mute author</Button>
        <Button size="sm" variant="danger" onClick={blockAuthor}>Block author</Button>
      </div>
      {showComments && <CommentThread postId={post.id} />}
    </Card>
  )
}

function CommentThread({ postId }) {
  const toast = useToast()
  const [comments, setComments] = useState(null)
  const [text, setText] = useState('')

  const load = useCallback(() => {
    window.api.social.listComments(postId).then(r => setComments(r.comments || [])).catch(() => setComments([]))
  }, [postId])
  useEffect(() => { load() }, [load])

  const submit = () => {
    if (!text.trim()) return
    window.api.social.createComment(postId, text).then(() => { setText(''); load() }).catch(e => toast.error('Could not comment', e))
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
      {comments === null && <div style={{ fontSize: 12, color: 'var(--dim)' }}>Loading comments…</div>}
      {comments?.map(c => (
        <div key={c.id} style={{ fontSize: 12, color: 'var(--text)', marginBottom: 6, marginLeft: c.parent_id ? 16 : 0 }}>
          {c.body_text}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input
          value={text} onChange={e => setText(e.target.value)} placeholder="Write a comment…"
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ flex: 1, fontSize: 12, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', color: 'var(--text)' }}
        />
        <Button size="sm" onClick={submit}>Reply</Button>
      </div>
    </div>
  )
}

// ─── Notifications ───────────────────────────────────────────────────

function NotificationsTab() {
  const toast = useToast()
  const [notifications, setNotifications] = useState(null)

  const load = useCallback(() => {
    window.api.social.listNotifications().then(r => setNotifications(r.notifications || [])).catch(e => { toast.error('Could not load notifications', e); setNotifications([]) })
  }, [toast])
  useEffect(() => { load() }, [load])

  const markAll = () => window.api.social.markAllNotificationsRead().then(load).catch(() => {})

  if (notifications === null) return <div style={{ color: 'var(--dim)', fontSize: 13 }}>Loading…</div>
  if (notifications.length === 0) return <EmptyState icon={<ClockIcon />} title="No notifications yet" body="Likes, comments, and follows will show up here." />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button size="sm" onClick={markAll}>Mark all read</Button>
      </div>
      {notifications.map(n => {
        const payload = JSON.parse(n.payload || '{}')
        return (
          <Card key={n.id} style={{ padding: 12, marginBottom: 8, opacity: n.read_at ? 0.55 : 1 }}
            onClick={() => !n.read_at && window.api.social.markNotificationRead(n.id).then(load)}>
            <div style={{ fontSize: 13 }}>
              {n.kind === 'like_batch' && `${payload.latest_liker} and ${Math.max(0, (payload.count || 1) - 1)} other(s) liked your post`}
              {n.kind === 'comment' && `${payload.author_login} commented on your post`}
              {n.kind === 'follow' && `${payload.follower_login} followed you`}
              {n.kind === 'streak_reminder' && 'Your streak is waiting for you'}
              {!['like_batch', 'comment', 'follow', 'streak_reminder'].includes(n.kind) && n.kind}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ─── Launchpad ───────────────────────────────────────────────────────

function LaunchpadTab() {
  const toast = useToast()
  const [launches, setLaunches] = useState(null)
  const [sort, setSort] = useState('trending')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ tagline: '', category: '', githubRepo: '' })

  const load = useCallback(() => {
    window.api.social.listLaunches(sort).then(r => setLaunches(r.launches || [])).catch(e => { toast.error('Could not load launches', e); setLaunches([]) })
  }, [sort, toast])
  useEffect(() => { load() }, [load])

  const submit = () => {
    if (!form.tagline.trim() || !form.category.trim()) return
    window.api.social.createLaunch({ tagline: form.tagline, category: form.category, githubRepo: form.githubRepo || undefined })
      .then(() => { setForm({ tagline: '', category: '', githubRepo: '' }); setShowForm(false); toast.success('Launched!'); load() })
      .catch(e => toast.error('Could not launch', e))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" variant={sort === 'trending' ? 'primary' : 'secondary'} onClick={() => setSort('trending')}>Trending</Button>
          <Button size="sm" variant={sort === 'newest' ? 'primary' : 'secondary'} onClick={() => setSort('newest')}>Newest</Button>
        </div>
        <Button size="sm" variant="primary" onClick={() => setShowForm(s => !s)}>+ Launch a project</Button>
      </div>

      {showForm && (
        <Card style={{ padding: 14, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input placeholder="Tagline" value={form.tagline} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
          <input placeholder="Category (e.g. dev-tools)" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
          <input placeholder="GitHub repo (owner/repo, optional)" value={form.githubRepo} onChange={e => setForm(f => ({ ...f, githubRepo: e.target.value }))}
            style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" size="sm" onClick={submit}>Launch</Button>
          </div>
        </Card>
      )}

      {launches === null && <div style={{ color: 'var(--dim)', fontSize: 13 }}>Loading…</div>}
      {launches?.length === 0 && <EmptyState icon={<UserIcon />} title="No launches yet" body="Be the first to launch a project." />}
      {launches?.map(l => (
        <Card key={l.id} style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{l.tagline}</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 8 }}>{l.category}{l.github_repo ? ` · ${l.github_repo}` : ''}</div>
          <Button size="sm" aria-label="Upvote" onClick={() => window.api.social.upvoteLaunch(l.id).then(load).catch(e => toast.error('Could not upvote', e))}>▲ {l.upvote_count}</Button>
        </Card>
      ))}
    </div>
  )
}

// ─── Profile ─────────────────────────────────────────────────────────

const VISIBILITY_OPTIONS = ['public', 'followers', 'private']

function ProfileTab() {
  const toast = useToast()
  const settings = useData('settings')
  const includeGithubActivity = !!settings?.modules?.social?.streak?.includeGithubActivity
  const [me, setMe] = useState(null)
  const [streak, setStreak] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [bioVisibility, setBioVisibility] = useState('followers')

  useEffect(() => {
    window.api.social.getMe().then(m => { setMe(m); setDisplayName(m.displayName || '') }).catch(e => toast.error('Could not load profile', e))
    window.api.social.getStreak().then(setStreak).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Opt-in only (Settings → Modules → Social) — a one-shot check per
  // page visit, not a poll; croco-server never stores the GitHub token
  // this sends, only uses it for this one call. See
  // social_layer_v1_plan.md §10 and src-tauri/src/social.rs.
  useEffect(() => {
    if (!includeGithubActivity) return
    window.api.social.checkGithubStreak()
      .then(r => { if (r.counted) window.api.social.getStreak().then(setStreak).catch(() => {}) })
      .catch(() => {})
  }, [includeGithubActivity])

  const save = () => {
    window.api.social.updateMe(displayName || undefined, bio || undefined)
      .then(() => toast.success('Profile saved'))
      .catch(e => toast.error('Could not save profile', e))
  }
  const saveBioVisibility = (v) => {
    setBioVisibility(v)
    window.api.social.setFieldVisibility('bio', v).catch(e => toast.error('Could not update visibility', e))
  }

  if (!me) return <div style={{ color: 'var(--dim)', fontSize: 13 }}>Loading…</div>

  return (
    <div>
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
          <Stat label="Followers" value={me.followers ?? 0} />
          <Stat label="Following" value={me.following ?? 0} />
          <Stat label="Streak" value={streak ? `${streak.current_length}🔥` : '—'} />
          <Stat label="Freeze tokens" value={streak?.freeze_tokens ?? '—'} />
        </div>

        <label style={{ fontSize: 12, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>Display name</label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, marginBottom: 12 }} />

        <label style={{ fontSize: 12, color: 'var(--dim)', display: 'block', marginBottom: 4 }}>Bio</label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, marginBottom: 8, fontFamily: 'inherit' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>Who can see your bio:</span>
          {VISIBILITY_OPTIONS.map(v => (
            <Button key={v} size="sm" variant={bioVisibility === v ? 'primary' : 'secondary'} onClick={() => saveBioVisibility(v)}>{v}</Button>
          ))}
        </div>

        <Button variant="primary" size="sm" onClick={save}>Save profile</Button>
      </Card>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--dim)' }}>{label}</div>
    </div>
  )
}
