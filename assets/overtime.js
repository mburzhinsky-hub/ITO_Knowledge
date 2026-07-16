(() => {
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1KkTkUoWdDEakPGrq3wijk5Q5Ltm-enCLr3zEmUZ9uFM/preview?gid=1775919143';
  const SOURCE_URL = 'https://docs.google.com/spreadsheets/d/1KkTkUoWdDEakPGrq3wijk5Q5Ltm-enCLr3zEmUZ9uFM/edit?gid=1775919143#gid=1775919143';

  function addMenuLink() {
    const group = document.querySelector('.sidebar .nav-group');
    if (!group || group.querySelector('a[href="overtime.html"]')) return;
    const link = document.createElement('a');
    link.className = 'nav-link active';
    link.href = 'overtime.html';
    link.innerHTML = '<span class="nav-dot"></span>Таблица переработок';
    group.appendChild(link);
  }

  function init() {
    addMenuLink();
    const iframe = document.getElementById('overtimeFrame');
    const loader = document.getElementById('overtimeLoader');
    const openBtn = document.getElementById('openOvertimeSource');
    if (openBtn) openBtn.href = SOURCE_URL;
    if (!iframe) return;
    iframe.addEventListener('load', () => loader?.classList.add('hidden'));
    requestAnimationFrame(() => { iframe.src = SHEET_URL; });
    setTimeout(() => loader?.classList.add('hidden'), 12000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();