import * as readline from 'node:readline';
import { chalk, detectFields, limitString, monoString, prepareCell } from './utils';

const searchHighlightColor = 'magenta';
const searchTypes = ['string', 'number'];
const columnSeparator = ' ';
const checkbox = '✔';
const border = {
  vertical: '│',
  horisontal: '─',
  leftTop: '╭',
  rightTop: '╮',
  leftBottom: '╰',
  rightBottom: '╯',
  scroll: '▓',
};

type Key = {
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
};

type Size = { height?: number; width?: number };

type Options<T extends object, F extends keyof T = keyof T> = {
  fields?: F[];
  columnsWidthes?: number[];
  sortBy?: { key: F; direction?: 'ASC' | 'DESC' }[];
  title?: string;
  validate?: (selectedList: T[], { message }: { message: string }) => boolean;
};

type TSection<T extends object> = {
  data: T[];
} & Options<T>;

class Section {
  #cursorPos = 0;
  #isActive = false;
  #size: Size = {};
  #coords = { x: 0, y: 0 };
  #originalTitle: string;
  #renderedTitle: string;
  private error = '';
  private extraRowsCount: number;
  protected contentSize: number;
  protected viewportSize: number;
  protected viewportPos = 0;
  protected filterMode = false;
  protected filter = '';
  protected filterTokens: string[] = [];

  keyActions: Record<string, () => unknown> = {};
  navigation = {
    up: () => this.cursorPos--,
    down: () => this.cursorPos++,
    pageup: () => (this.cursorPos -= this.viewportSize),
    pagedown: () => (this.cursorPos += this.viewportSize),
    left: () => (this.cursorPos -= this.contentSize),
    right: () => (this.cursorPos += this.contentSize),
  };

  constructor(originalTitle = '', size: Size = {}) {
    this.#originalTitle = originalTitle;
    this.size = size;
  }

  get coords() {
    return this.#coords;
  }

  set coords({ x, y }: { x?: number; y?: number }) {
    this.#coords.x = x ?? this.#coords.x;
    this.#coords.y = y ?? this.#coords.y;
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
    if (this.#cursorPos === val) return;
    this.error = '';
    if (val) this.filterMode = false; // if cursorPos > 0, means we were navigating, and we want to turn off filter mode
    this.#cursorPos = Math.max(0, Math.min(val, this.contentSize - 1));
    if (this.#cursorPos < this.viewportPos) {
      this.viewportPos = this.#cursorPos;
    } else if (this.#cursorPos >= this.viewportPos + this.viewportSize) {
      this.viewportPos =
        this.#cursorPos - Math.min(this.viewportSize, this.contentSize) + 1;
    } else if (this.contentSize - this.viewportPos < this.viewportSize) {
      this.viewportPos = Math.max(this.contentSize - this.viewportSize, 0);
    }
    // debugSection.setData({ viewportPos: this.viewportPos });
  }

  get size() {
    return this.#size;
  }

  set size({ height, width }: Size) {
    this.#size.height = height ?? this.#size.height;
    this.#size.width = width ?? this.#size.width;
    this.title = this.#originalTitle;
    this.viewportSize = this.#size.height - this.getExtraRowsCount();
  }

  innerSize() {
    const borders = border.vertical.length * 2;
    return {
      height: this.#size.height - borders,
      width: this.#size.width - borders,
    };
  }

  get title() {
    return this.#originalTitle;
  }

  set title(title: string) {
    this.#originalTitle = title;
    this.#renderedTitle = limitString(this.#size.width, this.#originalTitle);
  }

  setError(message: string) {
    this.error = message;
  }

  private getExtraRowsCount() {
    this.extraRowsCount ||= [
      border.horisontal,
      this.renderHeader(),
      this.renderFooter(),
      border.horisontal,
    ].filter(Boolean).length;

    return this.extraRowsCount;
  }

  protected renderHeader() {
    return;
  }

  protected renderFooter() {
    return;
  }

  protected renderData() {
    return [] as string[];
  }

  render() {
    let data: string[] = [];
    try {
      const rows = this.renderData();
      const emptyRow = monoString(' ', this.innerSize().width);
      const enptyCount = this.viewportSize - rows.length;
      const emptyRows = enptyCount > 0 ? new Array(enptyCount).fill(emptyRow) : [];
      data = this.wrap(
        [this.renderHeader(), ...rows, ...emptyRows, this.renderFooter()].filter(
          Boolean
        ) as string[],
        this.contentSize
      );
    } catch (e) {
      data = [e.message, ...e.stack.split('\n')] as string[];
    }
    const { x, y } = this.coords;
    data.forEach((row, i) => {
      readline.cursorTo(process.stdout, x, y + i);
      process.stdout.write(row);
    });
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

  private borderHorisontal(len: number, text?: string) {
    if (!text) {
      return monoString(border.horisontal, len);
    }
    const extraLen = 2; // spaces
    const textLen = text.replace(/\x1b\[[0-9;]*m/g, '').length + extraLen;
    const chunkLen = Math.floor((len - textLen) / 2);
    const borderChunk = monoString(border.horisontal, chunkLen);
    let borderLine = `${borderChunk} ${text} ${borderChunk}`;
    borderLine += len > borderChunk.length * 2 + textLen ? border.horisontal : '';
    return borderLine;
  }

  private renderFilter(title = '🔎') {
    const extraLen = 2; // spaces
    const text = `${title}${limitString(
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

  private wrap(rows: string[], totalRowsNum?: number) {
    totalRowsNum ||= rows.length;
    const highlight = { style: 'bold', color: 'blue' } as const;
    const scrollSize = Math.ceil((rows.length * rows.length) / totalRowsNum);
    const scrollStart = Math.floor((this.viewportPos / totalRowsNum) * rows.length);
    const scrollEnd = scrollStart + scrollSize;
    const { leftTop, rightTop, vertical, leftBottom, rightBottom, scroll } = border;
    const verticalBorder = this.#isActive ? chalk(vertical, highlight) : vertical;
    const scrollBorder = this.#isActive ? chalk(scroll, highlight) : scroll;
    const len = this.innerSize().width;

    const title = this.error
      ? chalk(this.error, { bgColor: 'yellow', color: 'black' })
      : this.#renderedTitle;
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
            i >= scrollStart && i < scrollEnd ? scrollBorder : verticalBorder
          }`
      ),
      `${this.#isActive ? chalk(bottom, highlight) : bottom}`,
    ];
  }
}

class PopupSection<T extends object> extends Section {
  data: T = {} as T;
  prerendered: string[] = [];

