const template = document.createElement('template');

const DEFAULT_DURATION = 720;
const DRAG_THRESHOLD = 0.24;
const DEFAULT_OPTIONS = Object.freeze({
  display: 'double',
  duration: DEFAULT_DURATION,
  gradients: true,
  acceleration: true,
  autoCenter: true,
  disabled: false,
});

template.innerHTML = `
  <style>
    :host {
      --book-width: min(94vw, 760px);
      --book-height: clamp(360px, 70vh, 540px);
      --book-cover: #6a3f27;
      --book-cover-dark: #2b160d;
      --book-cover-gold: #f1c879;
      --paper: #f3dfb9;
      --paper-warm: #ead0a2;
      --paper-edge: #bc8040;
      --ink: #2b1a10;
      --muted: rgba(43, 26, 16, .68);
      display: block;
      color: var(--ink);
      font-family: Georgia, 'Times New Roman', serif;
    }

    *, *::before, *::after { box-sizing: border-box; }

    .shell {
      display: grid;
      gap: 1rem;
      justify-items: center;
    }

    .book-wrapper {
      position: relative;
      width: var(--book-width);
      max-width: 100%;
      filter: drop-shadow(18px 14px 14px rgba(10, 7, 4, .42));
    }

    .book {
      position: relative;
      width: 100%;
      height: var(--book-height);
      min-height: 360px;
      perspective: 1900px;
      outline: none;
      user-select: none;
      touch-action: pan-y;
    }

    .book:focus-visible {
      outline: 3px solid rgba(255, 217, 138, .78);
      outline-offset: .45rem;
    }

    .book.is-disabled {
      cursor: not-allowed;
      opacity: .72;
    }

    .book.is-single {
      max-width: calc(var(--book-width) / 2);
      margin-inline: auto;
    }

    .book-cover,
    .pages-container,
    .pages,
    .page,
    .cover {
      position: absolute;
      inset: 0;
    }

    .book-cover {
      border-radius: 20px 15px 15px 20px;
      background:
        radial-gradient(circle at 70% 18%, rgba(255, 220, 145, .15), transparent 18%),
        radial-gradient(circle at 25% 82%, rgba(255, 195, 104, .11), transparent 22%),
        linear-gradient(90deg, rgba(0, 0, 0, .42) 0 4.4%, rgba(255, 212, 137, .14) 4.7% 5.6%, transparent 5.8%),
        linear-gradient(145deg, #8b5735 0%, var(--book-cover) 42%, var(--book-cover-dark) 100%);
      box-shadow:
        inset 0 0 0 2px rgba(247, 213, 143, .18),
        inset 0 0 0 13px rgba(36, 18, 10, .2),
        inset -24px 0 40px rgba(0, 0, 0, .26);
    }

    .book-cover::before,
    .book-cover::after {
      content: '';
      position: absolute;
      pointer-events: none;
    }

    .book-cover::before {
      inset: 8.5% 8% 9% 11%;
      border: 1px solid rgba(241, 200, 121, .52);
      border-radius: 14px;
      box-shadow: inset 0 0 0 5px rgba(61, 31, 16, .16);
    }

    .book-cover::after {
      inset: 4% 4% 5% 5.5%;
      border-radius: 15px;
      background:
        repeating-linear-gradient(90deg, rgba(242, 218, 178, .35) 0 2px, rgba(130, 77, 34, .32) 2px 4px, transparent 4px 8px),
        linear-gradient(90deg, rgba(38, 18, 9, .36), transparent 13%, transparent 88%, rgba(38, 18, 9, .28));
      opacity: .54;
      mix-blend-mode: screen;
    }

    .pages-container {
      inset: 4.2% 5% 5.2% 7.1%;
      transform-style: preserve-3d;
    }

    .pages-container::before,
    .pages-container::after {
      content: '';
      position: absolute;
      inset-block: 1.2%;
      z-index: 0;
      width: calc(50% - 1px);
      border: 1px solid rgba(112, 70, 31, .23);
      background:
        linear-gradient(90deg, rgba(92, 54, 24, .12), transparent 12%, rgba(92, 54, 24, .15)),
        radial-gradient(circle at 34% 16%, rgba(255, 251, 225, .44), transparent 25%),
        repeating-linear-gradient(0deg, rgba(119, 77, 35, .07) 0 1px, transparent 1px 27px),
        var(--paper);
      box-shadow: inset 0 0 24px rgba(139, 85, 36, .13);
    }

    .pages-container::before {
      left: 0;
      border-radius: 12px 0 0 12px;
      box-shadow: inset -22px 0 28px rgba(84, 49, 22, .14);
    }

    .pages-container::after {
      right: 0;
      border-radius: 0 12px 12px 0;
      box-shadow: inset 22px 0 28px rgba(84, 49, 22, .09);
    }

    .book.is-single .pages-container::before,
    .book.is-single .spine-shadow {
      display: none;
    }

    .book.is-single .pages-container::after {
      left: 0;
      width: 100%;
      border-radius: 12px;
    }

    .book.is-single .page {
      inset: 0;
      width: 100%;
    }

    .pages {
      transform-style: preserve-3d;
      z-index: 2;
    }

    .page {
      inset: 0 auto 0 50%;
      width: 50%;
      height: 100%;
      transform-origin: left center;
      transform-style: preserve-3d;
      transition:
        transform var(--page-turn-duration, ${DEFAULT_DURATION}ms) cubic-bezier(.2, .72, .18, 1),
        z-index 0ms linear var(--page-turn-half-duration, ${DEFAULT_DURATION / 2}ms);
      z-index: var(--depth);
      will-change: transform;
    }

    .page.is-turned {
      transform: rotateY(-180deg);
    }

    .page.is-dragging {
      transition: none;
      transform: rotateY(var(--drag-angle, 0deg));
    }

    .page.is-resetting {
      transition: transform 260ms cubic-bezier(.22, .76, .26, 1);
    }

    .page.hard .face {
      background:
        radial-gradient(circle at 76% 12%, rgba(255, 223, 150, .12), transparent 18%),
        linear-gradient(90deg, rgba(0, 0, 0, .2), transparent 10%, rgba(0, 0, 0, .18)),
        linear-gradient(145deg, #7f4d2e, var(--book-cover) 48%, #3b1f13);
      color: rgba(255, 234, 188, .9);
      border-color: rgba(246, 204, 128, .3);
    }

    .page.hard .face h2,
    .page.hard .page-number {
      color: var(--book-cover-gold);
    }

    .face {
      position: absolute;
      inset: 0;
      display: grid;
      align-content: start;
      gap: .85rem;
      overflow: hidden;
      padding: clamp(1.2rem, 3.8vw, 2.35rem);
      border: 1px solid rgba(112, 70, 31, .3);
      background:
        linear-gradient(90deg, rgba(92, 54, 24, .18), transparent 7%, transparent 93%, rgba(92, 54, 24, .12)),
        radial-gradient(circle at 72% 18%, rgba(255, 251, 225, .52), transparent 24%),
        repeating-linear-gradient(0deg, rgba(119, 77, 35, .08) 0 1px, transparent 1px 27px),
        var(--paper);
      backface-visibility: hidden;
      box-shadow: inset 0 0 22px rgba(139, 85, 36, .16);
    }

    .face::before,
    .face::after {
      content: '';
      position: absolute;
      pointer-events: none;
    }

    .face::before {
      inset: 7% 10%;
      border: 1px solid rgba(151, 93, 42, .14);
      border-radius: 50% 45% 48% 42%;
      opacity: .75;
    }

    .face::after {
      top: 0;
      bottom: 0;
      width: 18%;
      opacity: 0;
      transition: opacity 180ms ease;
    }

    .book.is-hovering-forward .page.is-current:not(.is-turned) .front::after,
    .page.is-dragging .front::after {
      opacity: .68;
    }

    .front {
      border-radius: 0 12px 12px 0;
    }

    .front::after {
      right: 0;
      background: linear-gradient(90deg, transparent, rgba(84, 48, 20, .2));
    }

    .back {
      border-radius: 12px 0 0 12px;
      transform: rotateY(180deg);
    }

    .back::after {
      left: 0;
      background: linear-gradient(90deg, rgba(84, 48, 20, .2), transparent);
    }

    .page-content {
      position: relative;
      z-index: 1;
      display: grid;
      gap: .8rem;
      min-height: 100%;
    }

    .page-content > div {
      display: grid;
      gap: .75rem;
    }

    .spine-shadow {
      position: absolute;
      inset: 0 calc(50% - 9px);
      z-index: 70;
      pointer-events: none;
      background: linear-gradient(90deg, rgba(55, 31, 14, .3), rgba(255, 243, 210, .22), rgba(55, 31, 14, .26));
      filter: blur(.6px);
    }

    .cover {
      z-index: 90;
      transform-origin: left center;
      transform-style: preserve-3d;
      transition:
        transform 820ms cubic-bezier(.2, .7, .18, 1),
        visibility 0ms linear 820ms;
      will-change: transform;
    }

    .cover.is-open {
      transform: rotateY(-178deg);
      visibility: hidden;
    }

    .cover.is-dragging {
      visibility: visible;
      transition: none;
      transform: rotateY(var(--drag-angle, 0deg));
    }

    .cover-face {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      gap: .75rem;
      padding: 2rem;
      text-align: center;
      border: 2px solid rgba(246, 204, 128, .26);
      border-radius: 20px 15px 15px 20px;
      background:
        radial-gradient(circle at 76% 12%, rgba(255, 223, 150, .16), transparent 18%),
        radial-gradient(circle at 22% 72%, rgba(255, 210, 122, .1), transparent 24%),
        linear-gradient(90deg, rgba(0, 0, 0, .3) 0 5%, transparent 5.2% 100%),
        linear-gradient(145deg, #875331, var(--book-cover) 45%, var(--book-cover-dark));
      backface-visibility: hidden;
      box-shadow:
        inset 0 0 0 10px rgba(45, 23, 12, .18),
        inset 0 0 42px rgba(0, 0, 0, .28);
    }

    .cover-face::before,
    .cover-face::after {
      content: '';
      position: absolute;
      pointer-events: none;
    }

    .cover-face::before {
      inset: 9%;
      border: 1px solid rgba(240, 198, 117, .52);
      border-radius: 14px;
    }

    .cover-face::after {
      inset: 18% 16%;
      border-radius: 999px 60% 999px 58%;
      border: 1px solid rgba(248, 220, 158, .22);
      transform: rotate(-7deg);
    }

    .cover-back {
      transform: rotateY(180deg);
      background:
        linear-gradient(90deg, #2a160e, #5d371f 7%, #ead3a6 8%, #f2dfbc),
        var(--paper-warm);
    }

    .cover-title,
    .face h2 {
      margin: 0;
      line-height: .95;
    }

    .cover-title {
      max-width: 9ch;
      color: var(--book-cover-gold);
      font-size: clamp(2.35rem, 7.7vw, 5rem);
      text-shadow: 0 2px 0 rgba(0, 0, 0, .4);
    }

    .cover-subtitle,
    .status {
      margin: 0;
      font-size: .95rem;
      letter-spacing: .04em;
    }

    .cover-subtitle {
      color: rgba(255, 229, 172, .78);
      text-transform: uppercase;
    }

    .status {
      color: rgba(255, 239, 204, .78);
    }

    .face h2 {
      color: #6b3f20;
      font-size: clamp(1.55rem, 3.8vw, 2.65rem);
    }

    .face p,
    .face li {
      margin: 0;
      font-size: clamp(.98rem, 1.9vw, 1.2rem);
      line-height: 1.55;
    }

    .face code {
      padding: .05em .28em;
      border-radius: .35em;
      background: rgba(126, 73, 30, .14);
    }

    .page-number {
      position: absolute;
      bottom: .9rem;
      color: rgba(76, 47, 22, .52);
      font-size: .85rem;
    }

    .front .page-number { right: 1.15rem; }
    .back .page-number { left: 1.15rem; }

    .turn-zone {
      position: absolute;
      top: 0;
      bottom: 0;
      z-index: 95;
      width: 32%;
      border: 0;
      padding: 0;
      background: transparent;
      cursor: pointer;
    }

    .turn-zone.is-previous { left: 0; }
    .turn-zone.is-next { right: 0; }
    .turn-zone:disabled { cursor: default; }

    .controls {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: .75rem;
    }

    .controls button {
      min-width: 8rem;
      min-height: 2.75rem;
      border: 1px solid rgba(86, 50, 24, .42);
      border-radius: 999px;
      color: #2f1b0e;
      background: linear-gradient(#fff1cc, #d8a75a);
      box-shadow: 0 4px 0 rgba(65, 38, 18, .42);
      cursor: pointer;
      font: inherit;
      font-weight: 700;
    }

    .controls button:hover:not(:disabled),
    .controls button:focus-visible {
      background: linear-gradient(#fff8de, #e6bb73);
      outline: 3px solid rgba(239, 198, 117, .46);
      outline-offset: 2px;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: .48;
    }

    .hint {
      margin: 0;
      color: rgba(255, 239, 204, .78);
      font-size: .9rem;
      text-align: center;
    }

    ::slotted(*) { display: none; }

    @media (max-width: 680px) {
      :host {
        --book-width: min(94vw, 430px);
        --book-height: min(72vh, 610px);
      }

      .book { min-height: 430px; }

      .pages-container {
        inset: 4.4% 6.2% 5.5% 8.2%;
      }

      .face {
        padding: clamp(1rem, 5vw, 1.45rem);
      }

      .face p,
      .face li {
        font-size: .95rem;
      }

      .cover-title {
        font-size: clamp(2.2rem, 13vw, 4rem);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .page,
      .cover,
      .face::after {
        transition-duration: 1ms;
      }
    }
  </style>
  <section class="shell">
    <div class="book-wrapper">
      <div class="book" tabindex="0" role="region">
        <div class="book-cover" aria-hidden="true"></div>
        <div class="pages-container">
          <div class="pages"></div>
          <div class="spine-shadow" aria-hidden="true"></div>
        </div>
        <article class="cover" aria-hidden="true">
          <section class="cover-face cover-front">
            <div>
              <h2 class="cover-title"></h2>
              <p class="cover-subtitle"></p>
            </div>
          </section>
          <section class="cover-face cover-back"></section>
        </article>
        <button class="turn-zone is-previous" type="button" tabindex="-1" aria-label="Previous page"></button>
        <button class="turn-zone is-next" type="button" tabindex="-1" aria-label="Next page"></button>
      </div>
    </div>
    <div class="controls" aria-label="Book controls">
      <button class="prev" type="button">Previous</button>
      <button class="next" type="button">Open book</button>
    </div>
    <p class="status" aria-live="polite">Cover closed</p>
    <p class="hint">Click a page edge, drag or swipe, or use ← / → keys.</p>
    <slot></slot>
  </section>
`;

