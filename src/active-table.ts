import * as readline from 'node:readline';
import { chalk } from './tools';

type Key = {
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
};

const searchHighlightColor = 'magenta';
const searchTypes = ['string', 'number'];
const columnSeparator = ' ';

type BaseOptions<T extends object, F extends keyof T> = {
  fields?: F[];
  title?: string;
};

type Size = { height?: number; width?: number };

type Options<T extends object, F extends keyof T = keyof T> = T extends {
  id: F;
}
  ? BaseOptions<T, F>
  : BaseOptions<T, F> & { primary?: F };

type TSection<T extends object> = {
  data: T[];
} & Options<T>;

const border = {
  vertical: '│',
  horisontal: '─',
  leftTop: '┌',
  rightTop: '┐',
  leftBottom: '└',
  rightBottom: '┘',
  scroll: '▓',
};

class Section<T extends unknown = unknown> {
  viewportPos = 0;
  #cursorPos = 0;
  #isActive = false;
  protected filterMode = false;
  protected filter = '';
  protected filterTokens: string[] = [];
  private height = 0;
  private width = 0;

  keyActions: Record<string, () => unknown> = {};
  navigation: Record<string, () => void> = {};

  constructor(protected filtered: T[], private title: string) {}

  get isActive() {
    return this.#isActive;
  }

  set isActive(val: boolean) {
    this.filterMode = false;
    this.#isActive = val;
  }

  get size() {
    return { height: this.height, width: this.width };
  }

  set size({ height, width }: Size) {
    this.height ||= height;
    this.width ||= width;
  }

  get cursorPos() {
    return this.#cursorPos;
  }

  set cursorPos(val) {
    const filtered = this.filtered.length;
    this.#cursorPos = Math.max(0, Math.min(val, filtered - 1));
    if (this.#cursorPos < this.viewportPos) {
      this.viewportPos = this.#cursorPos;
    } else if (
      this.#cursorPos >=
      this.viewportPos + Math.min(this.size.height, filtered)
    ) {
      this.viewportPos = this.#cursorPos - Math.min(this.size.height, filtered) + 1;
    }
  }

  render() {
    return { size: this.size, rows: [] as string[] };
  }

  handleTyping(key: Key) {
    if (!this.filterMode) return;
    if (key.name === 'backspace') {
      this.filter = key.ctrl ? '' : this.filter.slice(0, -1) || '';
    } else {
      this.filter += key.sequence.toLowerCase();
    }
    this.filterTokens = this.filter.trim().split(' ').filter(Boolean);
    this.filterData(this.filterTokens);
  }

  filterData(filterTokens: string[] = []) {}

  protected limitString(len: number, string = '') {
    return `...${string.slice(string.length + 4 - len)}`;
  }

  private borderHorisontal(len: number, text?: string) {
    if (!text) {
      return new Array(len).join(border.horisontal);
    }
    const textLen = text.replace(/\x1b\[[0-9;]*m/g, '').length;
    if (textLen > len) {
      return this.limitString(len, text);
    }
    const borderChunk = new Array(Math.floor((len - textLen - 1) / 2)).join(
      border.horisontal
    );
    let borderLine = `${borderChunk} ${text} ${borderChunk}`;
    borderLine +=
      len > borderChunk.length * 2 + textLen + 3 ? border.horisontal : '';
    return borderLine;
  }

  private renderFilter(title = '🔎 ') {
    return this.#isActive && this.filterMode
      ? chalk(title + this.filter, {
          color: searchHighlightColor,
          bgColor: 'white',
        })
      : title + this.filter;
  }

  protected wrap(rows: string[], totalNum: number) {
    const highlight = { style: 'bold' } as const;
    const scrollSize = Math.ceil((rows.length * rows.length) / totalNum);
    const scrollStart = Math.floor((this.viewportPos / totalNum) * rows.length);
    const scrollEnd = scrollStart + scrollSize;
    const { leftTop, rightTop, vertical, leftBottom, rightBottom, scroll } = border;
    const verticalBorder = this.#isActive ? chalk(vertical, highlight) : vertical;
    const len = this.size.width;
    const top = `${leftTop}${this.borderHorisontal(len, this.title)}${rightTop}`;
    const bottom = `${leftBottom}${this.borderHorisontal(
      len,
      this.renderFilter()
    )}${rightBottom}`;
    return [
      `${this.#isActive ? chalk(top, highlight) : top}`,
      ...rows.map(
        (row, i) =>
          `${verticalBorder}${row}${
            i >= scrollStart && i < scrollEnd ? scroll : verticalBorder
          }`
      ),
      `${this.#isActive ? chalk(bottom, highlight) : bottom}`,
    ];
  }
}

class ListSection<T extends object> extends Section<T> {
  private entities: T[];
  private selected: Set<T[keyof T]> = new Set();
  private primary: keyof T;
  private columnsWidthes: number[];
  private fields?: Options<T>['fields'];
  private filterRegExp: RegExp;
  constructor({ data, ...options }: TSection<T>) {
    super(data, options.title);
    this.entities = data;
    const fields = options.fields || (Object.keys(data[0]) as Options<T>['fields']);
    this.primary =
      'primary' in options
        ? (options.primary as keyof T)
        : this.fields.includes('id' as keyof T)
        ? ('id' as keyof T)
        : undefined;
    const columnsWidthes = [
      1,
      ...fields.map((field) =>
        Math.max(
          ...data.map((entity) => this.prepareCell(entity[field]).length),
          (field as string).length
        )
      ),
    ];
    this.size = {
      width: columnsWidthes.reduce((a, b) => a + b + columnSeparator.length, 0),
      height: 0,
    };
    this.columnsWidthes = columnsWidthes;
    this.fields ||= fields;
  }

