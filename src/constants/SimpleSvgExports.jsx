const Icon = ({ size = 16, children }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

const PlusIcon        = ({ color = 'currentColor' }) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"><path d="M8 1v14M1 8h14"/></svg>
const MoreIcon        = () => <Icon><circle cx="8" cy="3" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="13" r="1" fill="currentColor" stroke="none"/></Icon>
const IDEIcon         = () => <Icon><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 7l2 2-2 2M9 11h2"/></Icon>
const CommitIcon      = () => <Icon><circle cx="8" cy="8" r="2.5"/><path d="M1 8h4.5M10.5 8H15"/></Icon>
const PlayIcon        = () => <Icon><polygon points="5,3 13,8 5,13" fill="currentColor" stroke="none"/></Icon>
const StopIcon        = () => <Icon><rect x="4" y="4" width="8" height="8" rx="1"/></Icon>
const CheckIcon       = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round"><path d="M2 5l2.5 2.5L8 3"/></svg>
const ClockIcon       = () => <Icon><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></Icon>
const SearchIcon      = () => <Icon><circle cx="6.5" cy="6.5" r="5"/><path d="m10.5 10.5 3.5 3.5"/></Icon>
const GridIcon        = () => <Icon><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></Icon>
const ListViewIcon    = () => <Icon><path d="M2 4h12M2 8h12M2 12h12"/></Icon>
const FolderIcon      = () => <Icon><path d="M1 4h5l2 2h7v8H1z"/></Icon>
const FolderOpenIcon  = () => <Icon><path d="M1 11V5h5l2-2h7v8H1z"/><path d="M1 11l2-4h12l-2 4"/></Icon>
const SortIcon        = () => <Icon><path d="M2 4h12M4 8h8M6 12h4"/></Icon>
const TrashIcon       = () => <Icon><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/></Icon>
const GithubIcon      = () => <Icon><path d="M8 1a7 7 0 0 0-2.21 13.64c.35.06.48-.15.48-.34v-1.2c-1.94.42-2.35-.94-2.35-.94-.32-.81-.78-1.02-.78-1.02-.63-.43.05-.42.05-.42.7.05 1.07.72 1.07.72.62 1.06 1.63.75 2.03.58.06-.45.24-.75.44-.92-1.55-.18-3.18-.78-3.18-3.46 0-.76.27-1.39.72-1.88-.07-.18-.31-.89.07-1.85 0 0 .59-.19 1.92.72A6.67 6.67 0 0 1 8 5.8c.59 0 1.19.08 1.75.23 1.33-.9 1.92-.72 1.92-.72.38.96.14 1.67.07 1.85.45.49.71 1.12.71 1.88 0 2.69-1.63 3.28-3.19 3.46.25.22.48.65.48 1.31v1.94c0 .19.13.4.49.34A7 7 0 0 0 8 1z"/></Icon>
const EditIcon        = () => <Icon><path d="M11 2l3 3-8 8H3v-3z"/></Icon>
const UserIcon        = () => <Icon><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></Icon>
const GitIcon         = () => <Icon><path d="M8 1a7 7 0 0 0-2.21 13.64c.35.06.48-.15.48-.34v-1.2c-1.94.42-2.35-.94-2.35-.94-.32-.81-.78-1.02-.78-1.02-.63-.43.05-.42.05-.42.7.05 1.07.72 1.07.72.62 1.06 1.63.75 2.03.58.06-.45.24-.75.44-.92-1.55-.18-3.18-.78-3.18-3.46 0-.76.27-1.39.72-1.88-.07-.18-.31-.89.07-1.85 0 0 .59-.19 1.92.72A6.67 6.67 0 0 1 8 5.8c.59 0 1.19.08 1.75.23 1.33-.9 1.92-.72 1.92-.72.38.96.14 1.67.07 1.85.45.49.71 1.12.71 1.88 0 2.69-1.63 3.28-3.19 3.46.25.22.48.65.48 1.31v1.94c0 .19.13.4.49.34A7 7 0 0 0 8 1z"/></Icon>
const APIIcon         = () => <Icon><path d="M3 8h10M8 3v10"/><rect x="1" y="1" width="14" height="14" rx="2"/></Icon>
const PaletteIcon     = () => <Icon><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2"/></Icon>
const ShieldIcon      = () => <Icon><path d="M8 1l6 3v5c0 3-2.5 5.5-6 7-3.5-1.5-6-4-6-7V4z"/></Icon>
const EyeIcon         = () => <Icon><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></Icon>
const EyeOffIcon      = () => <Icon><path d="M14 4L2 12M1 8s2.5-5 7-5M15 8s-2.5 5-7 5M6.5 6.5L9.5 9.5"/></Icon>
const SaveIcon        = () => <Icon><path d="M13 1H3L1 3v10l2 2h10l2-2V3z"/><path d="M5 1v4h6V1M5 10h6"/></Icon>
const DragIcon        = () => <Icon><path d="M4 6h8M4 10h8"/></Icon>
const TrendIcon       = () => <Icon><path d="M1 12L5 7l3 3 4-5 3 3"/></Icon>
const NoteIcon2       = () => <Icon><rect x="2" y="1" width="12" height="14" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4"/></Icon>
const ArrowLeftIcon   = () => <Icon><path d="M10 3L4 8l6 5"/></Icon>
const TagIcon         = () => <Icon><path d="M1 1h7l7 7-7 7-7-7z"/><circle cx="4.5" cy="4.5" r="1"/></Icon>
const LinkIcon        = () => <Icon><path d="M7 9a3 3 0 0 0 4.243.243l2-2a3 3 0 0 0-4.243-4.243L7.5 5.5"/><path d="M9 7a3 3 0 0 0-4.243-.243l-2 2a3 3 0 0 0 4.243 4.243L8.5 10.5"/></Icon>
const CheckCircleIcon = () => <Icon><circle cx="8" cy="8" r="7"/><path d="M5 8l2.5 2.5L11 6"/></Icon>
const StarIcon        = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 16 16"
    fill={filled ? '#ffd700' : 'none'}
    stroke={filled ? '#ffd700' : 'currentColor'}
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="8,1 10,6 15,6 11,9.5 12.5,14.5 8,11.5 3.5,14.5 5,9.5 1,6 6,6"/>
  </svg>
)

