const SDK_URL = 'https://developers.arkadium.com/cdn/sdk/v2/sdk.js';

interface ArkadiumLifecycle {
  onTestReady?: () => void;
}

interface ArkadiumSdk {
  lifecycle?: ArkadiumLifecycle;
}

interface ArkadiumGlobal {
  getInstance?: () => Promise<ArkadiumSdk>;
}

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('arkadium sdk failed to load'));
    document.head.appendChild(script);
  });
}

export async function notifyArkadiumReady(enabled: boolean): Promise<boolean> {
  if (!enabled) {
    return false;
  }

  try {
    await loadScript(SDK_URL);
    const global = (globalThis as unknown as { Arkadium?: ArkadiumGlobal }).Arkadium;
    const sdk = await global?.getInstance?.();
    const lifecycle = sdk?.lifecycle;
    if (lifecycle && typeof lifecycle.onTestReady === 'function') {
      lifecycle.onTestReady();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