  setData(object: T, title?: string) {
    this.cursorPos = 0;
    this.data = object;
    if (title) this.title = title;
    this.prerenderData();
  }

  protected prerenderData() {
    const keyColumnWidth = Math.max(
      ...Object.keys(this.data).map(({ length }) => length)
    );
    const valueColumnWidth = this.innerSize().width - keyColumnWidth - 1;
    this.prerendered = Object.entries(this.data).reduce((acc, entry) => {
      acc.push(...this.renderRow(entry, [keyColumnWidth, valueColumnWidth]));
      return acc;
    }, []);
    this.contentSize = this.prerendered.length;
  }

  private renderRow([key, val]: string[], [keyWidth, valWidth]: number[]) {
    return prepareCell(val, false)
      .split('\n')
      .map((row, j) =>
        Array.from(
          { length: Math.ceil(row.length / valWidth) },
          (_, i) =>
            `${(j === 0 && i === 0 ? key : '').padEnd(keyWidth)} ${row
              .slice(i * valWidth, (i + 1) * valWidth)
              .padEnd(valWidth)}`
        )
      )
      .flat();
  }

  protected renderData() {
    return this.prerendered.slice(
      this.viewportPos,
      this.viewportPos + this.viewportSize
    );
  }
}

class ListSection<T extends object> extends Section {
  private entities: T[];
  private filtered: T[];
  private selected: Set<T> = new Set();
  private columnsWidthes: number[];
  private fields?: Options<T>['fields'];
  private filterRegExp?: RegExp;
  validate: Options<T>['validate'] = (_: unknown) => true;
  constructor({ data, ...options }: TSection<T> & Size) {
    super(options.title, options);
    this.entities = data;
    this.filtered = options.sortBy
      ? this.entities.sort((a, b) => {
          for (const { key, direction } of options.sortBy) {
            return a[key] < b[key] && direction === 'DESC' ? 1 : -1;
          }
          return 0;
        })
      : this.entities;
    this.columnsWidthes = options.columnsWidthes;
    this.fields = options.fields;
    this.validate = options.validate || this.validate;
  }

  getSelected() {
    return [...this.selected];
  }

