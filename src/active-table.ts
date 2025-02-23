import { isKey } from './utils';
import { Coords, Key, Mouse, UserIO } from './io';
import { Section } from './section';
import { ListSection, TSection } from './list-section';
import { PopupSection } from './popup-section';

export class ActiveTable<Types extends object[]> {
  private io: UserIO;
  private sections: Section[] = [];
  private previewSection: PopupSection<{}>;
  private returnData?: { [Index in keyof Types]: Types[Index][] };

  constructor(sections: { [Index in keyof Types]: TSection<Types[Index]> }) {
    this.io = new UserIO(process.stdin, process.stdout);
    const maxWidth = this.io.viewport.columns;
    this.sections = sections.map((config) => new ListSection(config, maxWidth));
    this.sections[0].isActive = true;
    this.previewSection = new PopupSection();
    this.previewSection.size = { width: 50 };
  }

  private keyActions: Record<string, () => unknown> = {
    'ctrl-c': () => this.getResult(),
    tab: () => this.rotateSections(),
    'shift-tab': () => this.rotateSections(true),
    escape: () =>
      this.activeSection instanceof PopupSection
        ? this.togglePreview()
        : this.getResult(),
    return: () => this.togglePreview(),
  };

  private renderAll() {
    this.io.clear();
    this.sections.forEach((section) => this.printSection(section));
    if (this.previewSection.isActive) {
      this.printSection(this.previewSection);
    }
  }

  private defineLayout(sections: Section[]) {
    sections.forEach((section, i) => {
      if (i === 0) return;
      const previousSection = sections[i - 1];
      section.coords = {
        x: previousSection.coords.x + previousSection.size.width,
        y: previousSection.coords.y,
      };
      if (section.coords.x + section.size.width + 3 > this.io.viewport.columns) {
        section.coords = {
          x: 0,
          y: previousSection.coords.y + 1,
        };
      }
    });
    const padding = 5;
    this.previewSection.size = {
      width: this.io.viewport.columns - padding * 2,
      height: this.io.viewport.rows - padding * 2,
    };
    this.previewSection.coords = { x: padding, y: padding };

    const lines = sections[sections.length - 1].coords.y + 1;
    const height = Math.floor(this.io.viewport.rows / lines);
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
    this.printSection(this.sections[current]);
  }

  private get activeSection() {
    return this.previewSection.isActive
      ? this.previewSection
      : this.sections.find(({ isActive }) => isActive) || this.sections[0];
  }

  private togglePreview() {
    const activeSection = this.activeSection;
    if (!(activeSection instanceof ListSection)) {
      this.previewSection.close();
      return this.renderAll();
    }
    const object = activeSection.getActiveRow();
    const title = `preview (${activeSection.title} > ${
      activeSection.cursorPos + 1
    })`;
    this.previewSection.setData(object, activeSection.filter);
    this.previewSection.isActive = true;
    this.previewSection.title = title;
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
          previousActive.isActive = false;
          section.isActive = true;
          this.printSection(previousActive);
        }
        return true;
      });
    if (!isInvalid) this.returnData = result;
  }

  private findSectionByCoords({ x: fx, y: fy }: Coords) {
    return this.previewSection.isActive
      ? this.previewSection
      : this.sections.find(
          ({ coords: { x, y }, size: { width, height } }) =>
            x < fx && x + width >= fx && y < fy && y + height >= fy
        );
  }

  private printSection(section: Section) {
    this.io.print(section.render(), section.coords);
  }

  private init() {
    this.defineLayout(this.sections);
    this.renderAll();
  }

  private getHotKeyCode(key: Key) {
    return [key.ctrl && 'ctrl', key.shift && 'shift', key.name]
      .filter(Boolean)
      .join('-');
  }

  async handle() {
    this.io.prepare();
    this.io.on('resize', () => this.init());
    this.io.on('mouse', ({ state, type, ...coords }: Mouse) => {
      const section = this.findSectionByCoords(coords);
      if (!section) return;
      if (type === 'scroll-up') section.cursorPos--;
      if (type === 'scroll-down') section.cursorPos++;
      if (type === 'click' && state === 'press' && section instanceof ListSection) {
        section.cursorPos = coords.y - 3 + section.viewportPos;
        const prevActive = this.activeSection;
        prevActive.isActive = false;
        this.printSection(prevActive);
        section.isActive = true;
      }
      if (type === 'doubleclick' && section instanceof ListSection) {
        this.togglePreview();
      }
      this.printSection(section);
      if (type === 'rightclick' && section instanceof PopupSection) {
        this.togglePreview();
      }
    });
    this.init();
    const ids = await new Promise<{ [Index in keyof Types]: Types[Index][] }>(
      (resolve) => {
        this.io.on('key', (key: Key) => {
          const hotkey = this.getHotKeyCode(key);
          if (isKey(hotkey, this.activeSection.navigation)) {
            this.activeSection.navigation[hotkey]();
          } else if (isKey(hotkey, this.activeSection.keyActions)) {
            this.activeSection.keyActions[hotkey]();
          } else if (isKey(hotkey, this.keyActions)) {
            this.keyActions[hotkey]();
          } else {
            this.activeSection.handleTyping(key);
          }
          if (this.returnData) {
            resolve(this.returnData);
          }
          this.printSection(this.activeSection);
        });
      }
    );

    this.io.clear();
    this.io.returnDefault();
    return ids;
  }
}
