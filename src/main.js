import './style.css'
import { PLAYER_1, SYSTEM } from '@rcade/plugin-input-classic'
import { MANIFEST, BLOB, XOR_KEY } from './roms-blob.js'

// Must be defined before galaga.js executes
// Copy the cropped top/bottom strips into the gutter canvas each frame.
const mameCanvas = document.getElementById('canvas');

const gutterCtx = document.getElementById('gutter').getContext('2d');
const TOP_CROP = 15, BOT_CROP = 11, SRC_W = 224, GUTTER_W = 112, GUTTER_H = 262;
const topStripH = Math.round(TOP_CROP * GUTTER_W / SRC_W); // ~8px
const botStripH = Math.round(BOT_CROP * GUTTER_W / SRC_W); // ~6px

function copyStrips() {
  gutterCtx.drawImage(mameCanvas, 0, 0,                   SRC_W, TOP_CROP, 0, 0,              GUTTER_W, topStripH);
  gutterCtx.drawImage(mameCanvas, 0, 288 - BOT_CROP,      SRC_W, BOT_CROP, 0, GUTTER_H - botStripH, GUTTER_W, botStripH);
  requestAnimationFrame(copyStrips);
}

window.Module = {
  canvas: mameCanvas,
  arguments: ['galaga', '-window'],
  locateFile: (f) => `/${f}`,
  print: (text) => console.log('[MAME]', text),
  printErr: (text) => console.error('[MAME]', text),
  onAbort: (reason) => console.error('[MAME abort reason]', reason),
  postRun: [() => { requestAnimationFrame(copyStrips); }],
  preRun: [() => {
    const b64 = atob(BLOB);
    const raw = new Uint8Array(b64.length);
    for (let i = 0; i < b64.length; i++) raw[i] = b64.charCodeAt(i) ^ XOR_KEY;

    FS.mkdir('/roms');
    FS.mkdir('/roms/galaga');

    for (const { name, offset, size } of MANIFEST) {
      FS.writeFile(`/roms/galaga/${name}`, raw.subarray(offset, offset + size));
    }
  }],
};

const script = document.createElement('script');
script.src = '/galaga.js';
document.body.appendChild(script);

// --- Input bridging ---

const KEYS = {
  left:  { code: 'ArrowLeft',   key: 'ArrowLeft',  keyCode: 37 },
  right: { code: 'ArrowRight',  key: 'ArrowRight', keyCode: 39 },
  fire:  { code: 'ControlLeft', key: 'Control',    keyCode: 17 },
  start: { code: 'Digit1',      key: '1',          keyCode: 49 },
  coin:  { code: 'Digit5',      key: '5',          keyCode: 53 },
};

const held = new Set();

function press(k) {
  if (held.has(k.code)) return;
  held.add(k.code);
  window.dispatchEvent(new KeyboardEvent('keydown', { ...k, bubbles: true }));
}

function release(k) {
  if (!held.has(k.code)) return;
  held.delete(k.code);
  window.dispatchEvent(new KeyboardEvent('keyup', { ...k, bubbles: true }));
}

let coinInserted = false;

function update() {
  // ONE_PLAYER: insert coin then press start (once)
  if (SYSTEM.ONE_PLAYER && !coinInserted) {
    coinInserted = true;
    press(KEYS.coin);
    setTimeout(() => release(KEYS.coin), 100);
    setTimeout(() => press(KEYS.start), 150);
    setTimeout(() => release(KEYS.start), 250);
  }

  PLAYER_1.DPAD.left  ? press(KEYS.left)  : release(KEYS.left);
  PLAYER_1.DPAD.right ? press(KEYS.right) : release(KEYS.right);
  PLAYER_1.A          ? press(KEYS.fire)  : release(KEYS.fire);

  requestAnimationFrame(update);
}

update();
