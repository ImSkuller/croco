import { AIIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle } from './Exports'
import DiscordModuleCard from './modules/DiscordModuleCard'
import IdeModuleCard from './modules/IdeModuleCard'
import AiModuleCard from './modules/AiModuleCard'
import DockerModuleCard from './modules/DockerModuleCard'
import EnvManagerModuleCard from './modules/EnvManagerModuleCard'
import SlackModuleCard from './modules/SlackModuleCard'
import FocusTimerModuleCard from './modules/FocusTimerModuleCard'

// Each card below is fully self-contained — reads settings from the shared
// store and writes straight through window.api itself — so this file is
// just the list, not a prop-drilling hub. See docs/modules-plan.md.
export default function ModulesSection({ aiKeysStored }) {
  return (
    <>
      <SectionTitle icon={<AIIcon />} title="Modules" desc="Optional features, off by default. Each is in beta — expect rough edges, and enable only what you want to try." />
      <DiscordModuleCard />
      <IdeModuleCard />
      <AiModuleCard aiKeysStored={aiKeysStored} />
      <DockerModuleCard />
      <EnvManagerModuleCard />
      <SlackModuleCard />
      <FocusTimerModuleCard />
    </>
  )
}
