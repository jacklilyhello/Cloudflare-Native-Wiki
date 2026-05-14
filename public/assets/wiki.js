(function () {
  const sidebar = document.querySelector('#sidebar');
  const menuToggle = document.querySelector('#menu-toggle');
  menuToggle?.addEventListener('click', () => sidebar?.classList.toggle('open'));

  document.querySelectorAll('.folder-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.nav-item');
      const children = item?.querySelector(':scope > .nav-children');
      if (!item || !children) return;
      const expanded = item.getAttribute('data-expanded') === 'true';
      item.setAttribute('data-expanded', String(!expanded));
      children.setAttribute('data-expanded', String(!expanded));
    });
  });

  document.querySelectorAll('.markdown-body pre').forEach((pre) => {
    const btn = document.createElement('button');
    btn.className = 'code-copy';
    btn.textContent = '复制';
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.textContent || pre.textContent || '';
      await navigator.clipboard.writeText(code);
      btn.textContent = '已复制';
      setTimeout(() => (btn.textContent = '复制'), 1200);
    });
    pre.appendChild(btn);
  });

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

  const tocLinks = Array.from(document.querySelectorAll('.toc-link'));
  const headings = tocLinks
    .map((a) => document.getElementById(a.getAttribute('data-toc-id') || ''))
    .filter(Boolean);
  if (headings.length) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        tocLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('data-toc-id') === id));
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    headings.forEach((el) => obs.observe(el));
  }
})();
