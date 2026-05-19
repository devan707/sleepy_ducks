import {
  dismissForSession,
  getInstallPromptKind,
  triggerInstall,
  type InstallPromptKind,
} from '../pwa/installPrompt';

let bannerEl: HTMLElement | null = null;

export function hideInstallPromptBanner(): void {
  bannerEl?.remove();
  bannerEl = null;
}

export function showInstallPromptBanner(): InstallPromptKind | null {
  const kind = getInstallPromptKind();
  if (!kind) return null;
  if (bannerEl) return kind;

  hideInstallPromptBanner();

  const root = document.createElement('div');
  root.className = 'sd-install-prompt';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', kind === 'ios' ? 'Add to Home Screen' : 'Install Sleepy Ducks');

  const panel = document.createElement('div');
  panel.className = 'sd-install-prompt__panel';

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'sd-install-prompt__dismiss';
  dismissBtn.setAttribute('aria-label', 'Dismiss');
  dismissBtn.textContent = '×';

  const title = document.createElement('div');
  title.className = 'sd-install-prompt__title';

  const body = document.createElement('div');
  body.className = 'sd-install-prompt__body';

  const actions = document.createElement('div');
  actions.className = 'sd-install-prompt__actions';

  if (kind === 'ios') {
    title.textContent = 'Add Sleepy Ducks to Home Screen';
    body.innerHTML =
      'Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong> for the best full-screen experience.';

    const gotItBtn = document.createElement('button');
    gotItBtn.type = 'button';
    gotItBtn.className = 'sd-install-prompt__primary';
    gotItBtn.textContent = 'Got it';
    gotItBtn.addEventListener('click', () => dismiss());
    actions.appendChild(gotItBtn);
  } else {
    title.textContent = 'Install Sleepy Ducks';
    body.textContent = 'Quick access from your home screen — no browser bar.';

    const installBtn = document.createElement('button');
    installBtn.type = 'button';
    installBtn.className = 'sd-install-prompt__primary';
    installBtn.textContent = 'Install';
    installBtn.addEventListener('click', async () => {
      const outcome = await triggerInstall();
      if (outcome === 'accepted') {
        dismiss(false);
      }
    });

    const notNowBtn = document.createElement('button');
    notNowBtn.type = 'button';
    notNowBtn.className = 'sd-install-prompt__secondary';
    notNowBtn.textContent = 'Not now';
    notNowBtn.addEventListener('click', () => dismiss());

    actions.append(installBtn, notNowBtn);
  }

  dismissBtn.addEventListener('click', () => dismiss());

  panel.append(dismissBtn, title, body, actions);
  root.appendChild(panel);
  document.body.appendChild(root);
  bannerEl = root;

  requestAnimationFrame(() => {
    root.classList.add('sd-install-prompt--visible');
  });

  return kind;

  function dismiss(remember = true): void {
    if (remember) dismissForSession();
    hideInstallPromptBanner();
  }
}
