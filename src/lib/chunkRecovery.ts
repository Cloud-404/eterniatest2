const CHUNK_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "Loading chunk",
  "Loading CSS chunk",
  "Unable to preload CSS",
];

const clearRuntimeCaches = async () => {
  if (typeof window === "undefined") return;

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
  }
};

export const isChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const recoverFromChunkLoadFailure = async (storageKey: string) => {
  if (typeof window === "undefined") return false;
  if (sessionStorage.getItem(storageKey)) return false;

  sessionStorage.setItem(storageKey, "1");

  try {
    await clearRuntimeCaches();
  } catch (error) {
    console.warn("Failed to clear cached app assets during recovery", error);
  }

  window.location.reload();
  return true;
};