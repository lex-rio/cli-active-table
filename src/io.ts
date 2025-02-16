import * as readline from 'node:readline';
import EventEmitter = require('node:events');

export type Key = {
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
};

export class UserIO extends EventEmitter {
  constructor(
    private readStream: NodeJS.ReadStream,
    private writeStream: NodeJS.WriteStream
  ) {
    super();
    const rl = readline.createInterface({
      input: this.readStream,
      output: this.writeStream,
      terminal: false, // We don’t need the prompt to be shown
    });
    if (readStream.isTTY) this.readStream.setRawMode(true);
    readline.emitKeypressEvents(this.readStream, rl);

    this.readStream.on('data', (event) => {
      const data = event.toString();
      if (!data.startsWith('\x1b[')) return;
      const match = data.match(/\x1b\[M(.)(.)(.)/);
      if (match) {
        this.emit('mouse', match.slice(1));
      }
    });
    this.readStream.on('keypress', (_, key) => this.emit('key', key));
  }

  prepare() {
    this.writeStream.write('\u001b[?25l'); // hide cursor
    this.writeStream.write('\x1b[?1003h'); // mouse detection mode
  }

  returnDefault() {
    this.writeStream.write('\u001b[?25h'); // return cursor
    this.writeStream.write('\x1b[?1003l'); // mouse detection mode off
  }

  writeLine(line: string, x: number, y = 0) {
    readline.cursorTo(this.writeStream, x, y);
    this.writeStream.write(line);
  }
}
