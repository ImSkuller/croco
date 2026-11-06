import { AIIcon } from '../../constants/SimpleSvgExports'
import { SectionTitle } from './Exports'
import DiscordModuleCard from './modules/DiscordModuleCard'
import IdeModuleCard from './modules/IdeModuleCard'
import AiModuleCard from './modules/AiModuleCard'
import DockerModuleCard from './modules/DockerModuleCard'
import EnvManagerModuleCard from './modules/EnvManagerModuleCard'
import SlackModuleCard from './modules/SlackModuleCard'
import FocusTimerModuleCard from './modules/FocusTimerModuleCard'
import SocialModuleCard from './modules/SocialModuleCard'

// Each card below is fully self-contained — reads settings from the shared
// store and writes straight through window.api itself — so this file is
// just the list, not a prop-drilling hub. See docs/modules-plan.md.
export default function ModulesSection({ aiKeysStored }) {
  return (
    <>
      <SectionTitle icon={<AIIcon />} title="Modules" desc="Extra features you can turn on. They're all off by default and still in beta, so expect a few rough edges." />
      <DiscordModuleCard />
      <IdeModuleCard />
      <AiModuleCard aiKeysStored={aiKeysStored} />
      <DockerModuleCard />
      <EnvManagerModuleCard />
      <SlackModuleCard />
      <FocusTimerModuleCard />
      <SocialModuleCard />
    </>
  )
}
