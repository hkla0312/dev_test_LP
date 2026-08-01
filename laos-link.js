document.querySelector('#laos-about-link')?.addEventListener('click', () => {
  window.setTimeout(() => {
    const content = document.querySelector('#laos-content');
    const trigger = document.querySelector('#laos-trigger');
    if (content && trigger && !content.classList.contains('open')) trigger.click();
  }, 0);
});
