import { DreamweedGrabSuppress } from '../objects/Dreamweed';
import { MoonflowerTapSuppress } from '../objects/Moonflower';
import { MasterMuteButton } from '../ui/MasterMuteButton';
import { SettingsButton } from '../ui/SettingsButton';
import { SettingsDrawer } from '../ui/SettingsDrawer';
import { SoundToggle } from '../ui/SoundToggle';

/** Clear static pointer-suppress flags so they never leak across scene restarts. */
export function resetGameplayPointerSuppress(): void {
  DreamweedGrabSuppress.reset();
  MoonflowerTapSuppress.reset();
  SettingsDrawer.resetSuppress();
  SettingsButton.resetSuppress();
  MasterMuteButton.resetSuppress();
  SoundToggle.resetSuppress();
}
