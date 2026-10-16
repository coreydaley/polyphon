// Minimal stub for the 'obsidian' module so unit/integration tests can
// import plugin code without a real Obsidian runtime.

// Patch HTMLElement to add Obsidian's DOM helper methods used by ConversationView
// These are needed for jsdom-based tests.
if (typeof HTMLElement !== "undefined") {
  const proto = HTMLElement.prototype as any;

  if (!proto.createDiv) {
    proto.createDiv = function (opts?: { cls?: string; text?: string }) {
      const el = document.createElement("div");
      if (opts?.cls) el.className = opts.cls;
      if (opts?.text) el.textContent = opts.text;
      this.appendChild(el);
      return el;
    };
  }

  if (!proto.createSpan) {
    proto.createSpan = function (opts?: { cls?: string; text?: string }) {
      const el = document.createElement("span");
      if (opts?.cls) el.className = opts.cls;
      if (opts?.text) el.textContent = opts.text;
      this.appendChild(el);
      return el;
    };
  }

  if (!proto.createEl) {
    proto.createEl = function (tag: string, opts?: { cls?: string; text?: string; attr?: Record<string, string> }) {
      const el = document.createElement(tag);
      if (opts?.cls) el.className = opts.cls;
      if (opts?.text) el.textContent = opts.text;
      if (opts?.attr) Object.entries(opts.attr).forEach(([k, v]) => el.setAttribute(k, v));
      this.appendChild(el);
      return el;
    };
  }

  if (!proto.addClass) {
    proto.addClass = function (cls: string) {
      this.classList.add(cls);
      return this;
    };
  }

  if (!proto.removeClass) {
    proto.removeClass = function (cls: string) {
      this.classList.remove(cls);
      return this;
    };
  }

  if (!proto.empty) {
    proto.empty = function () {
      this.innerHTML = "";
    };
  }
}

export class Plugin {
  app: unknown = {};
  loadData = async () => ({});
  saveData = async () => {};
  addRibbonIcon = () => ({ remove: () => {} });
  addCommand = () => {};
  addSettingTab = () => {};
  registerView = () => {};
}

export class ItemView {
  containerEl = { children: [null, document.createElement("div")] } as unknown as HTMLElement;
  leaf: unknown;
  constructor(leaf: unknown) { this.leaf = leaf; }
  getViewType() { return ""; }
  getDisplayText() { return ""; }
  getIcon() { return ""; }
}

export class PluginSettingTab {
  app: unknown;
  plugin: unknown;
  containerEl = document.createElement("div");
  constructor(app: unknown, plugin: unknown) { this.app = app; this.plugin = plugin; }
  display() {}
}

export class Setting {
  constructor(_: HTMLElement) {}
  setHeading() { return this; }
  setName(_: string) { return this; }
  setDesc(_: string) { return this; }
  addText(_: (t: { setPlaceholder: (s: string) => unknown; setValue: (s: string) => unknown; onChange: (fn: (v: string) => void) => unknown; inputEl: HTMLInputElement }) => void) { return this; }
  addToggle(_: (t: { setValue: (v: boolean) => unknown; onChange: (fn: (v: boolean) => void) => unknown }) => void) { return this; }
  addButton(_: (b: { setButtonText: (s: string) => unknown; setTooltip: (s: string) => unknown; onClick: (fn: () => void) => unknown }) => void) { return this; }
}

export class Notice {
  constructor(_: string) {}
}

export class WorkspaceLeaf {}
