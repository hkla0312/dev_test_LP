const progress = document.querySelector('#boot-progress');
if (progress) {
  const startedAt = performance.now();
  const duration = 1080;
  const update = now => {
    const value = Math.min(100, Math.round(((now - startedAt) / duration) * 100));
    progress.style.width = `${value}%`;
    progress.setAttribute('aria-valuenow', value);
    progress.nextElementSibling.textContent = `${value}%`;
    if (value < 100) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}
