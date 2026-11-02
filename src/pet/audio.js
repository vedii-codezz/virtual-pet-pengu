export function createPurrAudio() {
  const button = document.createElement('button');
  button.className = 'pengu-mute';
  button.type = 'button';
  let muted = false;
  try { muted = localStorage.getItem('pengu-muted') === 'true'; } catch { /* Optional preference. */ }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let context;
  const oscillators = new Set();

  function renderButton() {
    button.textContent = muted ? '♪̸' : '♪';
    button.setAttribute('aria-label', muted ? 'Unmute Pengu' : 'Mute Pengu');
    button.setAttribute('aria-pressed', String(muted));
    button.title = muted ? 'Unmute Pengu' : 'Mute Pengu';
  }

  function toggle() {
    muted = !muted;
    if (muted) oscillators.forEach((oscillator) => {
      try { oscillator.stop(); } catch { /* Already stopped. */ }
    });
    try { localStorage.setItem('pengu-muted', String(muted)); } catch { /* Optional preference. */ }
    renderButton();
  }

  button.addEventListener('click', toggle);
  renderButton();
  document.querySelector('#app').appendChild(button);

  function purr() {
    if (muted || reducedMotion.matches) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context ??= new AudioContext();
    if (context.state === 'suspended') context.resume();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(145, now);
    oscillator.frequency.linearRampToValueAtTime(120, now + 0.55);
    gain.gain.setValueAtTime(0.0001, now);
    for (let pulse = 0; pulse < 3; pulse++) {
      const at = now + pulse * 0.17;
      gain.gain.linearRampToValueAtTime(0.018, at + 0.05);
      gain.gain.linearRampToValueAtTime(0.0001, at + 0.15);
    }
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.55);
    oscillators.add(oscillator);
    oscillator.onended = () => {
      oscillators.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  return {
    purr,
    dispose() {
      button.removeEventListener('click', toggle);
      button.remove();
      oscillators.forEach((oscillator) => { try { oscillator.stop(); } catch { /* Already stopped. */ } });
      context?.close();
    }
  };
}
