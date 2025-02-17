import { Key } from './io';
import { Section, Size } from './section';
import {
  chalk,
  detectFields,
  highlightSearch,
  monoString,
  prepareCell,
} from './utils';

type Options<T extends object, F extends keyof T = keyof T> = {
  fields?: F[];
  columnsWidthes?: number[];
  sortBy?: { key: F; direction?: 'ASC' | 'DESC' }[];
  title?: string;
  validate?: (selectedList: T[], { message }: { message: string }) => boolean;
};

export type TSection<T extends object> = {
  data: T[];
} & Options<T>;

const searchTypes = ['string', 'number', 'object'];
const columnSeparator = ' ';
const checkbox = '✔';

export class ListSection<T extends object> extends Section {
  private entities: T[];
  private filtered: T[];
  private selected: Set<T> = new Set();
  private columnsWidthes: number[];
  private fields?: Options<T>['fields'];
  validate: Options<T>['validate'] = (_: unknown) => true;
  constructor(options: TSection<T>, private maxWidth: number) {
    super(options.title);
    this.entities = options.data;
    this.filtered = options.sortBy
      ? this.entities.sort((a, b) => {
          for (const { key, direction } of options.sortBy) {
            return a[key] < b[key] && direction === 'DESC' ? 1 : -1;
          }
          return 0;
        })
      : this.entities;
    const { columnsWidthes, fields, width } = this.detectTableLayout(options);
    this.size = { width };
    this.columnsWidthes = columnsWidthes;
    this.fields = fields;
    this.validate = options.validate || this.validate;
  }

  private detectTableLayout(config: TSection<T>) {
    const fields = config.fields || (detectFields(config.data) as never[]);
    const columnsWidthes = config.columnsWidthes || [
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
        2; // borderSizes
      if (width < this.maxWidth) {
        return { fields, columnsWidthes, width };
      }
      fields.pop();
      columnsWidthes.pop();
    }
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

  filterData() {
    this.cursorPos = 0;
    this.filtered = this.filterTokens.length
      ? this.entities.filter((e) => this.entityMatchFilter(e, this.filterTokens))
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
    const searchableValues = [];
    for (const key in entity) {
      if (searchTypes.includes(typeof entity[key]))
        searchableValues.push(JSON.stringify(entity[key]));
    }
    const str = searchableValues.join('│').toLowerCase();
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
            ? padedEl.replace(this.filterRegExp, (s) => highlightSearch(s, style))
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
