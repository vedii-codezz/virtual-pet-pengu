const STORAGE_KEY = 'penguin-hunger';
const INITIAL_HUNGER = 60;

export function createPetState() {
  let hunger = INITIAL_HUNGER;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null && Number.isFinite(Number(stored))) {
      hunger = Math.max(0, Math.min(100, Number(stored)));
    }
  } catch {
    // The pet remains usable when browser storage is unavailable.
  }

  const subscribers = new Set();

  function setHunger(value) {
    const next = Math.max(0, Math.min(100, value));
    if (next === hunger) return;
    hunger = next;
    try { localStorage.setItem(STORAGE_KEY, String(hunger)); } catch { /* Storage is optional. */ }
    subscribers.forEach((subscriber) => subscriber(hunger));
  }

  const decayTimer = window.setInterval(() => setHunger(hunger - 1), 60_000);

  return {
    get hunger() { return hunger; },
    feed() { setHunger(hunger + 20); },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      subscriber(hunger);
      return () => subscribers.delete(subscriber);
    },
    dispose() {
      window.clearInterval(decayTimer);
      subscribers.clear();
    }
  };
}