// Per-IDE logo icons (16×16, filled, coloured)
const IdeVSCodeIcon    = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M11.5 1L6 7 2.5 4 1 5.5l3 2.5-3 2.5L2.5 12 6 9l5.5 6 1.5-.75V1.75L11.5 1z" fill="#007ACC"/></svg>
const IdeCursorIcon    = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L1 6v8h14V6L8 1z" fill="#1B1B1B"/><path d="M5 9h6M5 12h4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/><circle cx="8" cy="6" r="1.5" fill="#00BFFF"/></svg>
const IdeWindsurfIcon  = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 11c2-4 4-7 8-9" stroke="#4DBBF0" strokeWidth="2" strokeLinecap="round"/><path d="M2 11c3-2 6-2 10 0" stroke="#4DBBF0" strokeWidth="1.5" strokeLinecap="round"/><path d="M4 14c2-1 5-1 8 0" stroke="#4DBBF0" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/></svg>
const IdeTraeIcon      = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="3" fill="#1A73E8"/><path d="M4 4h8M8 4v8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
const IdeZedIcon       = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="3" fill="#084CCF"/><path d="M4 5h8L4 11h8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IdeFleetIcon     = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="3" fill="#23C4A0"/><circle cx="8" cy="8" r="4" stroke="#fff" strokeWidth="1.5"/><circle cx="8" cy="8" r="1.5" fill="#fff"/></svg>
const IdeWebStormIcon  = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="3" fill="#07C3F2"/><rect x="3" y="11" width="5" height="2" rx=".5" fill="#000"/><path d="M3 4l2.5 5L8 5l2.5 4L13 4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IdeIDEAIcon      = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="3" fill="#FE315D"/><rect x="3" y="11" width="5" height="2" rx=".5" fill="#000"/><path d="M5 4h6M8 4v5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/></svg>
const IdeSublimeIcon   = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect width="16" height="16" rx="3" fill="#FF6733"/><path d="M4 5l8-1-6 3 6 1-8 3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IdeNeovimIcon    = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13V3l4 5 4-5v10" stroke="#57A143" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 8h4" stroke="#57A143" strokeWidth="1.8" strokeLinecap="round"/></svg>
const IdeVimIcon       = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4l3 9 3-9M8 4l3 9 3-9" stroke="#019833" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>