  keyActions = {
    a: () => {
      if (this.selected.size === this.entities.length) {
        this.selected.clear();
      } else {
        this.filtered.forEach((entity) => this.selected.add(entity[this.primary]));
      }
    },
    d: () => this.deleteRows(),
    delete: () => this.deleteRows(),
    f: () => (this.filterMode = true),
  };

  navigation = {
    up: () => this.cursorPos--,
    down: () => this.cursorPos++,
    pageup: () => (this.cursorPos -= this.size.height),
    pagedown: () => (this.cursorPos += this.size.height),
    left: () => (this.cursorPos -= this.filtered.length),
    right: () => (this.cursorPos += this.filtered.length),
  };

  filterData(filterTokens: string[] = []) {
    this.cursorPos = 0;
    this.filterRegExp =
      filterTokens.length && new RegExp(filterTokens.join('|'), 'gi');
    this.filtered = filterTokens.length
      ? this.entities.filter((entity) =>
          this.entityMatchFilter(entity, filterTokens)
        )
      : this.entities;
  }

  render() {
    const rows = this.getVisible().map(({ entity, isSelected, isCursor }, i) =>
      chalk(
        this.renderRow(
          [
            isSelected ? chalk('✔', 'green') : ' ',
            ...this.fields.map((f) => entity[f]),
          ],
          this.filterTokens
        ),
        isCursor
          ? { bgColor: 'blue', color: 'black' }
          : i % 2
          ? { bgColor: 'dark' }
          : {}
      )
    );
    const header = chalk(this.renderRow(['', ...this.fields] as string[]), {
      style: 'inverted',
    });
    const footer = this.renderFooter();
    const emptyRow = new Array(this.size.width).join(' ');
    const emptyRows = new Array(this.size.height - rows.length).fill(emptyRow);

    return {
      size: this.size,
      rows: this.wrap([header, ...rows, ...emptyRows, footer], this.filtered.length),
    };
  }

  handleTyping(key: Key) {
    if (!this.filterMode && key.name === 'space') {
      return this.toggleActiveRow();
    }
    super.handleTyping(key);
  }

  private entityMatchFilter(entity: T, tokens: string[]) {
    const str = this.fields
      .reduce(
        (acc, f) => (
          searchTypes.includes(typeof entity[f]) && acc.push(entity[f]), acc
        ),
        []
      )
      .join('│')
      .toLowerCase();
    return tokens.every((token) => str.includes(token));
  }

  protected prepareCell(cell: string | T[keyof T]) {
    if (cell instanceof Date) {
      return cell.toISOString();
    }
    const cellType = typeof cell;
    if (cellType === 'object') {
      return cellType;
    }
    return `${cell}`;
  }

  //delete selected or delete one under cursor
  private deleteRows() {
    if (this.selected.size) {
      this.entities = this.entities.filter(
        (entity) => !this.selected.has(entity[this.primary])
      );
      this.selected.clear();
    } else {
      const deleteId = this.filtered[this.cursorPos]?.[this.primary];
      const index = this.entities.findIndex(
        (entity) => entity[this.primary] === deleteId
      );
      this.selected.delete(deleteId);
      this.entities.splice(index, 1);
    }
    // this.filter();
  }

