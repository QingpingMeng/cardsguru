const NOTIFIED_KEY = 'cardsguru:notified';

export type PermissionState = NotificationPermission | 'unsupported';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermission(): PermissionState {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function loadNotified(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveNotified(keys: Set<string>): void {
  try {
    // Cap the stored set so it can't grow unbounded.
    const arr = [...keys].slice(-500);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

export interface LocalNotification {
  /** Stable de-dupe key, e.g. `${userCardId}:${benefitId}:${periodKey}`. */
  key: string;
  title: string;
  body: string;
}

/**
 * Fire OS notifications for the given items that haven't been notified before.
 * Uses the service worker registration when available (required on some browsers),
 * falling back to the Notification constructor. Returns how many were shown.
 */
export async function showLocalNotifications(items: LocalNotification[]): Promise<number> {
  if (getPermission() !== 'granted' || items.length === 0) return 0;

  const notified = loadNotified();
  const fresh = items.filter((i) => !notified.has(i.key));
  if (fresh.length === 0) return 0;

  const reg =
    'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;

  for (const item of fresh) {
    const options: NotificationOptions = {
      body: item.body,
      tag: item.key,
      icon: withBase('pwa-192x192.png'),
      badge: withBase('pwa-192x192.png'),
    };
    try {
      if (reg) {
        await reg.showNotification(item.title, options);
      } else {
        new Notification(item.title, options);
      }
      notified.add(item.key);
    } catch {
      /* ignore individual failures */
    }
  }

  saveNotified(notified);
  return fresh.length;
}

function withBase(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base}${path}`.replace(/\/{2,}/g, '/');
}
