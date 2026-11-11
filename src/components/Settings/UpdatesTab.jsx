import { useState } from 'react'
import { useToast } from '../Toast/useToast.js'
import UpdatesSection from './UpdatesSection'

export default function UpdatesTab() {
  const toast = useToast()
  const [updateInfo,       setUpdateInfo]       = useState(null) // null | {checking} | result
  const [updateChecking,   setUpdateChecking]   = useState(false)
  const [updateInstalling, setUpdateInstalling] = useState(false)

  return (
    <UpdatesSection
      updateChecking={updateChecking} setUpdateChecking={setUpdateChecking}
      updateInfo={updateInfo} setUpdateInfo={setUpdateInfo}
      updateInstalling={updateInstalling} setUpdateInstalling={setUpdateInstalling}
      toast={toast}
    />
  )
}
