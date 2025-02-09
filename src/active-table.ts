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

type Layout = {
  lineHeight: number;
  coords: { x: number; y: number }[];
}[];

type Options<T extends object, F extends keyof T = keyof T> = {
  fields?: F[];
  title?: string;
  validate?: (selectedList: T[], { message }: { message: string }) => boolean;
};

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

function prepareCell(cell: unknown, compact = true) {
  if (cell instanceof Date) {
    return cell.toISOString();
  }
  const cellType = typeof cell;
  if (cell && cellType === 'object') {
    return compact ? cellType : JSON.stringify(cell, null, 2);
  }
  return `${cell}`;
}

// @ToDo: define if there object different shape and throw error
function detectFields(list: unknown[]) {
  return list?.length ? Object.keys(list[0]) : ['provided data list is empty'];
}

const logged: Record<string, unknown> = {};
const log = (data: unknown) => (logged[Date.now()] = JSON.stringify(data));

class Section {
  #cursorPos = 0;
  #isActive = false;
  #size: { height?: number; width?: number } = { width: 30 };
  private error = '';
  private title: string;
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

  constructor(
    private originalTitle: string,
    size: { height?: number; width?: number } = {}
  ) {
    this.size = size;
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
  }

  get size() {
    return this.#size;
  }

  set size({ height, width }: { height?: number; width?: number }) {
    this.#size.height = height || this.#size.height;
    this.#size.width = width || this.#size.width;
    this.title = this.limitString(this.#size.width, this.originalTitle);
    this.viewportSize = this.#size.height - this.getExtraRowsCount();
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
    if (!this.size.height || !this.size.width) {
      return this.wrap(['Size not set']);
    }
    try {
      const rows = this.renderData();
      const emptyRow = new Array(this.size.width).join(' ');
      const emptyRows = new Array(this.viewportSize - rows.length).fill(emptyRow);
      return this.wrap(
        [this.renderHeader(), ...rows, ...emptyRows, this.renderFooter()].filter(
          Boolean
        ) as string[],
        this.contentSize
      );
    } catch (e) {
      return [e.message, ...e.stack.split('\n')];
    }
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

  private wrap(rows: string[], totalRowsNum?: number) {
    totalRowsNum ||= rows.length;
    const highlight = { style: 'bold' } as const;
    const scrollSize = Math.ceil((rows.length * rows.length) / totalRowsNum);
    const scrollStart = Math.floor((this.viewportPos / totalRowsNum) * rows.length);
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

// class PreviewSection<T extends object> extends Section {
//   data: T = {} as T;
//   prerendered: string[];

//   setData(object: T) {
//     if (this.data === object) return;
//     this.cursorPos = 0;
//     this.data = object;
//     this.prerenderData();
//   }

//   protected prerenderData() {
//     const keyColumnWidth = Math.max(
//       ...Object.keys(this.data).map(({ length }) => length)
//     );
//     const valueColumnWidth = this.size.width - keyColumnWidth - 2;
//     this.prerendered = Object.entries(this.data).reduce((acc, entry) => {
//       acc.push(...this.renderRow(entry, [keyColumnWidth, valueColumnWidth]));
//       return acc;
//     }, []);
//     this.contentSize = this.prerendered.length;
//   }

//   private renderRow([key, val]: string[], [keyWidth, valWidth]: number[]) {
//     return prepareCell(val, false)
//       .split('\n')
//       .map((row, j) =>
//         Array.from(
//           { length: Math.ceil(row.length / valWidth) },
//           (_, i) =>
//             `${(j === 0 && i === 0 ? key : '').padEnd(keyWidth)} ${row
//               .slice(i * valWidth, (i + 1) * valWidth)
//               .padEnd(valWidth)}`
//         )
//       )
//       .flat();
//   }

//   protected renderData() {
//     return this.prerendered.slice(
//       this.viewportPos,
//       this.viewportPos + this.viewportSize
//     );
//   }
// }

class ListSection<T extends object> extends Section {
  private entities: T[];
  private filtered: T[];
  private selected: Set<T> = new Set();
  private columnsWidthes: number[];
  private fields?: Options<T>['fields'];
  private filterRegExp?: RegExp;
  validate: Options<T>['validate'] = (_: unknown) => true;
  constructor({ data, ...options }: TSection<T>, height: number) {
    const fields = options.fields || (detectFields(data) as Options<T>['fields']);
    const columnsWidthes = [
      1,
      ...fields.map((field) =>
        Math.max(
          ...data.map((entity) => prepareCell(entity[field]).length),
          (field as string).length
        )
      ),
    ];
    super(options.title, {
      width: columnsWidthes.reduce((a, b) => a + b + columnSeparator.length, 0),
      height,
    });
    this.entities = data;
    this.filtered = this.entities;
    this.columnsWidthes = columnsWidthes;
    this.fields ||= fields;
    this.validate = options.validate || this.validate;
  }

  getSelected() {
    return [...this.selected];
  }

  keyActions = {
    a: () => {
      if (this.selected.size === this.filtered.length) {
        this.selected.clear();
      } else {
        this.filtered.forEach((entity) => this.selected.add(entity));
      }
    },
    d: () => this.deleteRows(),
    delete: () => this.deleteRows(),
    f: () => (this.filterMode = true),
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
      ? chalk(this.renderRow(['', ...(this.fields as string[])]), {
          style: 'inverted',
        })
      : ' '; // we need this to calculate proper viewport
  }

  protected renderFooter() {
    if (!this.selected) return ' '; // we need this to calculate proper viewport
    const position = `${this.cursorPos + 1}/${this.filtered.length}`;
    const selected = `Selected: ${this.selected.size}/${this.entities.length}`;
    const gapSize = Math.max(0, this.size.width - position.length - selected.length);
    const footer = `${selected}${new Array(gapSize).join(' ')}${position}`;
    return chalk(footer, { bgColor: 'grey', color: 'black' });
  }

  toggleActiveRow() {
    const row = this.filtered[this.cursorPos];
    this.selected.has(row) ? this.selected.delete(row) : this.selected.add(row);
  }

  getActiveRow() {
    return this.filtered[this.cursorPos];
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
  // private previewSection: PreviewSection<{}>;
  private layout: Layout;

  constructor(sections: { [Index in keyof Types]: TSection<Types[Index]> }) {
    this.updateViewport();
    const layoutLines = Math.ceil(sections.length / 2);
    const height = Math.floor(this.viewport.rows / layoutLines);
    this.sections = sections.map((config) => new ListSection(config, height));
    // this.previewSection = new PreviewSection('preview');
    // this.sections.push(this.previewSection);
    this.defineLayout(this.sections);
    // this.previewSection.setData(
    //   (this.sections[0] as ListSection<any>).getActiveRow()
    // );
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

  private defineLayout(sections: Section[]) {
    let lineNumber = 0;
    const coords = { x: 0, y: 0 };
    this.layout = sections.reduce<Layout>((layout, section, i) => {
      if (!(section instanceof ListSection)) return layout;
      layout[lineNumber] ||= { lineHeight: 0, coords: [] };
      if (coords.x + section.size.width + 3 > this.viewport.columns) {
        coords.x = 0;
        coords.y += layout[lineNumber].lineHeight;
        layout[++lineNumber] = { lineHeight: 0, coords: [] };
      }
      layout[lineNumber].coords.push({ ...coords });
      coords.x += section.size.width;
      layout[lineNumber].lineHeight = Math.max(
        layout[lineNumber].lineHeight,
        sections[i].size.height
      );
      return layout;
    }, []);
    // const previewMinWidth = 50;
    // if (this.viewport.columns - coords.x < previewMinWidth) {
    //   this.layout[++lineNumber] = { lineHeight: 0, coords: [] };
    // }
    // this.previewSection.size = {
    //   width: this.viewport.columns - coords.x - 3,
    //   height: this.layout[lineNumber].lineHeight,
    // };
    // this.layout[lineNumber].coords.push(coords);
  }

  private layoutRender(sections: Section[]) {
    const canvas: string[] = new Array(this.viewport.rows).fill('');

    let i = 0;
    this.layout.forEach(({ lineHeight, coords }) => {
      coords.forEach(({ y }) => {
        const rows = sections[i].render();
        // if (lineHeight - rows.length) {
        //   rows.push(
        //     ...new Array(lineHeight - rows.length).fill(
        //       new Array(sections[i].size.width + 2).join(' ')
        //     )
        //   );
        // }

        [...rows].forEach((row, rowIndex) => {
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
      this.defineLayout(this.sections);
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
        if (key.name === 'tab') {
          this.rotateSections(key.shift);
          // if (this.activeSection instanceof ListSection) {
          //   this.previewSection.setData(this.activeSection.getActiveRow());
          // }
        } else if (key.name in this.activeSection.navigation) {
          this.activeSection.navigation[
            key.name as keyof typeof this.activeSection.navigation
          ]();
          // if (this.activeSection instanceof ListSection) {
          //   this.previewSection.setData(this.activeSection.getActiveRow());
          // }
        } else if (
          (key.ctrl && key.name in this.activeSection.keyActions) ||
          key.name === 'delete'
        ) {
          this.activeSection.keyActions[
            key.name as keyof typeof this.activeSection.keyActions
          ]();
        } else if (key.ctrl && key.name in this.keyActions) {
          this.keyActions[key.name as keyof typeof this.keyActions]();
        } else if (key.name === 'escape') {
          const result = this.getResult();
          if (result) resolve(result);
        } else {
          this.activeSection.handleTyping(key);
        }
        this.render();
      });
    });

    this.clearScreen();
    return ids;
  }
}
