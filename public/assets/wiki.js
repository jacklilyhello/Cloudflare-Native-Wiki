(function () {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target && target.tagName === 'IMG' && target.closest('.markdown-body')) {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.zIndex = '999';
      overlay.style.background = 'rgba(0,0,0,.82)';
      overlay.style.display = 'grid';
      overlay.style.placeItems = 'center';
      overlay.style.padding = '24px';
      overlay.innerHTML = `<img src="${target.src}" alt="${target.alt || ''}" style="max-width:96vw;max-height:92vh;border-radius:14px" />`;
      overlay.addEventListener('click', () => overlay.remove());
      document.body.appendChild(overlay);
    }
  });

  if (document.querySelector('.mermaid')) {
    import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: true, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default' });
    }).catch(() => {});
  }
})();
