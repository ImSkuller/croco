import { useState } from 'react'
import { SaveIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, TextInput, IDEOption, ToggleChip } from './Exports'

const IDE_OPTIONS = [
  { value: 'vscode',    label: 'Visual Studio Code' },
  { value: 'cursor',    label: 'Cursor'             },
  { value: 'windsurf',  label: 'Windsurf'           },
  { value: 'trae',      label: 'Trae'               },
  { value: 'zed',       label: 'Zed'                },
  { value: 'fleet',     label: 'Fleet'              },
  { value: 'webstorm',  label: 'WebStorm'           },
  { value: 'idea',      label: 'IntelliJ IDEA'      },
  { value: 'sublime',   label: 'Sublime Text'       },
  { value: 'neovim',    label: 'Neovim'             },
  { value: 'vim',       label: 'Vim'                },
  { value: 'claude-code', label: 'Claude Code'       },
]

const SHELL_OPTIONS = {
  win32:  [{ value: '',           label: 'cmd.exe (default)' }, { value: 'powershell', label: 'PowerShell' }],
  other:  [{ value: '',           label: 'sh (default)' }, { value: 'bash', label: 'Bash' }, { value: 'zsh', label: 'Zsh' }, { value: 'fish', label: 'Fish' }],
}

export default function DefaultsSection({ settings, saveField, platform }) {
  const d = settings.defaults || {}
  const defaultIDE = d.ide || 'vscode'
  const defaultVisibility = d.visibility || 'public'
  const defaultShell = d.shell || ''
  const [defaultBranch, setDefaultBranch] = useState(d.gitBranch || 'main')

  return (
    <>
      <SectionTitle icon={<SaveIcon />} title="New Projects" desc="Starting choices for new projects." />

      <SettingsCard>
        <FieldLabel>Code Editor</FieldLabel>
        <FieldDesc>The editor that opens when a project doesn't have its own.</FieldDesc>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
          {IDE_OPTIONS.map(ide => (
            <IDEOption
              key={ide.value}
              ide={ide}
              selected={defaultIDE === ide.value}
              onClick={() => saveField({ defaults: { ide: ide.value } })}
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Main Branch Name</FieldLabel>
        <FieldDesc>The branch name used when saving and uploading your changes with Git.</FieldDesc>
        <TextInput value={defaultBranch} onChange={setDefaultBranch} onBlur={() => saveField({ defaults: { gitBranch: defaultBranch } })} placeholder="main" mono />
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>New Projects Are</FieldLabel>
        <FieldDesc>Public projects show up as normal. Hidden ones are kept private.</FieldDesc>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {['public', 'hidden'].map(v => (
            <ToggleChip
              key={v}
              label={v}
              active={defaultVisibility === v}
              color={v === 'hidden' ? 'var(--purple)' : 'var(--blue)'}
              bg={v === 'hidden' ? 'rgba(168,85,247,0.1)' : 'rgba(74,158,255,0.1)'}
              onClick={() => saveField({ defaults: { visibility: v } })}
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Terminal Type</FieldLabel>
        <FieldDesc>The command-line program used when you run a project. If unsure, keep the default.</FieldDesc>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {(SHELL_OPTIONS[platform] || SHELL_OPTIONS.other).map(opt => (
            <ToggleChip
              key={opt.value}
              label={opt.label}
              active={defaultShell === opt.value}
              color="var(--accent)"
              bg="var(--accent-dim)"
              onClick={() => saveField({ defaults: { shell: opt.value } })}
            />
          ))}
        </div>
      </SettingsCard>
    </>
  )
}
