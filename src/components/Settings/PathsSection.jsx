import { useState } from 'react'
import { FolderIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle, SettingsCard, FieldLabel, FieldDesc, PathInput, InfoBox } from './Exports'

const mono = { fontFamily: 'Geist Mono, monospace', color: 'var(--text)' }

export default function PathsSection({ settings, saveField, appDataPath }) {
  const [publicPath, setPublicPath] = useState(settings.paths?.publicProjects || '')
  const [hiddenPath, setHiddenPath] = useState(settings.paths?.hiddenProjects || '')
  const [customDataPath, setCustomDataPath] = useState(settings.app?.dataPath || '')

  const pickFolder = async (setter, onPicked) => {
    if (!window.api) return
    const picked = await window.api.system.showFolderPicker()
    if (picked) { setter(picked); onPicked(picked) }
  }

  return (
    <>
      <SectionTitle icon={<FolderIcon />} title="Folders" desc="Where your projects and Croco's data are saved." />

      <SettingsCard>
        <FieldLabel>Projects Folder</FieldLabel>
        <FieldDesc>New projects are created here.</FieldDesc>
        <PathInput
          value={publicPath}
          onChange={setPublicPath}
          onBlur={() => saveField({ paths: { publicProjects: publicPath } })}
          onBrowse={() => pickFolder(setPublicPath, (p) => saveField({ paths: { publicProjects: p } }))}
        />
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Private Projects Folder</FieldLabel>
        <FieldDesc>New private projects are created here. The folder is hidden in your file explorer.</FieldDesc>
        <PathInput
          value={hiddenPath}
          onChange={setHiddenPath}
          onBlur={() => saveField({ paths: { hiddenProjects: hiddenPath } })}
          onBrowse={() => pickFolder(setHiddenPath, (p) => saveField({ paths: { hiddenProjects: p } }))}
        />
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Croco Data Folder</FieldLabel>
        <FieldDesc>Where Croco saves your projects' details, notes, and todos.</FieldDesc>
        <PathInput value={appDataPath} onChange={() => {}} disabled />
      </SettingsCard>

      <SettingsCard>
        <FieldLabel>Use a Different Data Folder</FieldLabel>
        <FieldDesc>Save your data somewhere else, like a Dropbox or OneDrive folder. Leave empty to use the default. Your existing data is not moved for you.</FieldDesc>
        <PathInput
          value={customDataPath}
          onChange={setCustomDataPath}
          onBlur={() => saveField({ app: { dataPath: customDataPath } })}
          onBrowse={() => pickFolder(setCustomDataPath, (p) => saveField({ app: { dataPath: p } }))}
          placeholder="Leave empty to use the default"
        />
        {customDataPath && (
          <InfoBox>Croco will now use <span style={mono}>{customDataPath}</span>. To keep your old data, copy it over from <span style={mono}>{appDataPath}</span>.</InfoBox>
        )}
      </SettingsCard>
    </>
  )
}
