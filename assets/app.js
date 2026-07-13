(() => {
  const D = window.ITO_DATA;
  const K = window.ITO_KNOWLEDGE || { categories: [], articles: [] };
  const nav = [
    ['index.html', 'Главная'],
    ['knowledge.html', 'База знаний'],
    ['templates.html', 'Шаблоны задач'],
    ['standards.html', 'Стандарты и чек-листы'],
    ['roles.html', 'Роли ИТО'],
    ['planner.html', 'Планировщик проекта']
  ];

  function fileName() { return location.pathname.split('/').pop() || 'index.html'; }
  function phaseName(id) { return D.phases.find(x => x.id === id)?.label || id; }
  function categoryName(id) { return K.categories.find(x => x.id === id)?.label || id; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function getFavorites() { try { return JSON.parse(localStorage.getItem('itoKnowledgeFavoritesV1')) || []; } catch (_) { return []; } }
  function setFavorites(ids) { localStorage.setItem('itoKnowledgeFavoritesV1', JSON.stringify(ids)); }
  function isFavorite(id) { return getFavorites().includes(id); }
  function toggleFavorite(id) { const current = getFavorites(); const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]; setFavorites(next); return next.includes(id); }

  function injectShell() {
    const current = fileName();
    const header = document.querySelector('[data-header]');
    const sidebar = document.querySelector('[data-sidebar]');
    if (header) {
      header.innerHTML = `
        <header class="topbar">
          <a class="brand" href="index.html">
            <div class="brand-mark">ИТО</div>
            <div class="brand-copy"><strong>База знаний ИТО</strong><span>Регламенты, инструкции и проектные шаблоны</span></div>
          </a>
          <div class="top-search">
            <input id="globalSearch" placeholder="Найти инструкцию, систему, шаблон или сотрудника…" autocomplete="off">
            <span class="search-kbd">Ctrl K</span>
            <div id="searchResults" class="search-results"></div>
          </div>
          <div class="top-actions"><a class="btn" href="knowledge.html">Открыть базу</a><a class="btn btn-primary" href="planner.html">Собрать план</a></div>
        </header>`;
    }
    if (sidebar) {
      sidebar.innerHTML = `
        <aside class="sidebar">
          <div class="nav-group">
            <div class="nav-label">База знаний</div>
            ${nav.map(([href, label]) => `<a class="nav-link ${current === href || (current === 'article.html' && href === 'knowledge.html') ? 'active' : ''}" href="${href}"><span class="nav-dot"></span>${label}</a>`).join('')}
          </div>
          <div class="nav-group">
            <div class="nav-label">Популярные разделы</div>
            <a class="nav-link" href="article.html?id=technical-realization"><span class="nav-dot"></span>Техническая реализация</a>
            <a class="nav-link" href="article.html?id=sks-guide"><span class="nav-dot"></span>СКС</a>
            <a class="nav-link" href="article.html?id=project-documentation"><span class="nav-dot"></span>Проектная документация</a>
            <a class="nav-link" href="article.html?id=commissioning-handover"><span class="nav-dot"></span>ПНР и сдача</a>
          </div>
          <div class="sidebar-foot">MVP 1.1<br>База построена по анализу 412 задач и актуальных должностных инструкций ИТО.<br><span class="warn">Полномочия руководителя и ведущего инженера требуют отдельного нормативного закрепления.</span></div>
        </aside>`;
    }
    setupSearch();
  }

  function allSearchRows() {
    return [
      ...K.articles.map(x => ({ title: x.title, text: `${categoryName(x.category)} ${x.summary} ${x.tags.join(' ')} ${x.audience}`, href: `article.html?id=${x.id}`, kind: 'Статья' })),
      ...D.templates.map(x => ({ title: x.title, text: `${phaseName(x.phase)} ${x.desc} ${x.owner} ${x.outputs.join(' ')}`, href: `templates.html#${x.id}`, kind: 'Шаблон задачи' })),
      ...D.standards.map(x => ({ title: x.title, text: `${x.code} ${x.desc}`, href: `standards.html#${x.code}`, kind: 'Стандарт' })),
      ...D.people.map(x => ({ title: x.name, text: `${x.role} ${x.focus}`, href: 'roles.html', kind: 'Сотрудник' }))
    ];
  }

  function setupSearch() {
    const input = document.getElementById('globalSearch');
    const box = document.getElementById('searchResults');
    if (!input || !box) return;
    const rows = allSearchRows();
    const render = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { box.classList.remove('open'); box.innerHTML = ''; return; }
      const matches = rows.filter(x => `${x.title} ${x.text}`.toLowerCase().includes(q)).slice(0, 10);
      box.innerHTML = matches.length ? matches.map(x => `<a class="search-result" href="${x.href}"><strong>${escapeHtml(x.title)}</strong><span>${x.kind} · ${escapeHtml(x.text.slice(0, 120))}</span></a>`).join('') : '<div class="search-result"><strong>Совпадений нет</strong><span>Попробуйте: СКС, обследование, ПНР, закупки, исполнительная документация</span></div>';
      box.classList.add('open');
    };
    input.addEventListener('input', render);
    document.addEventListener('click', e => { if (!e.target.closest('.top-search')) box.classList.remove('open'); });
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); input.select(); }
      if (e.key === 'Escape') box.classList.remove('open');
    });
  }

  function renderHome() {
    const articleHost = document.getElementById('homeArticles');
    if (articleHost) {
      const ids = ['technical-realization','sks-guide','project-documentation','commissioning-handover','task-definition','role-model'];
      articleHost.innerHTML = ids.map(id => articleCard(K.articles.find(x => x.id === id), true)).join('');
      articleHost.querySelectorAll('[data-favorite]').forEach(btn => btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation(); const active = toggleFavorite(btn.dataset.favorite); btn.classList.toggle('active', active); btn.textContent = active ? '★' : '☆';
      }));
    }
    const categoryHost = document.getElementById('homeCategories');
    if (categoryHost) {
      const icons = { process: '↳', system: '⌁', quality: '✓', management: '◎' };
      categoryHost.innerHTML = K.categories.map(c => {
        const count = K.articles.filter(x => x.category === c.id).length;
        return `<a class="card knowledge-section-card" href="knowledge.html?category=${c.id}"><div class="knowledge-section-icon">${icons[c.id] || '•'}</div><div><h3>${escapeHtml(c.label)}</h3><p>${escapeHtml(c.description)}</p><span>${count} статей →</span></div></a>`;
      }).join('');
    }
    const homeSearch = document.getElementById('homeKnowledgeSearch');
    const result = document.getElementById('homeSearchResult');
    if (homeSearch && result) {
      const paint = () => {
        const q = homeSearch.value.trim().toLowerCase();
        if (!q) { result.innerHTML = ''; return; }
        const matches = K.articles.filter(a => `${a.title} ${a.summary} ${a.tags.join(' ')}`.toLowerCase().includes(q)).slice(0, 5);
        result.innerHTML = matches.map(a => `<a class="home-search-item" href="article.html?id=${a.id}"><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.summary)}</span></a>`).join('') || '<div class="home-search-item"><strong>Статья не найдена</strong><span>Посмотрите полный каталог или используйте глобальный поиск.</span></div>';
      };
      homeSearch.addEventListener('input', paint);
      homeSearch.addEventListener('keydown', e => { if (e.key === 'Enter' && homeSearch.value.trim()) location.href = `knowledge.html?q=${encodeURIComponent(homeSearch.value.trim())}`; });
    }
  }

  function renderKnowledgePage() {
    const grid = document.getElementById('knowledgeGrid');
    const search = document.getElementById('knowledgeSearch');
    const filters = document.getElementById('knowledgeFilters');
    const count = document.getElementById('knowledgeCount');
    if (!grid) return;
    const params = new URLSearchParams(location.search);
    let category = params.get('category') || 'all';
    if (!['all','favorites',...K.categories.map(x => x.id)].includes(category)) category = 'all';
    if (search) search.value = params.get('q') || '';
    const filterRows = [{ id:'all', label:'Все статьи' }, ...K.categories, { id:'favorites', label:'Избранное' }];
    filters.innerHTML = filterRows.map(x => `<button class="chip ${x.id === category ? 'active' : ''}" data-knowledge-category="${x.id}">${escapeHtml(x.label)}</button>`).join('');
    const paint = () => {
      const q = (search?.value || '').trim().toLowerCase();
      const favs = getFavorites();
      const data = K.articles.filter(a => (category === 'all' || (category === 'favorites' ? favs.includes(a.id) : a.category === category)) && `${a.title} ${a.summary} ${a.tags.join(' ')} ${a.audience}`.toLowerCase().includes(q));
      if (count) count.textContent = `${data.length} ${plural(data.length, 'статья', 'статьи', 'статей')}`;
      grid.innerHTML = data.map(a => articleCard(a, false)).join('') || '<div class="card empty-state"><strong>Ничего не найдено</strong><span>Измените фильтр или поисковый запрос.</span></div>';
      grid.querySelectorAll('[data-favorite]').forEach(btn => btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation(); const active = toggleFavorite(btn.dataset.favorite); btn.classList.toggle('active', active); btn.textContent = active ? '★' : '☆'; if (category === 'favorites') paint();
      }));
    };
    filters.addEventListener('click', e => { const btn = e.target.closest('[data-knowledge-category]'); if (!btn) return; category = btn.dataset.knowledgeCategory; filters.querySelectorAll('.chip').forEach(x => x.classList.remove('active')); btn.classList.add('active'); paint(); });
    search?.addEventListener('input', paint);
    paint();
  }

  function articleCard(a, compact) {
    if (!a) return '';
    return `<article class="card article-card ${compact ? 'compact' : ''}">
      <div class="article-card-top"><span class="article-category">${escapeHtml(categoryName(a.category))}</span><button class="favorite-btn ${isFavorite(a.id) ? 'active' : ''}" data-favorite="${a.id}" title="Добавить в избранное">${isFavorite(a.id) ? '★' : '☆'}</button></div>
      <a href="article.html?id=${a.id}"><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.summary)}</p></a>
      <div class="article-tags">${a.tags.slice(0,3).map(t => `<span>${escapeHtml(t)}</span>`).join('')}</div>
      <div class="article-card-foot"><span>${escapeHtml(a.readTime)}</span><a href="article.html?id=${a.id}">Открыть статью →</a></div>
    </article>`;
  }

  function renderArticlePage() {
    const host = document.getElementById('articleRoot');
    if (!host) return;
    const id = new URLSearchParams(location.search).get('id') || 'technical-realization';
    const a = K.articles.find(x => x.id === id);
    if (!a) { host.innerHTML = '<div class="card empty-state"><strong>Статья не найдена</strong><a class="btn" href="knowledge.html">Вернуться в базу знаний</a></div>'; return; }
    document.title = `База знаний ИТО — ${a.title}`;
    const relatedTasks = a.taskIds.map(id => D.templates.find(x => x.id === id)).filter(Boolean);
    const relatedArticles = a.related.map(id => K.articles.find(x => x.id === id)).filter(Boolean);
    host.innerHTML = `
      <div class="article-breadcrumbs"><a href="knowledge.html">База знаний</a><span>›</span><a href="knowledge.html?category=${a.category}">${escapeHtml(categoryName(a.category))}</a><span>›</span><span>${escapeHtml(a.title)}</span></div>
      <article class="knowledge-article">
        <header class="article-hero card">
          <div class="article-hero-copy"><div class="eyebrow">${escapeHtml(categoryName(a.category))}</div><h1>${escapeHtml(a.title)}</h1><p>${escapeHtml(a.summary)}</p>
            <div class="article-meta"><span>Владелец: ${escapeHtml(a.owner)}</span><span>Для: ${escapeHtml(a.audience)}</span><span>Обновлено: ${a.updated}</span><span>${a.readTime}</span></div>
          </div>
          <div class="article-hero-actions"><button class="btn ${isFavorite(a.id) ? 'btn-primary' : ''}" id="articleFavorite">${isFavorite(a.id) ? '★ В избранном' : '☆ В избранное'}</button>${relatedTasks.length ? `<a class="btn btn-primary" href="planner.html?article=${a.id}">Добавить задачи в план</a>` : ''}</div>
        </header>
        <div class="article-layout">
          <aside class="article-toc card"><div class="nav-label">Содержание</div><a href="#purpose">Назначение</a><a href="#apply">Когда применять</a><a href="#inputs">Что нужно на входе</a><a href="#steps">Порядок работы</a><a href="#outputs">Результат</a><a href="#done">Критерии готовности</a><a href="#mistakes">Типовые ошибки</a>${relatedTasks.length ? '<a href="#tasks">Шаблоны задач</a>' : ''}</aside>
          <div class="article-content">
            ${sectionText('purpose','Назначение',a.purpose)}
            ${sectionList('apply','Когда применять',a.applyWhen)}
            ${sectionList('inputs','Что должно быть на входе',a.inputs)}
            <section class="article-section card" id="steps"><div class="article-section-kicker">Порядок выполнения</div><h2>Как выполнять работу</h2><div class="instruction-steps">${a.steps.map((s,i) => `<div class="instruction-step"><div class="instruction-number">${String(i+1).padStart(2,'0')}</div><div><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.text)}</p></div></div>`).join('')}</div></section>
            ${sectionList('outputs','Что должно получиться на выходе',a.outputs,'result-list')}
            ${sectionList('done','Критерии готовности и приёмки',a.done,'check-list')}
            ${sectionList('mistakes','Типовые ошибки',a.mistakes,'danger-list')}
            ${relatedTasks.length ? `<section class="article-section card" id="tasks"><div class="article-section-head"><div><div class="article-section-kicker">Практическое применение</div><h2>Связанные шаблоны задач</h2><p>Эти задачи можно добавить в проектный график с нормативными сроками, ролями и зависимостями.</p></div><a class="btn btn-primary" href="planner.html?article=${a.id}">Добавить комплект в план</a></div><div class="related-task-list">${relatedTasks.map(t => `<a href="templates.html#${t.id}"><span class="phase-pill">${escapeHtml(phaseName(t.phase))}</span><strong>${escapeHtml(t.title)}</strong><em>${t.duration} раб. дн.</em></a>`).join('')}</div></section>` : ''}
            ${relatedArticles.length ? `<section class="article-section card"><div class="article-section-kicker">Продолжить изучение</div><h2>Связанные статьи</h2><div class="related-articles">${relatedArticles.map(x => `<a href="article.html?id=${x.id}"><strong>${escapeHtml(x.title)}</strong><span>${escapeHtml(x.summary)}</span></a>`).join('')}</div></section>` : ''}
          </div>
        </div>
      </article>`;
    const favBtn = document.getElementById('articleFavorite');
    favBtn?.addEventListener('click', () => { const active = toggleFavorite(a.id); favBtn.classList.toggle('btn-primary', active); favBtn.textContent = active ? '★ В избранном' : '☆ В избранное'; });
  }

  function sectionText(id, title, text) { return `<section class="article-section card" id="${id}"><div class="article-section-kicker">Базовый принцип</div><h2>${escapeHtml(title)}</h2><p class="article-main-text">${escapeHtml(text)}</p></section>`; }
  function sectionList(id, title, items, cls='') { return `<section class="article-section card" id="${id}"><h2>${escapeHtml(title)}</h2><ul class="knowledge-list ${cls}">${items.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></section>`; }

  function renderTemplatesPage() {
    const grid = document.getElementById('templateGrid');
    const search = document.getElementById('templateSearch');
    const filterHost = document.getElementById('templateFilters');
    const count = document.getElementById('templateCount');
    if (!grid) return;
    let phase = 'all';
    const filters = [{ id:'all', label:'Все этапы' }, ...D.phases];
    filterHost.innerHTML = filters.map(x => `<button class="chip ${x.id === 'all' ? 'active' : ''}" data-phase="${x.id}">${x.label}</button>`).join('');
    const paint = () => {
      const q = (search?.value || '').trim().toLowerCase();
      const data = D.templates.filter(t => (phase === 'all' || t.phase === phase) && `${t.title} ${t.desc} ${t.owner} ${t.outputs.join(' ')}`.toLowerCase().includes(q));
      if (count) count.textContent = `${data.length} ${plural(data.length,'шаблон','шаблона','шаблонов')}`;
      grid.innerHTML = data.map(t => `
        <article class="card template-card" data-template-id="${t.id}" id="${t.id}">
          <div class="template-phase"><span class="phase-pill">${phaseName(t.phase)}</span><span class="template-duration">${t.duration} раб. дн.</span></div>
          <h3>${escapeHtml(t.title)}</h3><p>${escapeHtml(t.desc)}</p>
          <div class="template-meta"><span>Исполнитель: ${escapeHtml(t.owner)}</span><span>Проверяет: ${escapeHtml(t.reviewer)}</span></div>
        </article>`).join('') || '<div class="card empty-state"><strong>Ничего не найдено</strong></div>';
      grid.querySelectorAll('[data-template-id]').forEach(el => el.addEventListener('click', () => showTemplateDetail(el.dataset.templateId)));
    };
    filterHost.addEventListener('click', e => { const btn = e.target.closest('[data-phase]'); if (!btn) return; filterHost.querySelectorAll('.chip').forEach(x => x.classList.remove('active')); btn.classList.add('active'); phase = btn.dataset.phase; paint(); });
    search?.addEventListener('input', paint); paint();
    const hash = location.hash.replace('#',''); if (hash && D.templates.some(x => x.id === hash)) setTimeout(() => showTemplateDetail(hash), 80);
  }

  function showTemplateDetail(id) {
    const t = D.templates.find(x => x.id === id); if (!t) return;
    let modal = document.getElementById('templateModal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'templateModal'; modal.className = 'modal-backdrop'; document.body.appendChild(modal); }
    modal.innerHTML = `<div class="modal">
      <div class="modal-head"><div><div class="eyebrow">${phaseName(t.phase)} · ${t.duration} рабочих дней</div><h2>${escapeHtml(t.title)}</h2><p class="muted small">${escapeHtml(t.desc)}</p></div><button class="icon-btn" data-close>×</button></div>
      <div class="modal-body"><div class="grid grid-3"><div class="detail-block"><h4>Исполнитель</h4><div class="small">${escapeHtml(t.owner)}</div></div><div class="detail-block"><h4>Проверяющий</h4><div class="small">${escapeHtml(t.reviewer)}</div></div><div class="detail-block"><h4>Принимающий</h4><div class="small">${escapeHtml(t.approver)}</div></div></div>
      <div class="detail-columns">${listBlock('Входные данные', t.inputs)}${listBlock('Результат', t.outputs)}${listBlock('До старта / Ready', t.ready)}${listBlock('Критерии готовности / Done', t.done)}</div></div>
      <div class="modal-foot"><button class="btn" data-close>Закрыть</button><a class="btn btn-primary" href="planner.html?task=${t.id}">Добавить в план</a></div></div>`;
    modal.classList.add('open'); modal.querySelectorAll('[data-close]').forEach(x => x.addEventListener('click', () => modal.classList.remove('open'))); modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); }, { once:true });
  }

  function renderRoles() {
    const body = document.getElementById('rolesBody'); if (!body) return;
    body.innerHTML = D.people.map(p => `<tr><td><div class="role-person">${escapeHtml(p.name)}</div><div class="role-title">${escapeHtml(p.role)}</div>${p.status ? `<span class="status-note">${escapeHtml(p.status)}</span>` : ''}</td><td><span class="level-badge">${escapeHtml(p.level)}</span></td><td>${escapeHtml(p.focus)}</td><td>${roleRule(p.role)}</td><td>${reviewRule(p.role)}</td></tr>`).join('');
  }

  function renderStandards() {
    const grid = document.getElementById('standardsGrid'); if (!grid) return;
    grid.innerHTML = D.standards.map(s => `<article class="card standard-card" id="${s.code}"><div class="standard-code">${s.code}</div><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.desc)}</p><a href="article.html?id=${standardArticle(s.code)}">Открыть инструкцию →</a></article>`).join('');
  }
  function standardArticle(code) { return ({'STD-ITO-01':'task-definition','STD-ITO-02':'task-definition','STD-ITO-03':'task-definition','STD-ITO-04':'role-model','STD-ITO-05':'change-management','STD-ITO-06':'asbuilt-standard'})[code] || 'task-definition'; }

  function roleRule(role) {
    const map = {'Руководитель ИТО':'Определяет приоритеты, владельцев и ресурсы; не подменяет непосредственного исполнителя.','Технический директор':'Утверждает архитектуру, исключения и критические изменения.','Главный инженер проекта':'Отвечает за технический результат проекта и принимает результаты подсистем.','Ведущий инженер':'Ведёт сложную интеграцию и техническую готовность к ПНР.','Старший инженер-проектировщик':'Принимает решения по подсистеме и выпускает/проверяет документацию.','Младший инженер-проектировщик':'Оформляет материалы только по утверждённым решениям.','Старший инженер':'Организует и контролирует работы на площадке.','Инженер':'Выполняет утверждённые монтажные и настроечные решения.','Старший менеджер по закупкам':'Ведёт коммерческую часть, поставщиков, договоры и логистику.'}; return map[role] || 'Определяется задачей.';
  }
  function reviewRule(role) {
    const map = {'Руководитель ИТО':'Контроль портфеля, сроков и эскалаций.','Технический директор':'Архитектурные и нестандартные решения.','Главный инженер проекта':'Проектный результат, стыки и готовность к сдаче.','Ведущий инженер':'Интеграция, сложные сетапы и ПНР.','Старший инженер-проектировщик':'Документация младшего проектировщика и решения подсистем.','Младший инженер-проектировщик':'Самопроверка перед передачей старшему.','Старший инженер':'Монтаж, качество на площадке и фактическое исполнение.','Инженер':'Самопроверка, фотофиксация и фиксация отклонений.','Старший менеджер по закупкам':'Комплектность заказа, сроки и документы; техническую замену не утверждает.'}; return map[role] || 'По маршруту задачи.';
  }
  function listBlock(title, arr) { return `<div class="detail-block"><h4>${title}</h4><ul>${arr.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`; }
  function plural(n, one, few, many) { const m10=n%10,m100=n%100; return m10===1&&m100!==11?one:(m10>=2&&m10<=4&&(m100<12||m100>14)?few:many); }

  document.addEventListener('DOMContentLoaded', () => { injectShell(); renderHome(); renderKnowledgePage(); renderArticlePage(); renderTemplatesPage(); renderRoles(); renderStandards(); });
  window.ITO_APP = { phaseName, escapeHtml, showTemplateDetail };
})();
