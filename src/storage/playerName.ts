const KEY = 'sleeping-ducks-player-name';
const MAX_LEN = 18;

export function getPlayerName(): string {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return '';
    return raw.slice(0, MAX_LEN);
  } catch {
    return '';
  }
}

export function setPlayerName(name: string): void {
  try {
    const trimmed = name.trim().slice(0, MAX_LEN);
    if (trimmed) {
      localStorage.setItem(KEY, trimmed);
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    /* ignore */
  }
}

export function displayPlayerName(): string {
  const name = getPlayerName();
  return name || 'Player';
}