const fallbackPages = [
  {
    title: 'Chapter 1',
    body: '<p>A dependency-free page-turning book, packaged as one custom element.</p>',
  },
  {
    title: 'Chapter 2',
    body: '<p>Pages are regular HTML supplied inside the component, then rendered into a shadow DOM book.</p>',
  },
  {
    title: 'Chapter 3',
    body: '<p>The flip animation uses CSS transforms and keeps keyboard controls available.</p>',
  },
  {
    title: 'The End',
    body: '<p>Drop the script on any static page and add <code>&lt;page-turn-book&gt;</code>.</p>',
  },
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function pageContent(page, index) {
  if (!page) return '<span class="page-number" aria-hidden="true"></span>';
  const title = page.title ? `<h2>${escapeHtml(page.title)}</h2>` : '';
  return `<div class="page-content">${title}<div>${page.body}</div><span class="page-number">${index + 1}</span></div>`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

class PageTurnBook extends HTMLElement {
  static get observedAttributes() {
    return ['title', 'subtitle', 'display', 'duration', 'page', 'disabled'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.append(template.content.cloneNode(true));
    this.currentPage = 0;
    this.pages = [];
    this.pointerStart = null;
    this.activeTurn = null;
  }

  connectedCallback() {
    this.cacheElements();
    this.syncOptionsFromAttributes();
    this.pages = this.readPages();
    this.currentPage = this.initialPage();
    this.renderPages();
    this.bindEvents();
    this.updateCoverText();
    this.updateState();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.shadowRoot || oldValue === newValue) return;

    if (name === 'title' || name === 'subtitle') {
      this.updateCoverText();
      return;
    }

    this.syncOptionsFromAttributes();
    if (!this.book) return;

    if (name === 'page') {
      this.goTo(this.initialPage(), { emit: false });
      return;
    }

    this.updateState();
  }

  cacheElements() {
    this.book = this.shadowRoot.querySelector('.book');
    this.cover = this.shadowRoot.querySelector('.cover');
    this.pagesLayer = this.shadowRoot.querySelector('.pages');
    this.prevButton = this.shadowRoot.querySelector('.prev');
    this.nextButton = this.shadowRoot.querySelector('.controls .next');
    this.prevZone = this.shadowRoot.querySelector('.turn-zone.is-previous');
    this.nextZone = this.shadowRoot.querySelector('.turn-zone.is-next');
    this.status = this.shadowRoot.querySelector('.status');
    this.coverTitle = this.shadowRoot.querySelector('.cover-title');
    this.coverSubtitle = this.shadowRoot.querySelector('.cover-subtitle');
  }

  syncOptionsFromAttributes() {
    const display = this.getAttribute('display') === 'single' ? 'single' : DEFAULT_OPTIONS.display;
    const duration = Math.max(0, Number.parseInt(this.getAttribute('duration') || DEFAULT_OPTIONS.duration, 10));

    this.options = {
      ...this.options,
      display,
      duration: Number.isFinite(duration) ? duration : DEFAULT_OPTIONS.duration,
      disabled: this.hasAttribute('disabled'),
      autoCenter: this.getAttribute('auto-center') !== 'false',
    };

    this.style.setProperty('--page-turn-duration', `${this.options.duration}ms`);
    this.style.setProperty('--page-turn-half-duration', `${this.options.duration / 2}ms`);
  }

  initialPage() {
    const page = Number.parseInt(this.getAttribute('page') || '0', 10);
    return Number.isFinite(page) ? clamp(page, 0, this.pages.length) : 0;
  }

  readPages() {
    const authoredPages = Array.from(this.children)
      .filter((child) => child.matches('[data-page]'))
      .map((child, index) => ({
        title: child.getAttribute('data-title') || child.querySelector('h1, h2, h3')?.textContent || `Page ${index + 1}`,
        body: child.innerHTML,
        hard: child.hasAttribute('data-hard') || child.classList.contains('hard'),
      }));

    return authoredPages.length > 0 ? authoredPages : fallbackPages;
  }

  renderPages() {
    this.pagesLayer.textContent = '';
    const totalLeaves = Math.ceil(this.pages.length / 2);

    for (let leafIndex = 0; leafIndex < totalLeaves; leafIndex += 1) {
      const frontIndex = leafIndex * 2;
      const backIndex = frontIndex + 1;
      const leaf = document.createElement('article');
      const frontPage = this.pages[frontIndex];
      const backPage = this.pages[backIndex];
      leaf.className = 'page sheet';
      leaf.classList.toggle('hard', Boolean(frontPage?.hard || backPage?.hard));
      leaf.dataset.leaf = String(leafIndex);
      leaf.style.setProperty('--depth', String(totalLeaves - leafIndex));
      leaf.innerHTML = `
        <section class="face front p${frontIndex + 1} odd">${pageContent(frontPage, frontIndex)}</section>
        <section class="face back p${backIndex + 1} even">${pageContent(backPage, backIndex)}</section>
      `;
      this.pagesLayer.append(leaf);
    }
  }

  bindEvents() {
    if (this.hasBoundEvents) return;
    this.hasBoundEvents = true;

    this.prevButton.addEventListener('click', () => this.previous());
    this.nextButton.addEventListener('click', () => this.next());
    this.book.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
    this.book.addEventListener('pointermove', (event) => this.handlePointerMove(event));
    this.book.addEventListener('pointerup', (event) => this.handlePointerUp(event));
    this.book.addEventListener('pointercancel', () => this.cancelDrag());
    this.book.addEventListener('pointerleave', () => this.book.classList.remove('is-hovering-forward'));
    this.book.addEventListener('pointermove', (event) => this.handleHover(event));
    this.book.addEventListener('keydown', (event) => this.handleKeydown(event));
  }

  updateCoverText() {
    const title = this.getAttribute('title') || 'Book Flip';
    const subtitle = this.getAttribute('subtitle') || 'Vanilla Web Component';
    const book = this.shadowRoot?.querySelector('.book');

    if (this.coverTitle) this.coverTitle.textContent = title;
    if (this.coverSubtitle) this.coverSubtitle.textContent = subtitle;
    if (book) book.setAttribute('aria-label', `${title} page-turn book`);
  }

  handleHover(event) {
    if (this.activeTurn) return;
    const rect = this.book.getBoundingClientRect();
    const nearRightEdge = event.clientX > rect.right - rect.width * 0.16;
    this.book.classList.toggle('is-hovering-forward', nearRightEdge && this.currentPage < this.pages.length);
  }

  handlePointerDown(event) {
    if (this.options.disabled || this.isAnimating()) return;
    if (event.button !== undefined && event.button !== 0) return;

    const rect = this.book.getBoundingClientRect();
    const fromRight = event.clientX >= rect.left + rect.width / 2;
    const direction = fromRight ? 'next' : 'previous';
    const target = this.getTurnTarget(direction);

    if (!target) return;

    this.pointerStart = { x: event.clientX, y: event.clientY, rect, direction };
    this.activeTurn = { direction, element: target };
    target.classList.add('is-dragging');
    this.book.setPointerCapture?.(event.pointerId);
  }

  handlePointerMove(event) {
    if (!this.pointerStart || !this.activeTurn) return;

    const { rect, direction } = this.pointerStart;
    const distance = direction === 'next'
      ? rect.right - event.clientX
      : event.clientX - rect.left;
    const progress = clamp(distance / (rect.width * 0.48), 0, 1);
    const angle = direction === 'next'
      ? -178 * progress
      : -178 + 178 * progress;

    this.activeTurn.element.style.setProperty('--drag-angle', `${angle}deg`);
  }

  handlePointerUp(event) {
    if (!this.pointerStart || !this.activeTurn) {
      this.pointerStart = null;
      return;
    }

    const deltaX = event.clientX - this.pointerStart.x;
    const deltaY = event.clientY - this.pointerStart.y;
    const rect = this.pointerStart.rect;
    const direction = this.pointerStart.direction;
    const dragRatio = Math.abs(deltaX) / Math.max(rect.width, 1);
    const shouldTurn = dragRatio > DRAG_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)
      ? (direction === 'next' ? deltaX < 0 : deltaX > 0)
      : this.wasReleasedOnTurnSide(event.clientX, direction, rect);

    const element = this.activeTurn.element;
    this.clearDragElement(element);
    this.pointerStart = null;
    this.activeTurn = null;

    if (shouldTurn) {
      this[direction]();
    } else {
      element.classList.add('is-resetting');
      window.setTimeout(() => element.classList.remove('is-resetting'), 280);
    }
  }

  wasReleasedOnTurnSide(clientX, direction, rect) {
    const midpoint = rect.left + rect.width / 2;
    return direction === 'next' ? clientX >= midpoint : clientX < midpoint;
  }

  clearDragElement(element) {
    element.classList.remove('is-dragging');
    element.style.removeProperty('--drag-angle');
  }

  cancelDrag() {
    if (this.activeTurn?.element) {
      this.clearDragElement(this.activeTurn.element);
    }
    this.pointerStart = null;
    this.activeTurn = null;
  }

  getTurnTarget(direction) {
    if (direction === 'next') {
      if (this.currentPage >= this.pages.length) return null;
      if (this.currentPage === 0) return this.cover;
      return this.pagesLayer.querySelectorAll('.page')[Math.floor((this.currentPage - 1) / 2)] || null;
    }

    if (this.currentPage <= 0) return null;
    if (this.currentPage === 1) return this.cover;
    return this.pagesLayer.querySelectorAll('.page')[Math.floor((this.currentPage - 2) / 2)] || null;
  }

  handleKeydown(event) {
    const actions = {
      ArrowRight: () => this.next(),
      ArrowLeft: () => this.previous(),
      Home: () => this.goTo(0),
      End: () => this.goTo(this.pages.length),
    };
    const action = actions[event.key];

    if (!action) return;
    event.preventDefault();
    action();
  }

  previous() {
    return this.goTo(this.previousPageIndex());
  }

  next() {
    return this.goTo(this.nextPageIndex());
  }

  previousPageIndex() {
    if (this.currentPage <= 1) return 0;
    if (this.options.display === 'single') return this.currentPage - 1;

    return Math.max(this.visibleSpreadStart() - 2, 1);
  }

  nextPageIndex() {
    if (this.currentPage >= this.pages.length) return this.pages.length;
    if (this.currentPage === 0 || this.options.display === 'single') return this.currentPage + 1;

    return Math.min(this.visibleSpreadStart() + 2, this.pages.length);
  }

  turn(command, value) {
    const actions = {
      next: () => this.next(),
      previous: () => this.previous(),
      page: () => (value === undefined ? this.currentPage : this.goTo(value)),
      pages: () => this.pages.length,
      display: () => (value === undefined ? this.options.display : this.setDisplay(value)),
      disable: () => this.setDisabled(Boolean(value)),
      is: () => this.isAnimating() ? 'animating' : 'ready',
      options: () => ({ ...this.options }),
      destroy: () => this.destroy(),
    };

    return actions[command]?.();
  }

  setDisplay(display) {
    this.options.display = display === 'single' ? 'single' : 'double';
    this.setAttribute('display', this.options.display);
    this.updateState();
    return this.options.display;
  }

  setDisabled(disabled) {
    this.options.disabled = disabled;
    this.toggleAttribute('disabled', disabled);
    this.updateState();
    return this.options.disabled;
  }

  isAnimating() {
    return Boolean(this.turnTimer);
  }

  destroy() {
    window.clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.shadowRoot.replaceChildren();
  }

  goTo(pageIndex, { emit = true } = {}) {
    if (this.options.disabled) return this.currentPage;

    const previousPage = this.currentPage;
    const nextPage = clamp(Number.parseInt(pageIndex, 10), 0, this.pages.length);
    if (!Number.isFinite(nextPage) || nextPage === previousPage) return this.currentPage;

    if (emit && !this.emitTurnEvent('turning', { page: nextPage, previousPage })) {
      return this.currentPage;
    }

    this.currentPage = nextPage;
    this.updateState();

    if (emit) {
      this.emitTurnEvent('pagechange', { page: this.currentPage, previousPage, total: this.pages.length });
      window.clearTimeout(this.turnTimer);
      this.turnTimer = window.setTimeout(() => {
        this.turnTimer = null;
        this.emitTurnEvent('turned', { page: this.currentPage, previousPage, total: this.pages.length });
        if (this.currentPage === 0) this.emitTurnEvent('first', { page: this.currentPage });
        if (this.currentPage === this.pages.length) this.emitTurnEvent('last', { page: this.currentPage });
      }, this.options.duration);
    }

    return this.currentPage;
  }

  emitTurnEvent(type, detail) {
    return this.dispatchEvent(new CustomEvent(type, {
      detail: { ...detail, total: this.pages.length, view: this.currentView() },
      bubbles: true,
      cancelable: type === 'turning',
    }));
  }

  currentView() {
    if (this.currentPage === 0) return [];
    if (this.options.display === 'single') return [this.currentPage];

    const left = this.visibleSpreadStart();
    return [left, left + 1].filter((page) => page > 0 && page <= this.pages.length);
  }

  visibleSpreadStart(pageIndex = this.currentPage) {
    if (pageIndex <= 0) return 0;
    if (this.options.display === 'single') return pageIndex;
    if (pageIndex >= this.pages.length) {
      return this.pages.length % 2 === 0 ? this.pages.length - 1 : this.pages.length;
    }

    return pageIndex % 2 === 0 ? pageIndex - 1 : pageIndex;
  }

  updateState() {
    const leaves = Array.from(this.pagesLayer.querySelectorAll('.page'));

    this.book.classList.toggle('is-single', this.options.display === 'single');
    this.book.classList.toggle('is-double', this.options.display !== 'single');
    this.book.classList.toggle('is-disabled', this.options.disabled);
    this.book.classList.toggle('is-animating', this.isAnimating());
    this.cover.classList.toggle('is-open', this.currentPage > 0);
    const visibleStart = this.visibleSpreadStart();
    leaves.forEach((leaf, index) => {
      const leafStart = index * 2 + 1;
      const leafEnd = leafStart + 1;
      const isTurned = visibleStart > leafStart;
      const isCurrent = this.currentPage > 0 && visibleStart >= leafStart && visibleStart <= leafEnd;
      leaf.classList.toggle('is-turned', isTurned);
      leaf.classList.toggle('is-current', isCurrent && !isTurned);
      leaf.style.zIndex = isTurned ? String(index + 1) : leaf.style.getPropertyValue('--depth');
    });

    this.prevButton.disabled = this.options.disabled || this.currentPage === 0;
    this.prevZone.disabled = this.options.disabled || this.currentPage === 0;
    this.nextButton.disabled = this.options.disabled || this.currentPage === this.pages.length;
    this.nextZone.disabled = this.options.disabled || this.currentPage === this.pages.length;
    this.nextButton.textContent = this.currentPage === 0 ? 'Open book' : 'Next';
    this.status.textContent = this.statusText();
  }

  statusText() {
    if (this.currentPage === 0) return 'Cover closed';
    if (this.options.display === 'single') {
      return `Page ${Math.min(this.currentPage, this.pages.length)} of ${this.pages.length}`;
    }

    const visiblePages = this.currentView();
    return visiblePages.length > 1
      ? `Pages ${visiblePages[0]}–${visiblePages.at(-1)} of ${this.pages.length}`
      : `Page ${visiblePages[0]} of ${this.pages.length}`;
  }
}

if (!customElements.get('page-turn-book')) {
  customElements.define('page-turn-book', PageTurnBook);
}
