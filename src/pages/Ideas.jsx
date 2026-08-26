import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast/useToast.js'

const DIFFICULTY_COLOR = { Beginner: '#4aff91', Intermediate: '#ffd700', Advanced: '#ff6b35' }
const DIFFICULTY_BG    = { Beginner: 'rgba(74,255,145,0.1)', Intermediate: 'rgba(255,215,0,0.1)', Advanced: 'rgba(255,107,53,0.12)' }

const CATEGORIES = ['All', 'Web App', 'API/CLI', 'Game', 'Mobile', 'Machine Learning', 'Utility', 'Business', 'DevOps', 'Education', 'Security', 'SaaS']

// Curated list of project ideas across categories and difficulties
const BUILTIN_IDEAS = [
  // Web App
  { title: 'Pomodoro Timer',    desc: 'Focus timer with sessions, breaks, and task notes. Sound alerts, stats dashboard.',                          diff: 'Beginner',     tags: ['Web App', 'Productivity'],            tech: ['React', 'CSS']               },
  { title: 'Markdown Blog',     desc: 'Static blog from local markdown files. Syntax highlighting, dark mode, RSS feed.',                           diff: 'Intermediate', tags: ['Web App', 'Content'],                 tech: ['Next.js', 'MDX']             },
  { title: 'Budget Tracker',    desc: 'Track income/expenses with charts, categories, and monthly summaries.',                                      diff: 'Intermediate', tags: ['Web App', 'Finance'],                 tech: ['React', 'Chart.js']          },
  { title: 'Recipe Manager',    desc: 'Save, tag and search recipes. Grocery list generator from selected recipes.',                                diff: 'Beginner',     tags: ['Web App', 'Lifestyle'],               tech: ['Vue', 'LocalStorage']        },
  { title: 'Habit Tracker',     desc: 'Daily habit check-ins with streaks, heatmap calendar and weekly reports.',                                   diff: 'Intermediate', tags: ['Web App', 'Productivity'],            tech: ['React', 'SQLite']            },
  { title: 'Kanban Board',      desc: 'Drag-and-drop task board with swimlanes, deadlines, and assignees.',                                        diff: 'Intermediate', tags: ['Web App', 'Productivity'],            tech: ['React', 'DnD Kit']           },
  { title: 'Link Shortener',    desc: 'Custom URL shortener with click analytics and expiry dates.',                                               diff: 'Intermediate', tags: ['Web App', 'Utility'],                 tech: ['Node.js', 'Redis']           },
  { title: 'Job Board',         desc: 'Aggregated job listings from GitHub Jobs, Hacker News, and LinkedIn scraping.',                             diff: 'Advanced',     tags: ['Web App', 'Career'],                  tech: ['Next.js', 'Prisma']          },
  { title: 'Design Token Studio', desc: 'Visual editor for design tokens (colors, spacing, typography) with CSS/JSON export.',                     diff: 'Intermediate', tags: ['Web App', 'Utility'],                 tech: ['React', 'CSS']               },
  { title: 'SQL Playground',    desc: 'In-browser SQLite sandbox: write queries, see results, share query links.',                                 diff: 'Intermediate', tags: ['Web App', 'Developer Tool'],          tech: ['React', 'sql.js']            },
  // API / CLI
  { title: 'Weather CLI',       desc: 'Terminal weather forecast with ASCII art, 7-day outlook, and city search.',                                 diff: 'Beginner',     tags: ['API/CLI', 'Utility'],                 tech: ['Node.js', 'Commander']       },
  { title: 'GitHub Stats',      desc: 'CLI that prints contribution graph, top repos, and streak data for any user.',                              diff: 'Beginner',     tags: ['API/CLI', 'Developer Tool'],          tech: ['Go', 'GitHub API']           },
  { title: 'AI Summariser',     desc: 'CLI that takes a URL or file and returns a bullet-point summary via LLM API.',                              diff: 'Intermediate', tags: ['API/CLI', 'AI'],                      tech: ['Python', 'Claude API']       },
  { title: 'File Watcher',      desc: 'Watch directories for changes and trigger webhook/script on file events.',                                  diff: 'Beginner',     tags: ['API/CLI', 'Developer Tool'],          tech: ['Node.js', 'chokidar']        },
  { title: 'REST Mock',         desc: 'Instantly spin up a mock REST API from a JSON schema. Great for front-end dev.',                            diff: 'Intermediate', tags: ['API/CLI', 'Developer Tool'],          tech: ['Node.js', 'Express']         },
  { title: 'API Tester',        desc: 'Lightweight Postman-like API client. Collections, environment variables, response diff.',                   diff: 'Intermediate', tags: ['API/CLI', 'Developer Tool'],          tech: ['Tauri', 'React']             },
  { title: 'gRPC Explorer',     desc: 'GUI for sending gRPC requests, browsing proto definitions, and viewing streaming results.',                 diff: 'Advanced',     tags: ['API/CLI', 'Developer Tool'],          tech: ['Tauri', 'Rust']              },
  // Game
  { title: 'Snake Game',        desc: 'Classic Snake with power-ups, levels, high-score board, and canvas renderer.',                             diff: 'Beginner',     tags: ['Game'],                               tech: ['JavaScript', 'Canvas']       },
  { title: 'Chess Engine',      desc: 'Playable chess with a minimax AI opponent, board analysis, and PGN export.',                               diff: 'Advanced',     tags: ['Game', 'AI'],                         tech: ['TypeScript', 'Canvas']       },
  { title: 'Tower Defense',     desc: 'Grid-based tower defense with waves, upgrades, and animated enemies.',                                     diff: 'Intermediate', tags: ['Game'],                               tech: ['Phaser.js']                  },
  { title: 'Wordle Clone',      desc: 'Recreate Wordle with daily word, share-results grid, and hard mode.',                                      diff: 'Beginner',     tags: ['Game', 'Web App'],                    tech: ['React']                      },
  { title: 'Typing Racer',      desc: 'Multiplayer typing speed game with real-time WPM counter and race animations.',                            diff: 'Advanced',     tags: ['Game', 'Web App'],                    tech: ['React', 'WebSocket']         },
  { title: 'Game Save Editor',  desc: 'Parse and edit binary/JSON save files for popular games. GUI hex viewer.',                                 diff: 'Advanced',     tags: ['Game', 'Utility'],                    tech: ['Tauri', 'Rust']              },
  { title: 'Roguelike Engine',  desc: 'Terminal-based roguelike with procedural dungeon generation, FOV, and combat.',                            diff: 'Advanced',     tags: ['Game'],                               tech: ['Rust', 'crossterm']          },
  // Machine Learning
  { title: 'Image Classifier',  desc: 'Upload an image, classify it using a pre-trained model, show confidence scores.',                          diff: 'Intermediate', tags: ['Machine Learning'],                   tech: ['Python', 'TensorFlow']       },
  { title: 'Sentiment Bot',     desc: 'Analyse tweet/post sentiment in real-time using a fine-tuned BERT model.',                                 diff: 'Intermediate', tags: ['Machine Learning', 'API/CLI'],        tech: ['Python', 'HuggingFace']      },
  { title: 'Chatbot',           desc: 'Context-aware chatbot with memory, system prompts, and streaming responses.',                              diff: 'Intermediate', tags: ['Machine Learning', 'AI'],             tech: ['Python', 'Claude API']       },
  { title: 'Code Review Bot',   desc: 'PR bot that reviews diffs with an LLM and posts inline comments via GitHub API.',                          diff: 'Advanced',     tags: ['Machine Learning', 'Developer Tool'], tech: ['Python', 'GitHub API']       },
  // Utility
  { title: 'Clipboard Manager', desc: 'System-tray clipboard history with search, pinning, and snippet templates.',                               diff: 'Intermediate', tags: ['Utility', 'Desktop'],                 tech: ['Tauri', 'React']             },
  { title: 'Screen Recorder',   desc: 'Lightweight screen/window capture with annotation and GIF export.',                                        diff: 'Intermediate', tags: ['Utility', 'Desktop'],                 tech: ['Tauri', 'Rust']              },
  { title: 'Password Manager',  desc: 'Local encrypted vault with generator, TOTP, and browser extension.',                                       diff: 'Advanced',     tags: ['Utility', 'Security'],                tech: ['Tauri', 'AES-256']           },
  { title: 'System Monitor',    desc: 'Live CPU, RAM, disk, and network stats with charts and process list.',                                     diff: 'Intermediate', tags: ['Utility', 'Desktop'],                 tech: ['Tauri', 'Rust']              },
  { title: 'Diff Viewer',       desc: 'Side-by-side file diff tool with syntax highlighting and inline comments.',                                diff: 'Intermediate', tags: ['Utility', 'Developer Tool'],          tech: ['React', 'diff library']      },
  // Mobile
  { title: 'Expense Splitter',  desc: 'Split bills among friends, track debts, send reminders via push notification.',                            diff: 'Intermediate', tags: ['Mobile'],                             tech: ['React Native']               },
  { title: 'Offline Notes',     desc: 'Markdown notes with offline-first sync, tags, and share-to-PDF export.',                                  diff: 'Beginner',     tags: ['Mobile'],                             tech: ['React Native', 'SQLite']     },
  { title: 'Fitness Tracker',   desc: 'Log workouts, track PRs, visualise volume and progression over time.',                                     diff: 'Beginner',     tags: ['Mobile', 'Web App'],                  tech: ['React Native', 'SQLite']     },
  { title: 'Plant Diary',       desc: 'Log watering, fertilising, and growth photos. Smart reminder based on plant type.',                        diff: 'Beginner',     tags: ['Mobile'],                             tech: ['React Native', 'SQLite']     },
  // Business
  { title: 'Invoice Generator', desc: 'PDF invoices with line items, taxes, branding. Client portal for payment history.',                        diff: 'Intermediate', tags: ['Business', 'Web App'],                tech: ['Next.js', 'pdf-lib']         },
  { title: 'CRM Lite',          desc: 'Contact management with pipeline stages, notes, follow-up reminders and email logs.',                      diff: 'Intermediate', tags: ['Business'],                           tech: ['React', 'SQLite']            },
  { title: 'Time Tracker',      desc: 'Track billable hours per client/project with weekly/monthly export to CSV or PDF.',                        diff: 'Beginner',     tags: ['Business', 'Utility'],                tech: ['React', 'LocalStorage']      },
  { title: 'Subscription Manager', desc: 'Track recurring SaaS subscriptions, costs, renewal dates, and total monthly spend.',                   diff: 'Beginner',     tags: ['Business', 'Finance'],                tech: ['React', 'Chart.js']          },
  { title: 'Team Wiki',         desc: 'Internal knowledge base with markdown, versioning, search and access control.',                            diff: 'Advanced',     tags: ['Business', 'Web App'],                tech: ['Next.js', 'PostgreSQL']      },
  // DevOps
  { title: 'Docker Dashboard',  desc: 'GUI for managing Docker containers: start/stop, logs, resource usage, image list.',                        diff: 'Intermediate', tags: ['DevOps', 'Utility'],                  tech: ['Tauri', 'Docker SDK']        },
  { title: 'CI Status Board',   desc: 'Aggregated build status from GitHub Actions, GitLab CI and CircleCI on one screen.',                      diff: 'Intermediate', tags: ['DevOps', 'API/CLI'],                  tech: ['React', 'GitHub API']        },
  { title: 'Log Viewer',        desc: 'Real-time log aggregator with regex search, level filtering, and auto-scroll.',                            diff: 'Intermediate', tags: ['DevOps', 'Utility'],                  tech: ['Tauri', 'Rust']              },
  { title: 'Uptime Monitor',    desc: 'Ping services on a schedule, notify on downtime, show response-time history graph.',                       diff: 'Beginner',     tags: ['DevOps', 'API/CLI'],                  tech: ['Node.js', 'SQLite']          },
  { title: 'Env Vault',         desc: 'Encrypted .env manager: store, share (encrypted), and diff environment variable sets.',                   diff: 'Intermediate', tags: ['DevOps', 'Security'],                 tech: ['Tauri', 'AES-256']           },
  // Education
  { title: 'Flashcard App',     desc: 'Spaced-repetition flashcards with decks, markdown cards, and study streak tracking.',                     diff: 'Beginner',     tags: ['Education', 'Web App'],               tech: ['React', 'LocalStorage']      },
  { title: 'Code Quiz',         desc: 'Multiple-choice coding quiz with syntax-highlighted questions, timer, and leaderboard.',                   diff: 'Intermediate', tags: ['Education', 'Web App'],               tech: ['React', 'Prism.js']          },
  { title: 'Math Visualiser',   desc: 'Plot functions, vectors, and matrices. Pan/zoom canvas with equation input.',                              diff: 'Intermediate', tags: ['Education', 'Web App'],               tech: ['React', 'D3.js']             },
  { title: 'Language Learner',  desc: 'Vocabulary builder with daily word, pronunciation audio, and progress heatmap.',                           diff: 'Intermediate', tags: ['Education', 'Mobile'],                tech: ['React Native', 'SQLite']     },
  { title: 'Typing Tutor',      desc: 'Structured typing lessons, WPM graphs, error heatmap, and custom text practice.',                         diff: 'Beginner',     tags: ['Education', 'Web App'],               tech: ['React', 'CSS']               },
  // Security
  { title: 'Port Scanner',      desc: 'Scan host port ranges, detect open services, export results to JSON/CSV.',                                diff: 'Intermediate', tags: ['Security', 'API/CLI'],                tech: ['Rust', 'Tokio']              },
  { title: 'Password Auditor',  desc: 'Check a list of passwords against haveibeenpwned API and rate them by strength.',                          diff: 'Beginner',     tags: ['Security', 'API/CLI'],                tech: ['Node.js', 'Commander']       },
  { title: 'JWT Inspector',     desc: 'Decode, validate, and forge JWTs in a browser tool — great for learning OAuth flows.',                    diff: 'Beginner',     tags: ['Security', 'Web App'],                tech: ['React', 'JavaScript']        },
  { title: 'Secrets Scanner',   desc: 'Scan git repos for accidentally committed secrets (API keys, tokens, passwords).',                        diff: 'Intermediate', tags: ['Security', 'API/CLI'],                tech: ['Rust', 'regex']              },
  { title: 'Network Sniffer',   desc: 'Capture and display local network packets with protocol parsing and filtering.',                           diff: 'Advanced',     tags: ['Security', 'API/CLI'],                tech: ['Rust', 'pcap']               },
  // SaaS / Revenue
  { title: 'Screenshot-to-Code SaaS', desc: 'Upload a UI screenshot, get clean React/HTML code back via AI. Charge per conversion or monthly.',       diff: 'Intermediate', tags: ['SaaS', 'AI'],                         tech: ['Next.js', 'Claude API']      },
  { title: 'Email Warmup Tool',   desc: 'Automated inbox warming for cold outreach. Subscription model with analytics dashboard.',                    diff: 'Advanced',     tags: ['SaaS', 'Business'],                   tech: ['Node.js', 'SMTP']            },
  { title: 'Resume AI Builder',   desc: 'AI-tailored resumes from LinkedIn/GitHub profiles. Charge per export or subscription.',                      diff: 'Intermediate', tags: ['SaaS', 'AI'],                         tech: ['Next.js', 'Claude API']      },
  { title: 'White-label Booking', desc: 'Embeddable appointment booking widget. Sell to gyms, salons, clinics. $20/mo per business.',                 diff: 'Advanced',     tags: ['SaaS', 'Business'],                   tech: ['Next.js', 'Stripe']          },
  { title: 'Changelog as a Service', desc: 'Beautiful public changelogs for SaaS products with email digest. $10/mo per team.',                       diff: 'Intermediate', tags: ['SaaS', 'Business'],                   tech: ['Next.js', 'Resend']          },
  { title: 'API Usage Analytics', desc: 'Drop-in SDK for tracking API usage, costs, and errors. $30/mo per 1M events.',                              diff: 'Advanced',     tags: ['SaaS', 'Developer Tool'],             tech: ['Go', 'ClickHouse']           },
  { title: 'Waitlist Platform',   desc: 'Viral waitlist pages with referral rewards and spot tracking. Revenue from paid tiers.',                     diff: 'Beginner',     tags: ['SaaS', 'Business'],                   tech: ['Next.js', 'Stripe']          },
  { title: 'Social Proof Widget', desc: 'Live "X people signed up today" notifications. Embed on any site. $9/mo per site.',                         diff: 'Beginner',     tags: ['SaaS', 'Business'],                   tech: ['React', 'WebSocket']         },
  { title: 'Micro-SaaS Boilerplate Marketplace', desc: 'Sell ready-to-deploy Next.js + Stripe + Auth starters for niche ideas. One-time purchase.',  diff: 'Intermediate', tags: ['SaaS', 'Business'],                   tech: ['Next.js', 'Stripe']          },
  { title: 'AI Content Calendar', desc: 'Generate a 30-day social content plan from a product description. Charge $15/mo for unlimited plans.',      diff: 'Intermediate', tags: ['SaaS', 'AI'],                         tech: ['Next.js', 'Claude API']      },
  { title: 'Link-in-Bio Builder', desc: 'Custom link-in-bio pages with analytics, themes, and custom domains. Freemium.',                            diff: 'Beginner',     tags: ['SaaS', 'Business'],                   tech: ['Next.js', 'Vercel']          },
  { title: 'Feedback Wall',       desc: 'Public feedback boards + voting for products. Revenue from private/custom domain tiers.',                    diff: 'Intermediate', tags: ['SaaS', 'Business'],                   tech: ['Next.js', 'PostgreSQL']      },
]

