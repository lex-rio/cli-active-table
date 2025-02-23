import * as readline from 'node:readline';
import EventEmitter = require('node:events');

export type Key = {
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
};

const events = {
  0: 'click',
  1: 'middleclick',
  2: 'rightclick',
  64: 'scroll-up',
  65: 'scroll-down',
  999: 'doubleclick',
} as const;
const lastClick = { time: 0, x: 0, y: 0 };
const doubleClickThreshold = 250;

export type Coords = { x: number; y: number };

export type Mouse = {
  x: number;
  y: number;
  state: 'press' | 'release';
  type: (typeof events)[keyof typeof events];
};

const keyMap: Record<string, [string, boolean, boolean]> = {
  ' ': ['space', false, false],
  '\x00': ['space', true, false],
  '\r': ['return', false, false],
  '\x1BOM': ['return', false, true],
  '\t': ['tab', false, false],
  '\x1B[Z': ['tab', false, true],
  '\b': ['backspace', true, false],
  '\x7f': ['backspace', false, false],
  '\x1B': ['escape', false, false],
  '\x1B[6~': ['pagedown', false, false],
  '\x1B[5~': ['pageup', false, false],
  '\x1B[3~': ['delete', false, false],
  '\x1B[3;5~': ['delete', true, false],
  '\x1B[3;2~': ['delete', false, true],
  '\x1b[A': ['up', false, false],
  '\x1B[1;5A': ['up', true, false],
  '\x1b[B': ['down', false, false],
  '\x1B[1;5B': ['down', true, false],
  '\x1b[C': ['right', false, false],
  '\x1B[1;5C': ['right', true, false],
  '\x1b[D': ['left', false, false],
  '\x1B[1;5D': ['left', true, false],
};
const getKey = (sequence: string) => {
  const key = keyMap[sequence] || [
    sequence.length === 1 && sequence.charCodeAt(0) < 32
      ? String.fromCharCode(sequence.charCodeAt(0) + 96)
      : sequence,
  ];
  const spec = sequence in keyMap;
  const [name, ctrl, shift] = key;
  return {
    sequence,
    name: name.toLowerCase(),
    ctrl: spec ? ctrl : sequence.charCodeAt(0) < 32,
    shift: spec ? shift : /[A-Z]/.test(name),
  };
};

export class UserIO extends EventEmitter {
  private cache: Map<Coords, string[]> = new Map();
  #viewport = { columns: 0, rows: 0 };

  constructor(private input: NodeJS.ReadStream, private output: NodeJS.WriteStream) {
    super();
    this.updateViewport();
    input.on('data', (event) => {
      const data = event.toString();
      const match = data.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm]?)/);
      if (!match) return this.emit('key', getKey(data));
      const buttonState = match[4];
      const [_, button, x, y] = match.map(Number);
      const state = buttonState === 'M' ? 'press' : 'release';
      let type: Mouse['type'];
      if (state === 'press' && button === 0) {
        const now = Date.now();
        const double =
          now - lastClick.time < doubleClickThreshold &&
          x === lastClick.x &&
          y === lastClick.y;
        if (double) {
          type = 'doubleclick';
        }
        lastClick.time = now;
        lastClick.x = x;
        lastClick.y = y;
      }
      type ||= events[button as keyof typeof events];
      if (type) this.emit('mouse', { x, y, state, type });
      else this.emit('mousemove', { x, y, state });
    });
    output.on('resize', () => {
      this.updateViewport();
      this.emit('resize');
    });
  }

  private updateViewport() {
    this.#viewport = {
      columns: process.stdout.columns,
      rows: process.stdout.rows,
    };
  }

  prepare() {
    if (this.input.isTTY) this.input.setRawMode(true);
    this.output.write('\u001b[?25l'); // hide cursor
    this.output.write('\x1b[?1003h'); // mouse detection mode
    this.output.write('\x1b[?1006h'); // SGR-mode on
  }

  returnDefault() {
    this.output.write('\u001b[?25h'); // return cursor
    this.output.write('\x1b[?1003l'); // mouse detection mode off
    this.output.write('\x1b[?1006l'); // SGR-mode off
  }

  print(rows: string[], coords: Coords, force = false) {
    if (!this.cache.has(coords)) this.cache.set(coords, []);
    const cache = this.cache.get(coords) as string[];
    rows.forEach((row, i) => {
      if (!force && row === cache[i]) return;
      cache[i] = row;
      readline.cursorTo(this.output, coords.x, coords.y + i);
      this.output.write(row);
    });
    cache.length = rows.length;
  }

  clear() {
    this.output.write('\u001b[H\u001b[J');
    this.cache.clear();
  }

  get viewport() {
    return this.#viewport;
  }
}
