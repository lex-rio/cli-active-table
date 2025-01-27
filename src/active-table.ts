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
  lines?: number;
  height?: number;
  validate?: (selectedList: T[], { message }: { message: string }) => boolean;
};

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
  leftTop: '╭',
  rightTop: '╮',
  leftBottom: '╰',
  rightBottom: '╯',
  scroll: '▓',
};

function prepareCell(cell: unknown) {
  if (cell instanceof Date) {
    return cell.toISOString();
  }
  const cellType = typeof cell;
  if (cell && cellType === 'object') {
    return cellType;
  }
  return `${cell}`;
}

class Section<T extends unknown = unknown> {
  viewportPos = 0;
  #cursorPos = 0;
  #isActive = false;
  private error = '';
  protected filterMode = false;
  protected filter = '';
  protected filterTokens: string[] = [];

  keyActions: Record<string, () => unknown> = {};
  navigation: Record<string, () => void> = {};

  constructor(
    protected filtered: T[],
    private title: string,
    public size: { lines: number; width: number }
  ) {
    this.title = this.limitString(this.size.width, this.title);
  }

  get isActive() {
    return this.#isActive;
  }

  set isActive(val: boolean) {
    this.filterMode = false;
    this.#isActive = val;
  }

  get cursorPos() {
    return this.#cursorPos;
  }

  set cursorPos(val) {
    const filtered = this.filtered.length;
    this.error = '';
    this.#cursorPos = Math.max(0, Math.min(val, filtered - 1));
    if (this.#cursorPos < this.viewportPos) {
      this.viewportPos = this.#cursorPos;
    } else if (
      this.#cursorPos >=
      this.viewportPos + Math.min(this.size.lines, filtered)
    ) {
      this.viewportPos = this.#cursorPos - Math.min(this.size.lines, filtered) + 1;
    }
  }

  setError(message: string) {
    this.error = message;
  }

  render() {
    return [] as string[];
  }