function IdeaCard({ idea, onUse }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--card-hover)' : 'var(--card)',
        border: `1px solid ${hovered ? 'var(--border-bright)' : 'var(--border)'}`,
        borderRadius: 12, padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'all 0.15s', cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>{idea.title}</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>{idea.desc}</div>
        </div>
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 500, fontFamily: 'Geist Mono, monospace',
          padding: '2px 7px', borderRadius: 6,
          background: DIFFICULTY_BG[idea.diff], color: DIFFICULTY_COLOR[idea.diff],
        }}>
          {idea.diff}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {idea.tech.map(t => (
          <span key={t} style={{ fontSize: 10, fontFamily: 'Geist Mono, monospace', padding: '1px 6px', borderRadius: 4, background: 'var(--border)', color: 'var(--dim)' }}>
            {t}
          </span>
        ))}
        <button
          onClick={() => onUse(idea)}
          style={{
            marginLeft: 'auto', padding: '4px 12px', borderRadius: 6,
            border: 'none', background: hovered ? 'var(--accent)' : 'var(--border)',
            color: hovered ? '#000' : 'var(--dim)',
            fontSize: 11, fontWeight: 600, fontFamily: 'Geist, sans-serif',
            cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          Use idea →
        </button>
      </div>
    </div>
  )
}