  keyActions = {
    'ctrl-a': () => {
      if (this.selected.size === this.filtered.length) {
        this.selected.clear();
      } else {
        this.filtered.forEach((entity) => this.selected.add(entity));
      }
    },
    'ctrl-d': () => this.deleteRows(),
    delete: () => this.deleteRows(),
    'ctrl-f': () => (this.filterMode = true),
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

  protected renderData() {
    return this.getVisible().map(({ entity, isSelected, isCursor }, i) =>
      this.renderRow(
        [
          isSelected ? chalk(checkbox, { color: 'green' }) : ' ',
          ...this.fields.map((f) => entity[f]),
        ],
        isCursor
          ? { bgColor: 'blue', color: 'black' }
          : i % 2
          ? { bgColor: 'dark' }
          : {},
        this.filterTokens
      )
    );
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
      this.entities = this.entities.filter((entity) => !this.selected.has(entity));
      this.filtered = this.filtered.filter((entity) => !this.selected.has(entity));
      this.selected.clear();
    } else {
      const [deleted] = this.filtered.splice(this.cursorPos, 1);
      this.entities = this.entities.filter((entity) => deleted !== entity);
    }
    this.contentSize = this.filtered.length;
    this.cursorPos = this.cursorPos; // to adjust viewport position
  }

  protected renderHeader() {
    return this.fields
      ? this.renderRow(['', ...(this.fields as string[])], { style: 'inverted' })
      : ' '; // we need this to calculate proper viewport
  }

  protected renderFooter() {
    if (!this.selected) return ' '; // we need this to calculate proper viewport
    const width = this.innerSize().width;
    const position = `${this.cursorPos + 1}/${this.filtered.length}`;
    const selected = `Selected: ${this.selected.size}/${this.entities.length}`;
    const gapSize = Math.max(0, width - position.length - selected.length);
    monoString(' ', gapSize);
    const footer = `${selected}${monoString(' ', gapSize)}${position}`;
    return chalk(footer, { bgColor: 'grey', color: 'black' });
  }

  toggleActiveRow() {
    const row = this.filtered[this.cursorPos];
    this.selected.has(row) ? this.selected.delete(row) : this.selected.add(row);
  }

  getActiveRow() {
    return this.filtered[this.cursorPos];
  }

  private renderRow(
    cells: (string | T[keyof T])[],
    style: Parameters<typeof chalk>[1] = {},
    filterTokens?: string[]
  ) {
    return chalk(
      cells
        .map((cell, i) => {
          const padedEl = prepareCell(cell).padEnd(this.columnsWidthes[i]);
          return this.filterRegExp &&
            filterTokens &&
            searchTypes.includes(typeof cell) &&
            this.stringMatchFilter(padedEl, filterTokens)
            ? padedEl.replace(this.filterRegExp, (s) =>
                chalk(s, { ...style, color: searchHighlightColor })
              )
            : padedEl;
        })
        .join(columnSeparator)
        .padEnd(this.innerSize().width),
      style
    );
  }

  private stringMatchFilter(str: string, tokens: string[]) {
    return tokens.some((token) => str.toLowerCase().includes(token));
  }

  private getVisible() {
    this.contentSize = this.filtered.length;
    const visible = this.filtered.slice(
      this.viewportPos,
      this.viewportPos + this.viewportSize
    );
    return visible.map((entity, i) => ({
      entity,
      isSelected: this.selected.has(entity),
      isCursor: this.cursorPos - this.viewportPos === i,
    }));
  }
}

export class ActiveTable<Types extends object[]> {
  private sections: Section[] = [];
  private viewport: { columns: number; rows: number };
  private previewSection: PopupSection<{}>;
  private returnData: { [Index in keyof Types]: Types[Index][] };

  constructor(sections: { [Index in keyof Types]: TSection<Types[Index]> }) {
    this.updateViewport();
    this.sections = sections.map(
      (config) => new ListSection({ ...config, ...this.detectTableLayout(config) })
    );
    this.sections[0].isActive = true;
    this.previewSection = new PopupSection();
    this.previewSection.size = { width: 50 };
  }

  private detectTableLayout(config: TSection<object>) {
    const fields = config.fields || (detectFields(config.data) as never[]);
    const columnsWidthes = [
      checkbox.length,
      ...fields.map((field) =>
        Math.max(
          ...config.data.map((entity) => prepareCell(entity[field]).length),
          (field as string).length
        )
      ),
    ];
    const separatorLen = columnSeparator.length;
    while (true) {
      const width =
        columnsWidthes.reduce((a, b) => a + b, 0) +
        separatorLen * (columnsWidthes.length - 1) +
        border.vertical.length * 2;
      if (width < this.viewport.columns) {
        return { fields, columnsWidthes, width };
      }
      fields.pop();
      columnsWidthes.pop();
    }
  }

  private keyActions = {
    'ctrl-c': () => this.getResult(),
    tab: () => this.rotateSections(),
    'shift-tab': () => this.rotateSections(true),
    escape: () =>
      this.activeSection instanceof PopupSection
        ? this.openPreview()
        : this.getResult(),
    return: () => this.openPreview(),
  };

