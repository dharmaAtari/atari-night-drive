/**
 * Loads and parses bin/config.xml into a plain JS object.
 *
 * Everything tunable at run time lives in that file, so systems read values
 * from here instead of hardcoding them.
 */

const CONFIG_PATH = './bin/config.xml';

/** Scale mode names allowed in config.xml -> Phaser.Scale constants. */
const SCALE_MODES = {
  fit: 'FIT',
  envelop: 'ENVELOP',
  resize: 'RESIZE',
  none: 'NONE',
};

function text(root, selector, fallback) {
  const node = root.querySelector(selector);
  return node ? node.textContent.trim() : fallback;
}

function number(root, selector, fallback) {
  const value = Number(text(root, selector, fallback));
  return Number.isFinite(value) ? value : fallback;
}

function bool(root, selector, fallback) {
  return text(root, selector, String(fallback)) === 'true';
}

/**
 * @returns {Promise<object>} parsed config
 */
export async function loadConfig(path = CONFIG_PATH) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Could not load ${path} (HTTP ${response.status})`);
  }

  const doc = new DOMParser().parseFromString(await response.text(), 'application/xml');
  const error = doc.querySelector('parsererror');
  if (error) {
    throw new Error(`Malformed ${path}: ${error.textContent}`);
  }

  const scaleMode = text(doc, 'display > scaleMode', 'fit').toLowerCase();

  return {
    display: {
      width: number(doc, 'display > width', 640),
      height: number(doc, 'display > height', 480),
      scaleMode: SCALE_MODES[scaleMode] ?? SCALE_MODES.fit,
      autoCenter: bool(doc, 'display > autoCenter', true),
      fullscreen: bool(doc, 'display > fullscreen', false),
      backgroundColor: text(doc, 'display > backgroundColor', '#1a3aa8'),
      pixelArt: bool(doc, 'display > pixelArt', true),
    },
    performance: {
      targetFps: number(doc, 'performance > targetFps', 60),
    },
    audio: {
      volume: Number(doc.querySelector('audio > master')?.getAttribute('volume') ?? 1),
      // logical sound name -> filename under bin/assets/sounds/
      sounds: Object.fromEntries(
        [...doc.querySelectorAll('audio > sound')].map((node) => [
          node.getAttribute('name'),
          node.getAttribute('file'),
        ]),
      ),
    },
  };
}
