const Icon = ({ size = 16, children }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

const PlusIcon        = ({ color = 'currentColor' }) => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round"><path d="M8 1v14M1 8h14"/></svg>
const MoreIcon        = ({ size }) => <Icon size={size}><circle cx="8" cy="3" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="13" r="1" fill="currentColor" stroke="none"/></Icon>
const IDEIcon         = ({ size }) => <Icon size={size}><rect x="1" y="3" width="14" height="10" rx="1.5"/><path d="M5 7l2 2-2 2M9 11h2"/></Icon>
const CommitIcon      = ({ size }) => <Icon size={size}><circle cx="8" cy="8" r="2.5"/><path d="M1 8h4.5M10.5 8H15"/></Icon>
const PlayIcon        = ({ size }) => <Icon size={size}><polygon points="5,3 13,8 5,13" fill="currentColor" stroke="none"/></Icon>
const StopIcon        = ({ size }) => <Icon size={size}><rect x="4" y="4" width="8" height="8" rx="1"/></Icon>
const CheckIcon       = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#000" strokeWidth="1.8" strokeLinecap="round"><path d="M2 5l2.5 2.5L8 3"/></svg>
const ClockIcon       = ({ size }) => <Icon size={size}><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></Icon>
const SearchIcon      = ({ size }) => <Icon size={size}><circle cx="6.5" cy="6.5" r="5"/><path d="m10.5 10.5 3.5 3.5"/></Icon>
const GridIcon        = ({ size }) => <Icon size={size}><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></Icon>
const ListViewIcon    = ({ size }) => <Icon size={size}><path d="M2 4h12M2 8h12M2 12h12"/></Icon>
const FolderIcon      = ({ size }) => <Icon size={size}><path d="M1 4h5l2 2h7v8H1z"/></Icon>
const FolderOpenIcon  = ({ size }) => <Icon size={size}><path d="M1 11V5h5l2-2h7v8H1z"/><path d="M1 11l2-4h12l-2 4"/></Icon>
const SortIcon        = ({ size }) => <Icon size={size}><path d="M2 4h12M4 8h8M6 12h4"/></Icon>
const TrashIcon       = ({ size }) => <Icon size={size}><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/></Icon>
const GithubIcon      = ({ size }) => <Icon size={size}><path d="M8 1a7 7 0 0 0-2.21 13.64c.35.06.48-.15.48-.34v-1.2c-1.94.42-2.35-.94-2.35-.94-.32-.81-.78-1.02-.78-1.02-.63-.43.05-.42.05-.42.7.05 1.07.72 1.07.72.62 1.06 1.63.75 2.03.58.06-.45.24-.75.44-.92-1.55-.18-3.18-.78-3.18-3.46 0-.76.27-1.39.72-1.88-.07-.18-.31-.89.07-1.85 0 0 .59-.19 1.92.72A6.67 6.67 0 0 1 8 5.8c.59 0 1.19.08 1.75.23 1.33-.9 1.92-.72 1.92-.72.38.96.14 1.67.07 1.85.45.49.71 1.12.71 1.88 0 2.69-1.63 3.28-3.19 3.46.25.22.48.65.48 1.31v1.94c0 .19.13.4.49.34A7 7 0 0 0 8 1z"/></Icon>
const EditIcon        = ({ size }) => <Icon size={size}><path d="M11 2l3 3-8 8H3v-3z"/></Icon>
const UserIcon        = ({ size }) => <Icon size={size}><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></Icon>
const GitIcon         = ({ size }) => <Icon size={size}><path d="M8 1a7 7 0 0 0-2.21 13.64c.35.06.48-.15.48-.34v-1.2c-1.94.42-2.35-.94-2.35-.94-.32-.81-.78-1.02-.78-1.02-.63-.43.05-.42.05-.42.7.05 1.07.72 1.07.72.62 1.06 1.63.75 2.03.58.06-.45.24-.75.44-.92-1.55-.18-3.18-.78-3.18-3.46 0-.76.27-1.39.72-1.88-.07-.18-.31-.89.07-1.85 0 0 .59-.19 1.92.72A6.67 6.67 0 0 1 8 5.8c.59 0 1.19.08 1.75.23 1.33-.9 1.92-.72 1.92-.72.38.96.14 1.67.07 1.85.45.49.71 1.12.71 1.88 0 2.69-1.63 3.28-3.19 3.46.25.22.48.65.48 1.31v1.94c0 .19.13.4.49.34A7 7 0 0 0 8 1z"/></Icon>
const APIIcon         = ({ size }) => <Icon size={size}><path d="M3 8h10M8 3v10"/><rect x="1" y="1" width="14" height="14" rx="2"/></Icon>
const PaletteIcon     = ({ size }) => <Icon size={size}><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2"/></Icon>
const ShieldIcon      = ({ size }) => <Icon size={size}><path d="M8 1l6 3v5c0 3-2.5 5.5-6 7-3.5-1.5-6-4-6-7V4z"/></Icon>
const LockIcon        = ({ size }) => <Icon size={size}><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7"/></Icon>
const InfoIcon         = ({ size }) => <Icon size={size}><circle cx="8" cy="8" r="6.5"/><path d="M8 7.2v4M8 5v.01"/></Icon>
const FlameIcon        = ({ size }) => <Icon size={size}><path d="M8 1.5c1 2 3.5 3 3.5 6.5a3.5 3.5 0 0 1-7 0c0-1 .5-1.8 1-2.3-.1 1 .4 1.8 1 1.8 1 0 .5-2 1.5-3.2 0 1 .5 1.5 1 2-.3-1.6-1-2.8-1-4.8z"/></Icon>
const EyeIcon         = ({ size }) => <Icon size={size}><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></Icon>
const EyeOffIcon      = ({ size }) => <Icon size={size}><path d="M14 4L2 12M1 8s2.5-5 7-5M15 8s-2.5 5-7 5M6.5 6.5L9.5 9.5"/></Icon>
const SaveIcon        = ({ size }) => <Icon size={size}><path d="M13 1H3L1 3v10l2 2h10l2-2V3z"/><path d="M5 1v4h6V1M5 10h6"/></Icon>
const DragIcon        = ({ size }) => <Icon size={size}><path d="M4 6h8M4 10h8"/></Icon>
const TrendIcon       = ({ size }) => <Icon size={size}><path d="M1 12L5 7l3 3 4-5 3 3"/></Icon>
const NoteIcon2       = ({ size }) => <Icon size={size}><rect x="2" y="1" width="12" height="14" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4"/></Icon>
const ArrowLeftIcon   = ({ size }) => <Icon size={size}><path d="M10 3L4 8l6 5"/></Icon>
const TagIcon         = ({ size }) => <Icon size={size}><path d="M1 1h7l7 7-7 7-7-7z"/><circle cx="4.5" cy="4.5" r="1"/></Icon>
const LinkIcon        = ({ size }) => <Icon size={size}><path d="M7 9a3 3 0 0 0 4.243.243l2-2a3 3 0 0 0-4.243-4.243L7.5 5.5"/><path d="M9 7a3 3 0 0 0-4.243-.243l-2 2a3 3 0 0 0 4.243 4.243L8.5 10.5"/></Icon>
const CheckCircleIcon = ({ size }) => <Icon size={size}><circle cx="8" cy="8" r="7"/><path d="M5 8l2.5 2.5L11 6"/></Icon>
const StarIcon        = ({ filled, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16"
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

const DownloadIcon      = ({ size }) => <Icon size={size}><path d="M8 1v9M4 7l4 4 4-4M1 14h14"/></Icon>
const AlertTriangleIcon = ({ size }) => <Icon size={size}><path d="M8 2L1 14h14L8 2z"/><path d="M8 7v3"/><circle cx="8" cy="12.5" r="0.5" fill="currentColor" stroke="none"/></Icon>
const BranchIcon        = ({ size }) => <Icon size={size}><circle cx="5" cy="4" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="11" cy="4" r="2"/><path d="M5 6v4M7 4c1.5 0 4 1 4 4v2"/></Icon>
const RefreshIcon       = ({ size }) => <Icon size={size}><path d="M2 8a6 6 0 1 1 1.5 4M1 5v3h3"/></Icon>
const ExternalLinkIcon  = ({ size }) => <Icon size={size}><path d="M6 2H2L1 3v11l1 1h11l1-1V9"/><path d="M10 1h5v5M7 9L15 1"/></Icon>
const XCircleIcon       = ({ size }) => <Icon size={size}><circle cx="8" cy="8" r="7"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5"/></Icon>
const TerminalIcon      = ({ size }) => <Icon size={size}><rect x="1" y="2" width="14" height="12" rx="1.5"/><path d="M4 6l3 3-3 3M9 12h3"/></Icon>
const ActivityIcon      = ({ size }) => <Icon size={size}><path d="M1 8h3l2-5 2 10 2-7 2 4h3"/></Icon>
const CopyIcon          = ({ size }) => <Icon size={size}><rect x="5" y="1" width="9" height="11" rx="1"/><rect x="1" y="4" width="9" height="11" rx="1"/></Icon>
const AIIcon            = ({ size }) => <Icon size={size}><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/><circle cx="8" cy="8" r="2.5"/></Icon>
const KeyboardIcon      = ({ size }) => <Icon size={size}><rect x="1" y="4" width="14" height="8" rx="1.5"/><path d="M4 7h1M7 7h1M10 7h1M4 10h8M13 7h0"/></Icon>
const DatabaseIcon      = ({ size }) => <Icon size={size}><ellipse cx="8" cy="4" rx="6" ry="2"/><path d="M2 4v4c0 1.1 2.7 2 6 2s6-.9 6-2V4"/><path d="M2 8v4c0 1.1 2.7 2 6 2s6-.9 6-2V8"/></Icon>
const GitInitIcon       = ({ size }) => <Icon size={size}><circle cx="4" cy="4" r="2"/><circle cx="4" cy="12" r="2"/><circle cx="12" cy="4" r="2"/><path d="M4 6v4"/><path d="M6 4h4"/></Icon>
const UploadCloudIcon   = ({ size }) => <Icon size={size}><path d="M12 13H4a3 3 0 0 1 0-6h.1A5 5 0 0 1 13 5c1.1 0 2 .9 2 2M9 10v5M7 12l2-2 2 2"/></Icon>
const VaultIcon         = ({ size }) => <Icon size={size}><path d="M8 1l6 3v3c0 4-2.5 6.5-6 8-3.5-1.5-6-4-6-8V4z"/><path d="M8 6v5M5.5 8.5L8 6l2.5 2.5"/></Icon>
const HomeIcon          = ({ size }) => <Icon size={size}><path d="M2 8l6-5 6 5"/><path d="M3 7v7h10V7"/><path d="M6.5 14v-4h3v4"/></Icon>
const BulbIcon          = ({ size }) => <Icon size={size}><path d="M5 11.5a4.5 4.5 0 1 1 6 0c-.6.6-1 1.4-1 2.5H6c0-1.1-.4-1.9-1-2.5z"/><path d="M6.3 14h3.4M7 15.5h2"/></Icon>
const ImportIcon        = ({ size }) => <Icon size={size}><path d="M1 4h5l2 2h7v8H1z"/><path d="M8 7v4M6 9l2 2 2-2"/></Icon>
const PlusCircleIcon    = ({ size }) => <Icon size={size}><circle cx="8" cy="8" r="7"/><path d="M8 5v6M5 8h6"/></Icon>
const GameIcon          = ({ size }) => <Icon size={size}><rect x="1" y="5" width="14" height="7" rx="3.5"/><path d="M4.5 8.5h-2M3.5 7.5v2"/><circle cx="11" cy="7.5" r=".6" fill="currentColor" stroke="none"/><circle cx="12.5" cy="9" r=".6" fill="currentColor" stroke="none"/></Icon>
const GiftIcon          = ({ size }) => <Icon size={size}><rect x="2" y="6" width="12" height="8" rx="1"/><path d="M2 9h12M8 6v8"/><path d="M8 6c-2-3-5-2-5 0M8 6c2-3 5-2 5 0"/></Icon>
const MusicNoteIcon     = ({ size }) => <Icon size={size}><circle cx="4.5" cy="12.5" r="2"/><circle cx="11" cy="11" r="2"/><path d="M6.5 12.5V3l6.5-1.5V9"/></Icon>
const PuzzleIcon        = ({ size }) => <Icon size={size}><path d="M2 6V3a1 1 0 0 1 1-1h3a1.3 1.3 0 1 1 0 2.4V6h2.6A1.3 1.3 0 1 1 11 6h3v3a1.3 1.3 0 1 0-2.4 0V11H14v3a1 1 0 0 1-1 1h-3a1.3 1.3 0 1 1 0-2.4V11H7.4a1.3 1.3 0 1 1 0-2.4V6H5a1.3 1.3 0 1 0-2.6 0H2z"/></Icon>
const CrocoIcon         = ({ size }) => <Icon size={size}><path d="M1 10c1-3 4-5 8-5 3 0 5.5 1.5 6 3l-2 .5-1-1.5-1.5 1h-3L6 10l-1.5-1L3 10.5z"/><circle cx="12.5" cy="6.5" r=".6" fill="currentColor" stroke="none"/><path d="M3 10.5l-1 2M6 9.5l-.5 2M9.5 8.5l0 2"/></Icon>
const CalendarIcon      = ({ size }) => <Icon size={size}><rect x="1.5" y="3" width="13" height="11.5" rx="1.5"/><path d="M1.5 6.5h13M5 1.5v3M11 1.5v3"/></Icon>
const PinIcon           = ({ size }) => <Icon size={size}><path d="M8 1a4 4 0 0 1 4 4c0 3-4 8-4 8s-4-5-4-8a4 4 0 0 1 4-4z"/><circle cx="8" cy="5" r="1.4"/></Icon>
const PackageIcon       = ({ size }) => <Icon size={size}><path d="M8 1.5 14 5v6l-6 3.5L2 11V5z"/><path d="M2 5l6 3.5L14 5M8 8.5V15"/></Icon>
const FileIcon          = ({ size }) => <Icon size={size}><path d="M4 1.5h5.5L13 5v9.5H4z"/><path d="M9.5 1.5V5H13"/></Icon>
const BellIcon          = ({ size }) => <Icon size={size}><path d="M8 1.5a1 1 0 0 1 1 1v.6a4.5 4.5 0 0 1 3.5 4.4v2l1.3 2.1H2.2L3.5 9.5v-2A4.5 4.5 0 0 1 7 3.1v-.6a1 1 0 0 1 1-1z"/><path d="M6.2 13.5a1.8 1.8 0 0 0 3.6 0"/></Icon>
const WindowIcon        = ({ size }) => <Icon size={size}><rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M1.5 5.5h13"/><circle cx="3.5" cy="4" r=".4" fill="currentColor" stroke="none"/></Icon>
const EraserIcon        = ({ size }) => <Icon size={size}><path d="M10.5 1.5 14.5 5.5 6 14H2v-4z"/><path d="M8 4 12 8"/></Icon>
const UndoIcon          = ({ size }) => <Icon size={size}><path d="M3 5.5H10a4 4 0 0 1 0 8H6"/><path d="M5.5 2.5 3 5.5l2.5 3"/></Icon>

export {
  PlusIcon, MoreIcon, IDEIcon, IdeLogoIcon, CommitIcon, PlayIcon, StopIcon, CheckIcon, ClockIcon,
  SearchIcon, GridIcon, ListViewIcon, FolderIcon, FolderOpenIcon,
  SortIcon, TrashIcon, GithubIcon, EditIcon,
  UserIcon, GitIcon, APIIcon, PaletteIcon, ShieldIcon, EyeIcon, EyeOffIcon, SaveIcon,
  DragIcon, TrendIcon, NoteIcon2, ArrowLeftIcon, TagIcon, LinkIcon, CheckCircleIcon, StarIcon,
  DownloadIcon, AlertTriangleIcon, BranchIcon, RefreshIcon, ExternalLinkIcon, XCircleIcon,
  TerminalIcon, ActivityIcon, CopyIcon, AIIcon, KeyboardIcon, DatabaseIcon, GitInitIcon, UploadCloudIcon,
  VaultIcon, HomeIcon, BulbIcon, ImportIcon, PlusCircleIcon, GameIcon, GiftIcon, MusicNoteIcon,
  PuzzleIcon, CrocoIcon, CalendarIcon, PinIcon, PackageIcon, FileIcon, BellIcon, WindowIcon,
  EraserIcon, UndoIcon, LockIcon, InfoIcon, FlameIcon,
}
