const STORAGE_KEY = 'penguin-hunger';
const INITIAL_HUNGER = 60;
const ENERGY_KEY = 'penguin-energy';
const INITIAL_ENERGY = 80;

export function createPetState() {
  let hunger = INITIAL_HUNGER;
  let energy = INITIAL_ENERGY;
  let sleeping = false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null && Number.isFinite(Number(stored))) {
      hunger = Math.max(0, Math.min(100, Number(stored)));
    }
    const storedEnergy = localStorage.getItem(ENERGY_KEY);
    if (storedEnergy !== null && Number.isFinite(Number(storedEnergy))) {
      energy = Math.max(0, Math.min(100, Number(storedEnergy)));
    }
  } catch {
    // The pet remains usable when browser storage is unavailable.
  }

  const subscribers = new Set();
  const statusSubscribers = new Set();
  const status = () => ({ hunger, energy, sleeping });
  const notifyStatus = () => statusSubscribers.forEach((subscriber) => subscriber(status()));

  function setHunger(value) {
    const next = Math.max(0, Math.min(100, value));
    if (next === hunger) return;
    hunger = next;
    try { localStorage.setItem(STORAGE_KEY, String(hunger)); } catch { /* Storage is optional. */ }
    subscribers.forEach((subscriber) => subscriber(hunger));
    notifyStatus();
  }

  function setEnergy(value) {
    const next = Math.max(0, Math.min(100, value));
    if (next === energy) return;
    energy = next;
    try { localStorage.setItem(ENERGY_KEY, String(energy)); } catch { /* Storage is optional. */ }
    notifyStatus();
  }

  let ticks = 0;
  const decayTimer = window.setInterval(() => {
    ticks++;
    if (sleeping) setEnergy(energy + 1);
    if (ticks % 6 === 0) {
      setHunger(hunger - 1);
      if (!sleeping) setEnergy(energy - 1);
    }
  }, 10_000);

  return {
    get hunger() { return hunger; },
    get energy() { return energy; },
    get sleeping() { return sleeping; },
    feed() { if (!sleeping) setHunger(hunger + 20); },
    setSleeping(value) {
      if (sleeping === Boolean(value)) return;
      sleeping = Boolean(value);
      notifyStatus();
    },
    subscribeStatus(subscriber) {
      statusSubscribers.add(subscriber);
      subscriber(status());
      return () => statusSubscribers.delete(subscriber);
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      subscriber(hunger);
      return () => subscribers.delete(subscriber);
    },
    dispose() {
      window.clearInterval(decayTimer);
      subscribers.clear();
      statusSubscribers.clear();
    }
  };
}
