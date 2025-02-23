import { Coords, Key } from './io';
import { chalk, highlightSearch, limitString, monoString } from './utils';

const border = {
  vertical: '│',
  horisontal: '─',
  leftTop: '╭',
  rightTop: '╮',
  leftBottom: '╰',
  rightBottom: '╯',
  scroll: '▓',
};

export type Size = { height: number; width: number };

export class Section {
  #cursorPos = 0;
  #isActive = false;
  #size: Size = { height: 0, width: 0 };
  #coords: Coords = { x: 0, y: 0 };
  #originalTitle: string;
  #renderedTitle = '';
  #filter = '';
  #viewportPos = 0;
  private error = '';
  private extraRowsCount: number;
  protected contentSize = 0;
  protected viewportSize = 0;
  protected filterMode = false;
  protected filterTokens: string[] = [];
  protected filterRegExp?: RegExp;

  keyActions: Record<string, () => unknown> = {};
  navigation = {
    up: () => this.cursorPos--,
    down: () => this.cursorPos++,
    pageup: () => (this.cursorPos -= this.viewportSize),
    pagedown: () => (this.cursorPos += this.viewportSize),
    left: () => (this.cursorPos -= this.contentSize),
    right: () => (this.cursorPos += this.contentSize),
  };

  shift = {
    cursor: (val: number) => {
      const bottomLimit = this.contentSize - 1;
      this.#cursorPos = Math.max(0, Math.min(val, bottomLimit));
      if (this.#cursorPos < this.#viewportPos) {
        this.#viewportPos = this.#cursorPos;
      } else if (this.#cursorPos >= this.#viewportPos + this.viewportSize) {
        this.#viewportPos =
          this.#cursorPos - Math.min(this.viewportSize, this.contentSize) + 1;
      } else if (this.contentSize - this.#viewportPos < this.viewportSize) {
        this.#viewportPos = Math.max(this.contentSize - this.viewportSize, 0);
      }
    },
    viewport: (val: number) => {
      const bottomLimit = this.contentSize - this.viewportSize;
      this.#cursorPos = Math.max(0, Math.min(val, bottomLimit));
      this.#viewportPos = this.#cursorPos;
    },
  };

  constructor(
    originalTitle = '',
    private navigationMode: keyof typeof this.shift = 'cursor'
  ) {
    this.#originalTitle = originalTitle;
    this.extraRowsCount = this.countExtraRows();
  }

  get viewportPos() {
    return this.#viewportPos;
  }

  get filter() {
    return this.#filter;
  }

  set filter(filter: string) {
    this.#filter = filter;
    this.filterTokens =
      filter
        .match(/"([^"]+)"|\S+/g)
        ?.map((token) => token.replace(/(^"|"$)/g, '')) || [];
    if (this.filterTokens.length)
      this.filterRegExp = new RegExp(this.filterTokens.join('|'), 'gi');
  }

  get coords(): Coords {
    return this.#coords;
  }

  set coords({ x, y }: Partial<Coords>) {
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
    this.shift[this.navigationMode](val);
  }

  get size(): Size {
    return this.#size;
  }

  set size({ height, width }: Partial<Size>) {
    this.#size.height = height ?? this.#size.height;
    this.#size.width = width ?? this.#size.width;
    this.title = this.#originalTitle;
    this.viewportSize = this.#size.height - this.extraRowsCount;
  }

  innerSize() {
    const borders = 2;
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

  private countExtraRows() {
    return [
      border.horisontal,
      this.renderHeader(),
      this.renderFooter(),
      border.horisontal,
    ].filter(Boolean).length;
  }

  protected renderHeader() {}

  protected renderFooter() {}

  protected renderData(): string[] {
    return [];
  }

  render() {
    try {
      const rows = this.renderData();
      const emptyRow = monoString(' ', this.innerSize().width);
      const emptyCount = this.viewportSize - rows.length;
      const emptyRows = emptyCount > 0 ? new Array(emptyCount).fill(emptyRow) : [];
      return this.wrap(
        [this.renderHeader(), ...rows, ...emptyRows, this.renderFooter()].filter(
          Boolean
        ) as string[],
        this.contentSize
      );
    } catch (e) {
      return [
        (e as Error).message,
        ...((e as Error)?.stack?.split('\n') as string[]),
      ];
    }
  }

  close() {
    this.isActive = false;
  }

  handleTyping(key: Key) {
    if (!this.filterMode) return;
    if (key.name === 'backspace') {
      this.filter = key.ctrl ? '' : this.filter.slice(0, -1) || '';
    } else {
      this.filter += key.sequence.toLowerCase();
    }
    this.filterData();
  }

  filterData() {}

  private borderHorisontal(len: number, text?: string) {
    if (!text) {
      return monoString(border.horisontal, len);
    }
    const textLen = text.replace(/\x1b\[[0-9;]*m/g, '').length;
    const chunkLen = Math.floor((len - textLen) / 2);
    const borderChunk = monoString(border.horisontal, chunkLen);
    let borderLine = `${borderChunk}${text}${borderChunk}`;
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
      ? highlightSearch(text, { bgColor: 'white' })
      : text;
  }

  private wrap(rows: string[], totalRowsNum?: number) {
    totalRowsNum ||= rows.length;
    const highlight = { style: 'bold', color: 'blue' } as const;
    const scrollSize = Math.ceil((rows.length * rows.length) / totalRowsNum);
    const scrollStart = Math.floor((this.#viewportPos / totalRowsNum) * rows.length);
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
