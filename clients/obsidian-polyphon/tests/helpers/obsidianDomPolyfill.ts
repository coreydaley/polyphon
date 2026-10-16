/**
 * Polyfills Obsidian's HTMLElement DOM extensions for unit tests running in jsdom.
 * Obsidian adds createDiv, createEl, createSpan, etc. to HTMLElement.prototype.
 * These are used throughout ConversationView and other DOM-manipulating code.
 */

type CreateElOptions = { cls?: string; text?: string; attr?: Record<string, string> };

function createElPolyfill<K extends keyof HTMLElementTagNameMap>(
  this: HTMLElement,
  tag: K,
  opts: CreateElOptions = {}
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (opts.cls) {
    for (const c of opts.cls.split(" ").filter(Boolean)) el.classList.add(c);
  }
  if (opts.text) el.textContent = opts.text;
  if (opts.attr) {
    for (const [k, v] of Object.entries(opts.attr)) el.setAttribute(k, v);
  }
  this.appendChild(el);
  return el as HTMLElementTagNameMap[K];
}

HTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts?: CreateElOptions
) {
  return createElPolyfill.call(this, tag, opts);
};

HTMLElement.prototype.createDiv = function (opts?: CreateElOptions) {
  return createElPolyfill.call(this, "div", opts);
};

HTMLElement.prototype.createSpan = function (opts?: CreateElOptions) {
  return createElPolyfill.call(this, "span", opts);
};

HTMLElement.prototype.empty = function () {
  while (this.firstChild) this.removeChild(this.firstChild);
};

HTMLElement.prototype.addClass = function (...classes: string[]) {
  for (const c of classes) this.classList.add(c);
};

HTMLElement.prototype.removeClass = function (...classes: string[]) {
  for (const c of classes) this.classList.remove(c);
};

// Extend the HTMLElement type to include these methods
declare global {
  interface HTMLElement {
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, opts?: CreateElOptions): HTMLElementTagNameMap[K];
    createDiv(opts?: CreateElOptions): HTMLDivElement;
    createSpan(opts?: CreateElOptions): HTMLSpanElement;
    empty(): void;
    addClass(...classes: string[]): void;
    removeClass(...classes: string[]): void;
  }
}
