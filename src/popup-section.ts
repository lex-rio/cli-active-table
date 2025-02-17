import { Section } from './section';
import { highlightSearch, prepareCell } from './utils';

export class PopupSection<T extends object> extends Section {
  data: T = {} as T;
  content: string[] = [];

  constructor() {
    super('', 'viewport');
  }

  setData(object: T, filter = '') {
    this.cursorPos = 0;
    this.data = object;
    this.filter = filter;
    this.prerenderData();
  }

  protected prerenderData() {
    const keyColumnWidth = Math.max(
      ...Object.keys(this.data).map(({ length }) => length)
    );
    const valueColumnWidth = this.innerSize().width - keyColumnWidth - 1;
    this.content = Object.entries(this.data)
      .map((entry) => this.renderRow(entry, [keyColumnWidth, valueColumnWidth]))
      .flat();
    this.contentSize = this.content.length;
  }

  private renderRow([key, val]: string[], [keyWidth, valWidth]: number[]) {
    return prepareCell(val, false)
      .split('\n')
      .map((row, j) =>
        Array.from({ length: Math.ceil(row.length / valWidth) }, (_, i) => {
          const keyColumn = `${(j === 0 && i === 0 ? key : '').padEnd(keyWidth)}`;
          const valColumn = `${row
            .slice(i * valWidth, (i + 1) * valWidth)
            .padEnd(valWidth)}`;
          return `${keyColumn} ${valColumn.replace(this.filterRegExp, (s) =>
            highlightSearch(s)
          )}`;
        })
      )
      .flat();
  }

  protected renderData() {
    return this.content.slice(
      this.viewportPos,
      this.viewportPos + this.viewportSize
    );
  }

  close() {
    this.content = [];
    super.close();
  }
}