  private clear() {
    process.stdout.write('\u001b[H\u001b[J');
  }

  private hideCursor() {
    process.stdout.write('\u001b[?25l');
  }

  private returnCursor() {
    process.stdout.write('\u001b[?25h');
  }

  private renderAll() {
    this.clear();
    this.sections.forEach(
      (section) => section instanceof ListSection && section.render()
    );
  }

  private defineLayout(sections: Section[]) {
    sections.forEach((section, i) => {
      if (i === 0) return;
      const previousSection = sections[i - 1];
      section.coords = {
        x: previousSection.coords.x + previousSection.size.width,
        y: previousSection.coords.y,
      };
      if (section.coords.x + section.size.width + 3 > this.viewport.columns) {
        section.coords = {
          x: 0,
          y: previousSection.coords.y + 1,
        };
      }
    });
    const padding = 5;
    this.previewSection.size = {
      width: this.viewport.columns - padding * 2,
      height: this.viewport.rows - padding * 2,
    };
    this.previewSection.coords = { x: padding, y: padding };

    const lines = sections[sections.length - 1].coords.y + 1;
    const height = Math.floor(this.viewport.rows / lines);
    sections.forEach((section) => {
      section.size = { height };
      section.coords = { y: section.coords.y * height };
    });
  }

  private rotateSections(backward = false) {
    const current = Math.max(
      0,
      this.sections.findIndex(({ isActive }) => isActive)
    );
    this.sections[current].isActive = false;
    const delta = backward ? -1 : 1;
    const next =
      this.sections[current + delta] ||
      this.sections[backward ? this.sections.length - 1 : 0];
    next.isActive = true;
    next.render();
  }

  private get activeSection() {
    return this.previewSection.isActive
      ? this.previewSection
      : this.sections.find(({ isActive }) => isActive) || this.sections[0];
  }

  private updateViewport() {
    this.viewport = {
      columns: process.stdout.columns,
      rows: process.stdout.rows,
    };
  }

  private openPreview() {
    if (!(this.activeSection instanceof ListSection)) {
      this.previewSection.isActive = false;
      this.sections.filter((section) => section !== this.previewSection);
      return this.renderAll();
    }
    const object = this.activeSection.getActiveRow();
    const title = `preview (${this.activeSection.title} > ${
      this.activeSection.cursorPos + 1
    })`;
    this.previewSection.isActive = true;
    this.previewSection.setData(object, title);
  }

  private getResult() {
    const result = [] as { [Index in keyof Types]: Types[Index][] };
    const isInvalid = this.sections
      .filter((section) => section instanceof ListSection)
      .some((section) => {
        const error = { message: '' };
        const selected = section.getSelected();
        if (section.validate(selected, error)) {
          result.push(selected);
          return false;
        }
        section.setError(error.message);
        if (!section.isActive) {
          const previousActive = this.activeSection;
          section.isActive = true;
          previousActive.isActive = false;
        }
        section.render();
        return true;
      });
    if (!isInvalid) this.returnData = result;
  }

  private initScreen() {
    this.updateViewport();
    this.defineLayout(this.sections);
    this.renderAll();
  }

  private getHotKeyCode(key: Key) {
    return [key.ctrl && 'ctrl', key.shift && 'shift', key.name]
      .filter(Boolean)
      .join('-');
  }

  async handle() {
    this.hideCursor();
    this.initScreen();
    process.stdout.on('resize', () => this.initScreen());
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false, // We don’t need the prompt to be shown
    });
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    readline.emitKeypressEvents(process.stdin, rl);
    const ids = await new Promise<{ [Index in keyof Types]: Types[Index][] }>(
      (resolve) => {
        process.stdin.on('keypress', (_: string, key: Key) => {
          const hotkey = this.getHotKeyCode(key);
          if (hotkey in this.activeSection.navigation) {
            this.activeSection.navigation[
              hotkey as keyof typeof this.activeSection.navigation
            ]();
          } else if (hotkey in this.activeSection.keyActions) {
            this.activeSection.keyActions[
              hotkey as keyof typeof this.activeSection.keyActions
            ]();
          } else if (hotkey in this.keyActions) {
            this.keyActions[hotkey as keyof typeof this.keyActions]();
          } else {
            this.activeSection.handleTyping(key);
          }
          if (this.returnData) {
            resolve(this.returnData);
          }
          this.activeSection.render();
          // debugSection.render();
        });
      }
    );

    this.clear();
    this.returnCursor();
    return ids;
  }
}

// const debugSection = new PopupSection('debug', { height: 20, width: 20 });
// debugSection.coords = { x: 0, y: 0 };