  handleTyping(key: Key) {
    if (!this.filterMode) return;
    if (key.name === 'backspace') {
      this.filter = key.ctrl ? '' : this.filter.slice(0, -1) || '';
    } else {
      this.filter += key.sequence.toLowerCase();
    }
    this.filterTokens =
      this.filter
        .match(/"([^"]+)"|\S+/g)
        ?.map((token) => token.replace(/(^"|"$)/g, '')) || [];
    this.filterData(this.filterTokens);
  }

  filterData(filterTokens: string[] = []) {}

  protected limitString(limit: number, string = '') {
    return string.length >= limit
      ? `…${string.slice(string.length + 4 - limit)}`
      : string;
  }

  private borderHorisontal(len: number, text?: string) {
    if (!text) {
      return new Array(len).join(border.horisontal);
    }
    const textLen = text.replace(/\x1b\[[0-9;]*m/g, '').length;

    const borderChunk = new Array(Math.floor((len - textLen - 1) / 2)).join(
      border.horisontal
    );
    let borderLine = `${borderChunk} ${text} ${borderChunk}`;
    borderLine +=
      len > borderChunk.length * 2 + textLen + 3 ? border.horisontal : '';
    return borderLine;
  }

  private renderFilter(title = '🔎') {
    const extraLen = 2; // spaces
    const text = `${title}${this.limitString(
      this.size.width - extraLen - title.length,
      this.filter
    )}`;
    return this.#isActive && this.filterMode
      ? chalk(text, {
          color: searchHighlightColor,
          bgColor: 'white',
        })
      : text;
  }

  protected wrap(rows: string[], totalNum: number) {
    const highlight = { style: 'bold' } as const;
    const scrollSize = Math.ceil((rows.length * rows.length) / totalNum);
    const scrollStart = Math.floor((this.viewportPos / totalNum) * rows.length);
    const scrollEnd = scrollStart + scrollSize;
    const { leftTop, rightTop, vertical, leftBottom, rightBottom, scroll } = border;
    const verticalBorder = this.#isActive ? chalk(vertical, highlight) : vertical;
    const len = this.size.width;

    const title = this.error
      ? chalk(this.error, { bgColor: 'yellow', color: 'black' })
      : this.title;
    const top = `${leftTop}${this.borderHorisontal(len, title)}${rightTop}`;
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
  private filterRegExp?: RegExp;
  validate: Options<T>['validate'] = (_: unknown) => true;
  constructor({ data, ...options }: TSection<T>) {
    const fields =
      options.fields ||
      ((data?.length
        ? Object.keys(data[0])
        : ['provided data list is empty']) as Options<T>['fields']);
    const columnsWidthes = [
      1,
      ...fields.map((field) =>
        Math.max(
          ...data.map((entity) => prepareCell(entity[field]).length),
          (field as string).length
        )
      ),
    ];
    const extraRowsCount = 4; // horisonral borders + header and footer
    super(data, options.title, {
      width: columnsWidthes.reduce((a, b) => a + b + columnSeparator.length, 0),
      lines: options.lines ? options.lines : options.height - extraRowsCount,
    });
    this.entities = data;
    this.primary =
      'primary' in options
        ? (options.primary as keyof T)
        : this.fields.includes('id' as keyof T)
        ? ('id' as keyof T)
        : undefined;
    this.columnsWidthes = columnsWidthes;
    this.fields ||= fields;
    this.validate = options.validate || this.validate;
  }

  getSelected() {
    return this.entities.filter((entity) => this.selected.has(entity[this.primary]));
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
    pageup: () => (this.cursorPos -= this.size.lines),
    pagedown: () => (this.cursorPos += this.size.lines),
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
    const emptyRows = new Array(this.size.lines - rows.length).fill(emptyRow);

    return this.wrap([header, ...rows, ...emptyRows, footer], this.filtered.length);
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
    this.cursorPos = this.cursorPos;
  }

  private renderFooter() {
    const position = `${this.cursorPos + 1}/${this.filtered.length}`;
    const selected = `Selected: ${this.selected.size}/${this.entities.length}`;
    const gapSize = Math.max(0, this.size.width - position.length - selected.length);
    const footer = `${selected}${new Array(gapSize).join(' ')}${position}`;
    return chalk(footer, { bgColor: 'grey', color: 'black' });
  }

  toggleActiveRow() {
    const id = this.filtered[this.cursorPos][this.primary];
    this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
  }

  private renderRow(cells: (string | T[keyof T])[], filterTokens?: string[]) {
    return cells
      .map((cell, i) => {
        const padedEl = prepareCell(cell).padEnd(this.columnsWidthes[i]);
        return this.filterRegExp &&
          filterTokens &&
          searchTypes.includes(typeof cell) &&
          this.stringMatchFilter(padedEl, filterTokens)
          ? padedEl.replace(this.filterRegExp, (s) =>
              chalk(s, { color: searchHighlightColor })
            )
          : padedEl;
      })
      .join(columnSeparator)
      .padEnd(this.size.width - 1);
  }

  private stringMatchFilter(str: string, tokens: string[]) {
    return tokens.some((token) => str.toLowerCase().includes(token));
  }

  private getVisible() {
    const visible = this.filtered.slice(
      this.viewportPos,
      this.viewportPos + this.size.lines
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
  private viewport: { columns: number; rows: number };

  constructor(sections: { [Index in keyof Types]: TSection<Types[Index]> }) {
    this.updateViewport();
    const layoutLines = 2;

    const height = Math.floor(this.viewport.rows / layoutLines);
    this.sections = sections.map((config) => new ListSection({ height, ...config }));
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
    this.layoutRender(this.sections);
  }

  // @ToDo: refactor this ugly code
  private layoutRender(sections: Section[]) {
    const canvas: string[] = new Array(this.viewport.rows).fill('');
    const renderedSections = sections.map((section) => section.render());
    let lineNumber = 0;
    const coords = { x: 0, y: 0 };
    const lines = sections.reduce(
      (lines, section, i) => {
        lines[lineNumber] ||= { lineHeight: 0, coords: [] };
        if (coords.x + section.size.width > this.viewport.columns) {
          coords.x = 0;
          coords.y += lines[lineNumber].lineHeight;
          lines[++lineNumber] = { lineHeight: 0, coords: [] };
        }
        lines[lineNumber].coords.push({ ...coords });
        coords.x += section.size.width;
        lines[lineNumber].lineHeight = Math.max(
          lines[lineNumber].lineHeight,
          renderedSections[i].length
        );

        return lines;
      },
      [] as {
        lineHeight: number;
        coords: { x: number; y: number }[];
      }[]
    );
    let i = 0;
    lines.forEach(({ lineHeight, coords }) => {
      coords.forEach(({ y }) => {
        const rows = renderedSections[i];
        const rest = new Array(lineHeight - rows.length).fill(
          new Array(sections[i].size.width + 2).join(' ')
        );

        [...rows, ...rest].forEach((row, rowIndex) => {
          const canvasRowIndex = y + rowIndex;
          if (typeof canvas[canvasRowIndex] === 'undefined') return;
          canvas[canvasRowIndex] = canvas[canvasRowIndex] + row;
        });
        i++;
      });
    });
    console.log(canvas.join('\n'));
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

  private get activeSection() {
    return this.sections.find(({ isActive }) => isActive) || this.sections[0];
  }

  private updateViewport() {
    this.viewport = {
      columns: process.stdout.columns,
      rows: process.stdout.rows - 1,
    };
  }

  private getResult() {
    const sections = this.sections.filter(
      (section) => section instanceof ListSection
    );
    const result: unknown[][] = []; // fix this 'unknown' hack
    const isInvalid = sections.some((section) => {
      const error = { message: '' };
      const selected = section.getSelected();
      if (section.validate(selected, error)) {
        result.push(selected);
        return false;
      }
      section.setError(error.message);
      this.sections.find(({ isActive }) => isActive).isActive = false;
      section.isActive = true;
      return true;
    });
    return isInvalid ? false : result;
  }

  async handle() {
    this.clearScreen();
    this.render();
    process.stdout.on('resize', () => {
      this.updateViewport();
      this.render();
    });
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false, // We don’t need the prompt to be shown
    });
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin, rl);
    const ids = await new Promise<unknown[][]>((resolve) => {
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
          const result = this.getResult();
          if (result) resolve(result);
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
