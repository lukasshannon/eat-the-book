const book = document.querySelector('#demoBook');
const eventLog = document.querySelector('#eventLog');
const commands = {
  previous: () => book.previous(),
  next: () => book.next(),
  double: () => book.display('double'),
  single: () => book.display('single'),
  cover: () => book.page(1),
  insert: () => {
    if (book.querySelector('[data-inserted-demo-page]')) return book.page(3);
    const page = document.createElement('section');
    page.dataset.insertedDemoPage = 'true';
    page.innerHTML = '<h2>Inserted Page</h2><p>This page was added dynamically.</p>';
    book.addPage(page, 3);
    return book.page(3);
  },
  remove: () => {
    const inserted = book.querySelector('[data-inserted-demo-page]');
    if (!inserted) return false;
    const pageNumber = Array.from(book.children).filter((child) => !child.hasAttribute('ignore') && !child.hasAttribute('data-ignore') && !child.hidden).indexOf(inserted) + 1;
    return book.removePage(pageNumber);
  },
};

function updateEventLog(prefix = 'State') {
  eventLog.textContent = `${prefix}: display ${book.display()}; page ${book.page()}; view ${book.view().join(', ') || 'none'}; pages ${book.pages()}.`;
}

document.querySelectorAll('[data-demo-command]').forEach((button) => {
  button.addEventListener('click', () => {
    commands[button.dataset.demoCommand]?.();
    updateEventLog(button.textContent.trim());
  });
});

book.addEventListener('turning', (event) => {
  eventLog.textContent = `Turning from page ${event.detail.previousPage} to ${event.detail.page}; next view ${event.detail.view.join(', ')}.`;
});

book.addEventListener('turned', (event) => {
  eventLog.textContent = `Turned from page ${event.detail.previousPage} to ${event.detail.page}; visible ${event.detail.view.join(', ')}.`;
});