const IDE_ICON_MAP = {
  vscode:   IdeVSCodeIcon,
  cursor:   IdeCursorIcon,
  windsurf: IdeWindsurfIcon,
  trae:     IdeTraeIcon,
  zed:      IdeZedIcon,
  fleet:    IdeFleetIcon,
  webstorm: IdeWebStormIcon,
  idea:     IdeIDEAIcon,
  sublime:  IdeSublimeIcon,
  neovim:   IdeNeovimIcon,
  vim:      IdeVimIcon,
}

const IdeLogoIcon = ({ ide }) => {
  const C = IDE_ICON_MAP[ide] || IdeVSCodeIcon
  return <C />
}

const DownloadIcon      = () => <Icon><path d="M8 1v9M4 7l4 4 4-4M1 14h14"/></Icon>
const AlertTriangleIcon = () => <Icon><path d="M8 2L1 14h14L8 2z"/><path d="M8 7v3"/><circle cx="8" cy="12.5" r="0.5" fill="currentColor" stroke="none"/></Icon>
const BranchIcon        = () => <Icon><circle cx="5" cy="4" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="11" cy="4" r="2"/><path d="M5 6v4M7 4c1.5 0 4 1 4 4v2"/></Icon>
const RefreshIcon       = () => <Icon><path d="M2 8a6 6 0 1 1 1.5 4M1 5v3h3"/></Icon>
const ExternalLinkIcon  = () => <Icon><path d="M6 2H2L1 3v11l1 1h11l1-1V9"/><path d="M10 1h5v5M7 9L15 1"/></Icon>
const XCircleIcon       = () => <Icon><circle cx="8" cy="8" r="7"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5"/></Icon>
const TerminalIcon      = () => <Icon><rect x="1" y="2" width="14" height="12" rx="1.5"/><path d="M4 6l3 3-3 3M9 12h3"/></Icon>
const ActivityIcon      = () => <Icon><path d="M1 8h3l2-5 2 10 2-7 2 4h3"/></Icon>
const CopyIcon          = () => <Icon><rect x="5" y="1" width="9" height="11" rx="1"/><rect x="1" y="4" width="9" height="11" rx="1"/></Icon>
const AIIcon            = () => <Icon><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/><circle cx="8" cy="8" r="2.5"/></Icon>
const KeyboardIcon      = () => <Icon><rect x="1" y="4" width="14" height="8" rx="1.5"/><path d="M4 7h1M7 7h1M10 7h1M4 10h8M13 7h0"/></Icon>
const DatabaseIcon      = () => <Icon><ellipse cx="8" cy="4" rx="6" ry="2"/><path d="M2 4v4c0 1.1 2.7 2 6 2s6-.9 6-2V4"/><path d="M2 8v4c0 1.1 2.7 2 6 2s6-.9 6-2V8"/></Icon>
const GitInitIcon       = () => <Icon><circle cx="4" cy="4" r="2"/><circle cx="4" cy="12" r="2"/><circle cx="12" cy="4" r="2"/><path d="M4 6v4"/><path d="M6 4h4"/></Icon>
const UploadCloudIcon   = () => <Icon><path d="M12 13H4a3 3 0 0 1 0-6h.1A5 5 0 0 1 13 5c1.1 0 2 .9 2 2M9 10v5M7 12l2-2 2 2"/></Icon>
const VaultIcon         = () => <Icon><path d="M8 1l6 3v3c0 4-2.5 6.5-6 8-3.5-1.5-6-4-6-8V4z"/><path d="M8 6v5M5.5 8.5L8 6l2.5 2.5"/></Icon>

export {
  PlusIcon, MoreIcon, IDEIcon, IdeLogoIcon, CommitIcon, PlayIcon, StopIcon, CheckIcon, ClockIcon,
  SearchIcon, GridIcon, ListViewIcon, FolderIcon, FolderOpenIcon,
  SortIcon, TrashIcon, GithubIcon, EditIcon,
  UserIcon, GitIcon, APIIcon, PaletteIcon, ShieldIcon, EyeIcon, EyeOffIcon, SaveIcon,
  DragIcon, TrendIcon, NoteIcon2, ArrowLeftIcon, TagIcon, LinkIcon, CheckCircleIcon, StarIcon,
  DownloadIcon, AlertTriangleIcon, BranchIcon, RefreshIcon, ExternalLinkIcon, XCircleIcon,
  TerminalIcon, ActivityIcon, CopyIcon, AIIcon, KeyboardIcon, DatabaseIcon, GitInitIcon, UploadCloudIcon,
  VaultIcon,
}
