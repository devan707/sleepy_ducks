let visible = true;

export function isWatchInstructionsVisible(): boolean {
  return visible;
}

export function setWatchInstructionsVisible(value: boolean): void {
  visible = value;
}

export function toggleWatchInstructionsVisible(): boolean {
  visible = !visible;
  return visible;
}

export function resetWatchInstructions(): void {
  visible = true;
}
