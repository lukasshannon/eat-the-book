const template = document.createElement('template');

template.innerHTML = `
  <style>
    :host {
      --book-width: min(92vw, 760px);
      --book-height: min(72vh, 520px);
      --book-cover: #5b3420;
      --book-cover-dark: #24120c;
      --book-cover-gold: #f0c675;
      --paper: #f4dfb9;
      --paper-edge: #c7924c;
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

    .book {
      position: relative;
      width: var(--book-width);
      height: var(--book-height);
      min-height: 360px;
      perspective: 1800px;
      outline: none;
      user-select: none;
    }

    .board,
    .page,
    .cover {
      position: absolute;
      inset: 0;
      border-radius: 22px 16px 16px 22px;
    }

    .board {
      background:
        radial-gradient(circle at 16% 18%, rgba(255, 235, 180, .2), transparent 22%),
        linear-gradient(90deg, #2a160e 0 3.2%, #7d4b2a 3.3% 5%, #3d2014 5.1% 100%);
      box-shadow: 0 24px 40px rgba(0, 0, 0, .38), inset 0 0 0 2px rgba(255, 223, 155, .15);
    }

    .pages {
      position: absolute;
      inset: 4% 5% 5% 7%;
      transform-style: preserve-3d;
    }

    .page {
      left: 50%;
      width: 50%;
      height: 100%;
      transform-origin: left center;
      transform-style: preserve-3d;
      transition: transform 720ms cubic-bezier(.2, .75, .2, 1), z-index 0ms linear 360ms;
      z-index: var(--depth);
    }

    .page.is-turned {
      transform: rotateY(-180deg);
    }

    .face {
      position: absolute;
      inset: 0;
      display: grid;
      align-content: start;
      gap: .85rem;
      overflow: hidden;
      padding: clamp(1.4rem, 4vw, 2.4rem);
      border: 1px solid rgba(112, 70, 31, .3);
      background:
        linear-gradient(90deg, rgba(92, 54, 24, .18), transparent 7%, transparent 93%, rgba(92, 54, 24, .12)),
        radial-gradient(circle at 72% 18%, rgba(255, 251, 225, .52), transparent 24%),
        repeating-linear-gradient(0deg, rgba(119, 77, 35, .08) 0 1px, transparent 1px 28px),
        var(--paper);
      backface-visibility: hidden;
      box-shadow: inset 0 0 22px rgba(139, 85, 36, .16);
    }

    .front {
      border-radius: 0 13px 13px 0;
    }

    .back {
      border-radius: 13px 0 0 13px;
      transform: rotateY(180deg);
    }

    .left-leaf {
      position: absolute;
      inset: 4% 50% 5% 7%;
      border-radius: 13px 0 0 13px;
      border: 1px solid rgba(112, 70, 31, .24);
      background:
        linear-gradient(90deg, rgba(92, 54, 24, .1), transparent 12%, rgba(92, 54, 24, .16)),
        radial-gradient(circle at 24% 16%, rgba(255, 251, 225, .46), transparent 25%),
        repeating-linear-gradient(0deg, rgba(119, 77, 35, .07) 0 1px, transparent 1px 28px),
        var(--paper);
      box-shadow: inset -18px 0 24px rgba(84, 49, 22, .13);
    }

    .spine-shadow {
      position: absolute;
      inset: 4% 48.6% 5% 48.6%;
      z-index: 80;
      pointer-events: none;
      background: linear-gradient(90deg, rgba(55, 31, 14, .32), rgba(255, 243, 210, .26), rgba(55, 31, 14, .28));
      filter: blur(.5px);
    }

    .cover {
      z-index: 90;
      transform-origin: left center;
      transform-style: preserve-3d;
      transition: transform 820ms cubic-bezier(.2, .7, .18, 1), visibility 0ms linear 820ms;
    }

    .cover.is-open {
      transform: rotateY(-178deg);
      visibility: hidden;
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
      border-radius: inherit;
      background:
        radial-gradient(circle at 76% 12%, rgba(255, 223, 150, .16), transparent 18%),
        linear-gradient(90deg, rgba(0, 0, 0, .28) 0 5%, transparent 5.2% 100%),
        linear-gradient(145deg, #875331, var(--book-cover) 45%, var(--book-cover-dark));
      backface-visibility: hidden;
      box-shadow: inset 0 0 0 10px rgba(45, 23, 12, .18), inset 0 0 42px rgba(0, 0, 0, .28);
    }

    .cover-face::before {
      content: '';
      position: absolute;
      inset: 9%;
      border: 1px solid rgba(240, 198, 117, .52);
      border-radius: 14px;
      pointer-events: none;
    }

    .cover-back {
      transform: rotateY(180deg);
      background: linear-gradient(90deg, #2a160e, #5d371f 7%, #ead3a6 8%, #f2dfbc);
    }

    .cover-title,
    .face h2 {
      margin: 0;
      line-height: .95;
    }

    .cover-title {
      max-width: 9ch;
      color: var(--book-cover-gold);
      font-size: clamp(2.5rem, 8vw, 5rem);
      text-shadow: 0 2px 0 rgba(0, 0, 0, .4);
    }

    .cover-subtitle,
    .status {
      margin: 0;
      color: var(--muted);
      font-size: .95rem;
      letter-spacing: .04em;
    }

    .cover-subtitle {
      color: rgba(255, 229, 172, .78);
      text-transform: uppercase;
    }

    .face h2 {
      color: #6b3f20;
      font-size: clamp(1.8rem, 4vw, 2.65rem);
    }

    .face p {
      margin: 0;
      font-size: clamp(1rem, 2vw, 1.22rem);
      line-height: 1.55;
    }

    .page-number {
      position: absolute;
      bottom: 1rem;
      color: rgba(76, 47, 22, .52);
      font-size: .85rem;
    }

    .front .page-number { right: 1.3rem; }
    .back .page-number { left: 1.3rem; }

    .controls {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: .75rem;
    }

    button {
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

    button:hover:not(:disabled),
    button:focus-visible {
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
        --book-height: min(72vh, 620px);
      }

      .book { min-height: 430px; }
      .pages { inset: 3.5% 4.5% 5% 6%; }
      .left-leaf, .spine-shadow { display: none; }
      .page { left: 0; width: 100%; }
      .front, .back { border-radius: 13px; }
      .face { padding: clamp(1.35rem, 7vw, 2rem); }
    }

    @media (prefers-reduced-motion: reduce) {
      .page,
      .cover {
        transition: none;
      }
    }
  </style>
  <section class="shell" aria-label="Interactive page-turn book">
    <div class="book" part="book" tabindex="0" role="region" aria-roledescription="book" aria-label="Page-turn book demo">
      <div class="board" aria-hidden="true"></div>
      <div class="left-leaf" aria-hidden="true"></div>
      <div class="pages"></div>
      <div class="spine-shadow" aria-hidden="true"></div>
      <div class="cover">
        <div class="cover-face">
          <p class="cover-subtitle"></p>
          <h2 class="cover-title"></h2>
        </div>
        <div class="cover-face cover-back" aria-hidden="true"></div>
      </div>
    </div>
    <div class="controls" aria-label="Book controls">
      <button class="prev" type="button">Previous</button>
      <button class="next" type="button">Open book</button>
    </div>
    <p class="status" aria-live="polite"></p>
    <p class="hint">Tip: focus the book and use Left/Right, Home, or End.</p>
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
  const title = page.title ? `<h2>${escapeHtml(page.title)}</h2>` : '';
  return `${title}<div>${page.body}</div><span class="page-number">${index + 1}</span>`;
}

class PageTurnBook extends HTMLElement {
  static get observedAttributes() {
    return ['title', 'subtitle'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.append(template.content.cloneNode(true));
    this.currentPage = 0;
    this.pages = [];
  }

  connectedCallback() {
    this.cacheElements();
    this.pages = this.readPages();
    this.renderPages();
    this.bindEvents();
    this.updateCoverText();
    this.updateState();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) {
      this.updateCoverText();
    }
  }

  cacheElements() {
    this.book = this.shadowRoot.querySelector('.book');
    this.cover = this.shadowRoot.querySelector('.cover');
    this.pagesLayer = this.shadowRoot.querySelector('.pages');
    this.prevButton = this.shadowRoot.querySelector('.prev');
    this.nextButton = this.shadowRoot.querySelector('.next');
    this.status = this.shadowRoot.querySelector('.status');
    this.coverTitle = this.shadowRoot.querySelector('.cover-title');
    this.coverSubtitle = this.shadowRoot.querySelector('.cover-subtitle');
  }

  readPages() {
    const authoredPages = Array.from(this.children)
      .filter((child) => child.matches('[data-page]'))
      .map((child, index) => ({
        title: child.getAttribute('data-title') || child.querySelector('h1, h2, h3')?.textContent || `Page ${index + 1}`,
        body: child.innerHTML,
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
      leaf.className = 'page';
      leaf.style.setProperty('--depth', String(totalLeaves - leafIndex));
      leaf.innerHTML = `
        <section class="face front">${pageContent(this.pages[frontIndex], frontIndex)}</section>
        <section class="face back">${this.pages[backIndex] ? pageContent(this.pages[backIndex], backIndex) : '<span class="page-number"></span>'}</section>
      `;
      this.pagesLayer.append(leaf);
    }
  }

  bindEvents() {
    if (this.hasBoundEvents) return;
    this.hasBoundEvents = true;

    this.prevButton.addEventListener('click', () => this.previous());
    this.nextButton.addEventListener('click', () => this.next());
    this.book.addEventListener('click', (event) => this.handleBookClick(event));
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

  handleBookClick(event) {
    const rect = this.book.getBoundingClientRect();
    const isForwardHalf = event.clientX >= rect.left + rect.width / 2;

    if (isForwardHalf) {
      this.next();
    } else {
      this.previous();
    }
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
    this.goTo(this.currentPage - 1);
  }

  next() {
    this.goTo(this.currentPage + 1);
  }

  goTo(pageIndex) {
    const nextPage = Math.min(Math.max(pageIndex, 0), this.pages.length);
    if (nextPage === this.currentPage) return;

    this.currentPage = nextPage;
    this.updateState();
    this.dispatchEvent(new CustomEvent('pagechange', {
      detail: { page: this.currentPage, total: this.pages.length },
      bubbles: true,
    }));
  }

  updateState() {
    const leaves = Array.from(this.pagesLayer.querySelectorAll('.page'));

    this.cover.classList.toggle('is-open', this.currentPage > 0);
    leaves.forEach((leaf, index) => {
      leaf.classList.toggle('is-turned', this.currentPage > index * 2 + 1);
      leaf.style.zIndex = this.currentPage > index * 2 + 1 ? String(index + 1) : leaf.style.getPropertyValue('--depth');
    });

    this.prevButton.disabled = this.currentPage === 0;
    this.nextButton.disabled = this.currentPage === this.pages.length;
    this.nextButton.textContent = this.currentPage === 0 ? 'Open book' : 'Next';
    this.status.textContent = this.currentPage === 0
      ? 'Cover closed'
      : `Page ${Math.min(this.currentPage, this.pages.length)} of ${this.pages.length}`;
  }
}

if (!customElements.get('page-turn-book')) {
  customElements.define('page-turn-book', PageTurnBook);
}
