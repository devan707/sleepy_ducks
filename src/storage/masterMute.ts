const KEY = 'sleeping-ducks-master-mute';

type Listener = (muted: boolean) => void;

let cached = load();
const listeners = new Set<Listener>();

function load(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function save(muted: boolean): void {
  try {
    localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}

export function isMasterMuted(): boolean {
  return cached;
}

export function setMasterMuted(muted: boolean): void {
  if (cached === muted) return;
  cached = muted;
  save(muted);
  for (const listener of listeners) listener(muted);
}

export function toggleMasterMuted(): boolean {
  setMasterMuted(!cached);
  return cached;
}

export function subscribeMasterMute(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