export default function Ideas() {
  const navigate = useNavigate()
  const toast    = useToast()

  const [ideas,        setIdeas]        = useState(BUILTIN_IDEAS)
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [category,     setCategory]     = useState('All')
  const [difficulty,   setDifficulty]   = useState('All')
  const [fetched,      setFetched]      = useState(false)
  const [scribble,     setScribble]     = useState(() => localStorage.getItem('croco:scribble') || '')
  const [scribbleOpen, setScribbleOpen] = useState(false)
  const [scribbleTab,  setScribbleTab]  = useState('text') // 'text' | 'draw'
  const canvasRef    = useRef(null)
  const drawingRef   = useRef(false)
  const lastPosRef   = useRef(null)
  const colorRef     = useRef('#e0e0e0')
  const sizeRef      = useRef(3)
  const historyRef   = useRef([])
  const toolRef      = useRef('pen')
  const [drawColor,  setDrawColor]  = useState('#e0e0e0')
  const [drawSize,   setDrawSize]   = useState(3)
  const [drawTool,   setDrawTool]   = useState('pen') // 'pen' | 'eraser'
  const [canUndo,    setCanUndo]    = useState(false)
  const [projects,   setProjects]   = useState([])
  const [saveModal,  setSaveModal]  = useState(false)
  const [saveProject, setSaveProject] = useState('')
  const [saving,     setSaving]     = useState(false)

  const fetchFromGitHub = useCallback(async () => {
    if (fetched) return
    setLoading(true)
    try {
      // Fetch from florinpop17/app-ideas README — parse project titles
      const resp = await fetch(
        'https://api.github.com/repos/florinpop17/app-ideas/contents/README.md',
        { headers: { Accept: 'application/vnd.github.v3+json' } }
      )
      if (!resp.ok) throw new Error('GitHub rate-limited')
      const data = await resp.json()
      const md = atob(data.content.replace(/\n/g, ''))
      // Extract lines like "- [ ] App name — Description"
      const lines = md.split('\n').filter(l => /^[-*]\s*\[/.test(l))
      const parsed = lines.slice(0, 30).map(line => {
        const m = line.match(/\[.\]\s*\[([^\]]+)\]/) || line.match(/\[.\]\s+(.+)/)
        const title = m?.[1]?.trim() || ''
        if (!title) return null
        return { title, desc: 'From the community app-ideas collection on GitHub.', diff: 'Beginner', tags: ['Web App'], tech: ['Any'] }
      }).filter(Boolean)
      if (parsed.length > 0) setIdeas(prev => [...prev, ...parsed])

      // Also fetch from codecrafters-io/build-your-own-x README
      try {
        const resp2 = await fetch(
          'https://api.github.com/repos/codecrafters-io/build-your-own-x/contents/README.md',
          { headers: { Accept: 'application/vnd.github.v3+json' } }
        )
        if (resp2.ok) {
          const data2 = await resp2.json()
          const md2 = atob(data2.content.replace(/\n/g, ''))
          const lines2 = md2.split('\n').filter(l => /^####/.test(l))
          const parsed2 = lines2.slice(0, 20).map(line => {
            // Match "#### Build your own X" or "#### {{Something}}"
            const m = line.match(/####\s+(?:Build your own\s+)?(.+)/)
            let title = m?.[1]?.trim() || ''
            // Strip markdown links e.g. [Text](url) -> Text
            title = title.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
            // Prefix with "Build your own" if not already present
            if (title && !/^build your own/i.test(title)) title = `Build your own ${title}`
            if (!title) return null
            return { title, desc: 'From the build-your-own-x collection on GitHub — learn by recreating things from scratch.', diff: 'Advanced', tags: ['API/CLI', 'Developer Tool'], tech: ['Any'] }
          }).filter(Boolean)
          if (parsed2.length > 0) setIdeas(prev => [...prev, ...parsed2])
        }
      } catch {
        // Silently ignore build-your-own-x fetch failure
      }

      setFetched(true)
    } catch {
      // Silently fall back to builtin ideas — no toast needed
    } finally {
      setLoading(false)
    }
  }, [fetched])

  useEffect(() => {
    window.api?.projects.getAll().then(p => setProjects(p || [])).catch(() => {})
  }, [])

  // Sync canvas intrinsic size to its CSS display size; preserve content on resize
  useEffect(() => {
    if (scribbleTab !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    const sync = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      if (canvas.width === w && canvas.height === h) return
      const snapshot = canvas.toDataURL()
      canvas.width  = w
      canvas.height = h
      if (snapshot !== 'data:,') {
        const img = new Image()
        img.onload = () => canvas.getContext('2d').drawImage(img, 0, 0)
        img.src = snapshot
      }
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [scribbleTab])

  const filtered = ideas.filter(idea => {
    const q = search.toLowerCase()
    const matchSearch = !q || idea.title.toLowerCase().includes(q) || idea.desc.toLowerCase().includes(q) || idea.tech.some(t => t.toLowerCase().includes(q))
    const matchCat  = category === 'All'   || idea.tags.some(t => t === category)
    const matchDiff = difficulty === 'All' || idea.diff === difficulty
    return matchSearch && matchCat && matchDiff
  })

  const getPos = (e, canvas) => {
    const rect   = canvas.getBoundingClientRect()
    const src    = e.touches ? e.touches[0] : e
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top)  * scaleY,
    }
  }

  const startDraw = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    // Save snapshot before each stroke for undo
    const snap = canvas.toDataURL()
    historyRef.current = [...historyRef.current.slice(-29), snap]
    setCanUndo(true)
    drawingRef.current = true
    lastPosRef.current = getPos(e, canvas)
  }

  const draw = (e) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const ctx  = canvas.getContext('2d')
    const pos  = getPos(e, canvas)
    const last = lastPosRef.current
    if (toolRef.current === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = colorRef.current
    }
    ctx.lineWidth   = toolRef.current === 'eraser' ? sizeRef.current * 3 : sizeRef.current
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
    lastPosRef.current = pos
  }

  const stopDraw = () => { drawingRef.current = false }

  const undoDraw = () => {
    const canvas = canvasRef.current
    if (!canvas || historyRef.current.length === 0) return
    const history = [...historyRef.current]
    const prev    = history.pop()
    historyRef.current = history
    setCanUndo(history.length > 0)
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (prev && prev !== 'data:,') {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = prev
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    historyRef.current = []
    setCanUndo(false)
  }

  const saveCanvasAsPng = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const path = await window.api?.system.showSavePicker('scribble.png', [{ name: 'PNG Image', extensions: ['png'] }])
    if (!path) return
    const base64 = dataUrl.split(',')[1]
    const bytes  = Array.from(Uint8Array.from(atob(base64), c => c.charCodeAt(0)))
    try {
      await window.api.system.writeBytes(path, bytes)
      toast.success('Saved!', path)
    } catch {
      toast.error('Could not save file', 'Check permissions.')
    }
  }

  const saveToNote = async () => {
    if (!window.api) return
    setSaving(true)
    try {
      const proj       = projects.find(p => p.id === saveProject)
      const projName   = proj?.name || null
      const noteTitle  = projName ? `Scribble: ${projName}` : 'Scribble'
      const todoTitle  = projName ? `Scribble: ${projName} → check notes for more info.` : 'Scribble → check notes for more info.'

      // Build note content
      let content = scribble.trim() ? scribble : ''
      const canvas = canvasRef.current
      if (canvas) {
        // Only embed the drawing if the canvas has been drawn on (not all transparent)
        const ctx  = canvas.getContext('2d')
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        const hasPixels = data.some((v, i) => i % 4 === 3 && v > 0)
        if (hasPixels) {
          const dataUrl = canvas.toDataURL('image/png')
          content += (content ? '\n\n' : '') + `## Drawing\n\n![Scribble Drawing](${dataUrl})`
        }
      }

      if (!content) {
        toast.warning('Nothing to save', 'Add some text or draw something first.')
        setSaving(false)
        return
      }

      const note = await window.api.notes.create({
        title:     noteTitle,
        content,
        projectId: saveProject || null,
        tags:      ['scribble'],
        starred:   false,
      })

      await window.api.todos.create({
        title:     todoTitle,
        projectId: saveProject || null,
        noteId:    note?.id || null,
        priority:  'med',
      })

      window.dispatchEvent(new CustomEvent('croco:data-changed'))
      toast.success('Saved!', `Note "${noteTitle}" and a linked todo created.`)
      setSaveModal(false)
    } catch (e) {
      toast.error('Save failed', e?.message || 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleUse = (idea) => {
    navigate('/projects/new', { state: { prefill: { name: idea.title, description: idea.desc } } })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 28px', height: 54, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>Ideas</span>
        <span style={{ color: 'var(--dimmer)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Project Inspiration</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => { setScribbleOpen(o => !o); if (!scribbleOpen) setTimeout(() => document.getElementById('scribble-anchor')?.scrollIntoView({ behavior: 'smooth' }), 50) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 7,
              border: `1px solid ${scribbleOpen ? 'var(--accent)' : 'var(--border)'}`,
              background: scribbleOpen ? 'var(--accent-dim)' : 'transparent',
              color: scribbleOpen ? 'var(--accent)' : 'var(--dim)',
              fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
            }}
          >
            ✏️ Scribble
          </button>
          <button
            onClick={fetchFromGitHub}
            disabled={loading || fetched}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 7,
              border: '1px solid var(--border)', background: 'transparent',
              color: fetched ? 'var(--dimmer)' : 'var(--dim)',
              fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: fetched || loading ? 'default' : 'pointer',
            }}
          >
            {loading ? '⟳ Fetching…' : fetched ? '✓ Community ideas loaded' : '↓ Load community ideas'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ideas…"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: 'var(--text)', fontFamily: 'Geist, sans-serif', outline: 'none', width: 200 }}
        />

        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer', background: category === c ? 'var(--card)' : 'transparent', color: category === c ? 'var(--text)' : 'var(--dimmer)', transition: 'all 0.12s' }}>
              {c}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--border)', borderRadius: 8 }}>
          {['All', 'Beginner', 'Intermediate', 'Advanced'].map(d => (
            <button key={d} onClick={() => setDifficulty(d)}
              style={{ padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer', background: difficulty === d ? 'var(--card)' : 'transparent', color: difficulty === d ? (DIFFICULTY_COLOR[d] || 'var(--text)') : 'var(--dimmer)', transition: 'all 0.12s' }}>
              {d}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 11, color: 'var(--dimmer)', fontFamily: 'Geist Mono, monospace', marginLeft: 'auto' }}>
          {filtered.length} idea{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="pm-page" style={{ padding: 28 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>💡</div>
              <div style={{ fontSize: 14, color: 'var(--dim)' }}>No ideas match your filters</div>
              <div style={{ fontSize: 12, color: 'var(--dimmer)', marginTop: 6 }}>Try a different category or search term</div>
            </div>
          ) : (
            <div className="pm-grid-3">
              {filtered.map((idea, i) => (
                <IdeaCard key={`${idea.title}-${i}`} idea={idea} onUse={handleUse} />
              ))}
            </div>
          )}
        </div>

        {/* Scribble Pad */}
        <div id="scribble-anchor" style={{ padding: '0 28px 28px' }}>
          <div
            onClick={() => setScribbleOpen(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 0', userSelect: 'none' }}
          >
            <span style={{ fontSize: 14 }}>✏️</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)' }}>Scribble Pad</span>
            <span style={{ fontSize: 10, color: 'var(--dimmer)', marginLeft: 4 }}>Notes &amp; drawings — saved locally</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--dimmer)' }}>{scribbleOpen ? '▲' : '▼'}</span>
          </div>
          {scribbleOpen && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '0 12px' }}>
                {['text', 'draw'].map(tab => (
                  <button key={tab} onClick={() => setScribbleTab(tab)}
                    style={{
                      padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11,
                      fontFamily: 'Geist, sans-serif', fontWeight: scribbleTab === tab ? 600 : 400,
                      color: scribbleTab === tab ? 'var(--accent)' : 'var(--dimmer)',
                      borderBottom: scribbleTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                      transition: 'all 0.1s',
                    }}
                  >
                    {tab === 'text' ? '📝 Text' : '🖌️ Draw'}
                  </button>
                ))}
              </div>

              {scribbleTab === 'text' && (
                <textarea
                  value={scribble}
                  onChange={e => { setScribble(e.target.value); localStorage.setItem('croco:scribble', e.target.value) }}
                  placeholder="Jot down ideas, links, notes…"
                  style={{
                    width: '100%', minHeight: 140, background: 'transparent', border: 'none',
                    padding: '12px 14px', fontSize: 12, color: 'var(--text)',
                    fontFamily: 'Geist Mono, monospace', lineHeight: 1.6, resize: 'vertical',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              )}

              {scribbleTab === 'draw' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    {/* Tool selector */}
                    <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--border)', borderRadius: 7 }}>
                      {[{ id: 'pen', icon: '✏️', label: 'Pen' }, { id: 'eraser', icon: '⬜', label: 'Eraser' }].map(t => (
                        <button key={t.id} onClick={() => { setDrawTool(t.id); toolRef.current = t.id }}
                          title={t.label}
                          style={{
                            padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11,
                            fontFamily: 'Geist, sans-serif',
                            background: drawTool === t.id ? 'var(--card)' : 'transparent',
                            color: drawTool === t.id ? 'var(--text)' : 'var(--dimmer)',
                          }}>
                          {t.icon}
                        </button>
                      ))}
                    </div>

                    {/* Color — hidden when eraser active */}
                    {drawTool === 'pen' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--dim)' }}>
                        <input type="color" value={drawColor} onChange={e => { setDrawColor(e.target.value); colorRef.current = e.target.value }}
                          style={{ width: 24, height: 20, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
                      </label>
                    )}

                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--dim)' }}>
                      {drawTool === 'eraser' ? '⬜' : '●'}
                      <input type="range" min={1} max={20} value={drawSize} onChange={e => { const v = +e.target.value; setDrawSize(v); sizeRef.current = v }}
                        style={{ width: 60 }} />
                      <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--dimmer)', minWidth: 14 }}>{drawTool === 'eraser' ? drawSize * 3 : drawSize}</span>
                    </label>

                    <button onClick={undoDraw} disabled={!canUndo}
                      title="Undo last stroke"
                      style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: canUndo ? 'var(--dim)' : 'var(--dimmer)', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: canUndo ? 'pointer' : 'default', opacity: canUndo ? 1 : 0.4 }}>
                      ↩ Undo
                    </button>
                    <button onClick={clearCanvas}
                      style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}>
                      Clear
                    </button>
                    <button onClick={saveCanvasAsPng}
                      style={{ padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 11, fontFamily: 'Geist, sans-serif', cursor: 'pointer', marginLeft: 'auto' }}>
                      Save PNG
                    </button>
                  </div>
                  <div style={{ resize: 'vertical', overflow: 'hidden', minHeight: 180, height: 320, background: '#111' }}>
                    <canvas
                      ref={canvasRef}
                      style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={stopDraw}
                      onMouseLeave={stopDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={stopDraw}
                    />
                  </div>
                </div>
              )}

              {/* Bottom action bar — always visible when scribble is open */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => { setSaveProject(projects[0]?.id || ''); setSaveModal(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 7, border: 'none',
                    background: 'var(--accent)', color: '#000',
                    fontSize: 11, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: 'pointer',
                  }}
                >
                  📎 Save as Note + Todo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save modal — rendered outside scroll area so position:fixed works correctly */}
      {saveModal && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
                onClick={e => { if (e.target === e.currentTarget) setSaveModal(false) }}
              >
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 14, padding: '24px 28px', width: 380,
                  boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Save Scribble</div>
                  <div style={{ fontSize: 11, color: 'var(--dimmer)', marginBottom: 18, lineHeight: 1.5 }}>
                    This will create a note titled <strong style={{ color: 'var(--dim)' }}>
                      Scribble{saveProject && projects.find(p => p.id === saveProject) ? `: ${projects.find(p => p.id === saveProject).name}` : ''}
                    </strong> and a linked todo.
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 6 }}>Link to project (optional)</div>
                    <select
                      value={saveProject}
                      onChange={e => setSaveProject(e.target.value)}
                      style={{
                        width: '100%', background: 'var(--card)', border: '1px solid var(--border)',
                        color: 'var(--text)', borderRadius: 7, padding: '7px 10px',
                        fontSize: 12, fontFamily: 'Geist, sans-serif', outline: 'none',
                      }}
                    >
                      <option value="">No project</option>
                      {projects.filter(p => !p.archived).map(p => (
                        <option key={p.id} value={p.id}>{p.emoji || '📁'} {p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setSaveModal(false)}
                      style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--dim)', fontSize: 12, fontFamily: 'Geist, sans-serif', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveToNote}
                      disabled={saving}
                      style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: saving ? 'var(--border)' : 'var(--accent)', color: saving ? 'var(--dimmer)' : '#000', fontSize: 12, fontWeight: 600, fontFamily: 'Geist, sans-serif', cursor: saving ? 'default' : 'pointer' }}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}
    </div>
  )
}
