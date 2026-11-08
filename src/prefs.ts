// Мелкие настройки экрана на этом телефоне (последний раздел, период дашборда).
// localStorage может быть недоступен (приватный режим, старый клиент) — тогда просто не запоминаем.
export function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem('pref:' + key);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: string): void {
  try { localStorage.setItem('pref:' + key, value); } catch { /* не страшно */ }
}