  private renderFooter() {
    const position = `${this.cursorPos + 1}/${this.filtered.length}`;
    const selected = `Selected: ${this.selected.size}/${this.entities.length}`;
    return chalk(
      `${selected}${new Array(
        this.size.width - position.length - selected.length
      ).join(' ')}${position}`,
      { bgColor: 'grey', color: 'black' }
    );
  }

  toggleActiveRow() {
    const id = this.filtered[this.cursorPos][this.primary];
    this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
  }

  private renderRow(cells: (string | T[keyof T])[], filterTokens?: string[]) {
    return cells
      .map((cell, i) => {
        const cellType = typeof cell;
        cell = this.prepareCell(cell);
        const padedEl = `${cell}`.padEnd(this.columnsWidthes[i]);
        return this.filterRegExp &&
          filterTokens &&
          searchTypes.includes(cellType) &&
          this.stringMatchFilter(padedEl, filterTokens)
          ? padedEl.replace(this.filterRegExp, (s) =>
              chalk(s, { color: searchHighlightColor })
            )
          : padedEl;
      })
      .join(columnSeparator);
  }

  private stringMatchFilter(str: string, tokens: string[]) {
    return tokens.some((token) => str.toLowerCase().includes(token));
  }

  private getVisible() {
    const visible = this.filtered.slice(
      this.viewportPos,
      this.viewportPos + this.size.height
    );
    return visible.map((entity, i) => ({
      entity,
      isSelected: this.selected.has(entity[this.primary]),
      isCursor: this.cursorPos - this.viewportPos === i,
    }));
  }
}

export class ActiveTable<Types extends object[]> {
  private sections: Section[] = [];
  private viewport = {
    columns: process.stdout.columns,
    rows: process.stdout.rows,
  };

  constructor(...sections: { [Index in keyof Types]: TSection<Types[Index]> }) {
    this.sections.push(
      ...sections.map((config) => {
        const section = new ListSection(config);
        section.size = { height: 20 };
        return section;
      })
    );
    this.sections[0].isActive = true;
  }

  private keyActions = {
    c: () => process.exit(0),
  };

  private clearScreen() {
    process.stdout.write('\u001b[2J\u001b[0;0H');
  }

  private clear() {
    process.stdout.write('\u001b[H\u001b[J');
  }

  private render() {
    this.clear();
    this.layoutRender`${this.sections.map((section) => section.render())}`;
  }

  private layoutRender(
    _: TemplateStringsArray,
    values: { size: Size; rows: string[] }[]
  ) {
    const result: string[] = [];

    values.forEach(({ size, rows }) => {
      rows.forEach((row, i) => (result[i] = result[i] ? result[i] + row : row));
    });
    console.log(result.join('\n'));
  }

  private rotateSections(backward = false) {
    const current = this.sections.findIndex(({ isActive }) => isActive);
    if (current !== -1) {
      this.sections[current].isActive = false;
    }
    const delta = backward ? -1 : 1;
    const next =
      this.sections[current + delta] ||
      this.sections[backward ? this.sections.length - 1 : 0];
    next.isActive = true;
  }

  private handleResize() {
    process.stdout.on('resize', () => {
      this.viewport.columns = process.stdout.columns;
      this.viewport.rows = process.stdout.rows;
      this.render();
    });
  }

  private get activeSection() {
    return this.sections.find(({ isActive }) => isActive) || this.sections[0];
  }

  async handle() {
    this.clearScreen();
    this.render();
    this.handleResize();
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false, // We don’t need the prompt to be shown
    });
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin, rl);
    const ids = await new Promise<unknown>((resolve) => {
      process.stdin.on('keypress', (_: string, key: Key) => {
        const activeSection = this.activeSection;
        if (key.name === 'tab') {
          this.rotateSections(key.shift);
        } else if (key.name in activeSection.navigation) {
          activeSection.navigation[
            key.name as keyof typeof activeSection.navigation
          ]();
        } else if (
          (key.ctrl && key.name in activeSection.keyActions) ||
          key.name === 'delete'
        ) {
          activeSection.keyActions[
            key.name as keyof typeof activeSection.keyActions
          ]();
        } else if (key.ctrl && key.name in this.keyActions) {
          this.keyActions[key.name as keyof typeof this.keyActions]();
        } else if (key.name === 'escape') {
          resolve(['todo']);
        } else {
          activeSection.handleTyping(key);
        }
        this.render();
      });
    });

    this.clearScreen();
    return ids;
  }
}
