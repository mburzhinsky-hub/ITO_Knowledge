(() => {
  const SHEET_ID = '1KkTkUoWdDEakPGrq3wijk5Q5Ltm-enCLr3zEmUZ9uFM';
  const GID = '1775919143';
  const EMBED_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlembed?gid=${GID}&single=true&widget=true&headers=false`;
  const SOURCE_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${GID}#gid=${GID}`;

  function addMenuLink() {
    const group = document.querySelector('.sidebar .nav-group');
    if (!group || group.querySelector('a[href="overtime.html"]')) return;
    const link = document.createElement('a');
    link.className = 'nav-link active';
    link.href = 'overtime.html';
    link.innerHTML = '<span class="nav-dot"></span>Таблица переработок';
    group.appendChild(link);
  }

  function showFallback(loader) {
    if (!loader) return;
    loader.classList.remove('hidden');
    loader.innerHTML = `<strong>Google Sheets не разрешил встроенный просмотр</strong><span>Откройте таблицу напрямую — доступ и редактирование сохранятся.</span><a class="btn btn-primary" href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">Открыть таблицу</a>`;
  }

  function init() {
    addMenuLink();
    const iframe = document.getElementById('overtimeFrame');
    const loader = document.getElementById('overtimeLoader');
    const openBtn = document.getElementById('openOvertimeSource');
    if (openBtn) openBtn.href = SOURCE_URL;
    if (!iframe) return;

    let loaded = false;
    iframe.addEventListener('load', () => {
      loaded = true;
      loader?.classList.add('hidden');
    });

    requestAnimationFrame(() => { iframe.src = EMBED_URL; });
    setTimeout(() => { if (!loaded) showFallback(loader); }, 10000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();