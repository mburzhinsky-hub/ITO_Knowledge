(() => {
  const D = window.ITO_DATA;
  const A = window.ITO_APP;
  const K = window.ITO_KNOWLEDGE || { articles: [] };
  const STORAGE_KEY = 'itoKnowledgePlannerV1';
  const peopleNames = D.people.map(x => x.name);
  const phaseOrder = Object.fromEntries(D.phases.map((x, i) => [x.id, i]));
  let catalogPhase = 'all';
  let draggedTaskId = null;
  let scheduleCache = null;
  let state = loadState();

  function defaultState() {
    return {
      projectName: 'Новый технический проект',
      startDate: dateToISO(nextWorkday(new Date())),
      deadline: '',
      mode: 'smart',
      zoom: 30,
      tasks: []
    };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || !Array.isArray(parsed.tasks)) return defaultState();
      return { ...defaultState(), ...parsed, tasks: parsed.tasks.map(sanitizeTask) };
    } catch (_) { return defaultState(); }
  }

  function sanitizeTask(t) {
    return {
      instanceId: t.instanceId || uid(), templateId: t.templateId || '', title: t.title || 'Задача', phase: t.phase || 'init',
      duration: Math.max(1, Number(t.duration) || 1), owner: t.owner || 'Павел Сергеев', reviewer: t.reviewer || 'Павел Сергеев',
      approver: t.approver || 'Павел Сергеев', dependencies: Array.isArray(t.dependencies) ? t.dependencies : (t.dependencyId ? [t.dependencyId] : []),
      lag: Math.max(0, Number(t.lag) || 0), progress: Math.max(0, Math.min(100, Number(t.progress) || 0)),
      desc: t.desc || '', inputs: arr(t.inputs), outputs: arr(t.outputs), ready: arr(t.ready), done: arr(t.done), level: t.level || 'Исполнение'
    };
  }

  function arr(v) { return Array.isArray(v) ? v : String(v || '').split('\n').map(x => x.trim()).filter(Boolean); }
  function uid() { return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const el = document.getElementById('saveState');
    if (el) { el.innerHTML = '<span class="save-dot"></span>Изменения сохранены'; }
  }
  function commit(renderAll = true) { saveState(); scheduleCache = null; if (renderAll) render(); }

  function init() {
    bindProjectControls();
    renderCatalogFilters();
    bindStaticActions();
    applyQueryAction();
    render();
  }

  function bindProjectControls() {
    const name = document.getElementById('projectName');
    const start = document.getElementById('projectStart');
    const deadline = document.getElementById('projectDeadline');
    const mode = document.getElementById('scheduleMode');
    name.value = state.projectName; start.value = state.startDate; deadline.value = state.deadline; mode.value = state.mode;
    name.addEventListener('input', () => { state.projectName = name.value; saveState(); });
    start.addEventListener('change', () => { state.startDate = start.value || dateToISO(nextWorkday(new Date())); commit(); });
    deadline.addEventListener('change', () => { state.deadline = deadline.value; commit(); });
    mode.addEventListener('change', () => { state.mode = mode.value; saveState(); });
  }

  function renderCatalogFilters() {
    const host = document.getElementById('catalogFilters');
    host.innerHTML = [{ id:'all', label:'Все' }, ...D.phases].map(x => `<button class="chip ${x.id === catalogPhase ? 'active' : ''}" data-catalog-phase="${x.id}">${x.short || x.label}</button>`).join('');
    host.addEventListener('click', e => {
      const btn = e.target.closest('[data-catalog-phase]'); if (!btn) return;
      catalogPhase = btn.dataset.catalogPhase; renderCatalogFilters(); renderCatalog();
    }, { once: true });
  }

  function bindStaticActions() {
    document.getElementById('catalogSearch').addEventListener('input', renderCatalog);
    document.getElementById('dropzone').addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); });
    document.getElementById('dropzone').addEventListener('dragleave', e => e.currentTarget.classList.remove('drag-over'));
    document.getElementById('dropzone').addEventListener('drop', handleDropTemplate);
    document.getElementById('addCustom').addEventListener('click', addCustomTask);
    document.getElementById('clearPlan').addEventListener('click', clearPlan);
    document.getElementById('exportJson').addEventListener('click', exportJson);
    document.getElementById('exportCsv').addEventListener('click', exportCsv);
    document.getElementById('printPlan').addEventListener('click', () => window.print());
    document.getElementById('zoomSelect').value = String(state.zoom);
    document.getElementById('zoomSelect').addEventListener('change', e => { state.zoom = Number(e.target.value); commit(); });
    document.getElementById('presetStrip').addEventListener('click', e => {
      const btn = e.target.closest('[data-preset]'); if (btn) addPreset(btn.dataset.preset);
    });
    document.getElementById('taskModal').addEventListener('click', e => { if (e.target.id === 'taskModal' || e.target.closest('[data-close-modal]')) closeTaskModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTaskModal(); });
  }

  function applyQueryAction() {
    const params = new URLSearchParams(location.search);
    const preset = params.get('preset'); const task = params.get('task'); const article = params.get('article');
    if (preset) addPreset(preset, true);
    if (task) addTemplate(task, true);
    if (article) {
      const knowledgeArticle = K.articles.find(x => x.id === article);
      if (knowledgeArticle) knowledgeArticle.taskIds.forEach(id => addTemplate(id, true));
      commit();
    }
    if (preset || task || article) history.replaceState({}, '', 'planner.html');
  }

  function render() {
    renderCatalog(); renderPresets(); renderMetrics(); renderTaskList(); renderGantt(); renderWorkload();
    document.getElementById('zoomSelect').value = String(state.zoom);
  }

  function renderCatalog() {
    const q = document.getElementById('catalogSearch').value.trim().toLowerCase();
    const list = document.getElementById('catalogList');
    const selectedTemplates = new Set(state.tasks.map(x => x.templateId));
    const rows = D.templates.filter(t => (catalogPhase === 'all' || t.phase === catalogPhase) && `${t.title} ${t.desc} ${t.owner} ${t.outputs.join(' ')}`.toLowerCase().includes(q));
    list.innerHTML = rows.map(t => `<article class="catalog-task ${selectedTemplates.has(t.id) ? 'selected' : ''}" draggable="true" data-template="${t.id}">
      <div class="catalog-task-top"><h4>${A.escapeHtml(t.title)}</h4><button class="add-circle" data-add-template="${t.id}" title="Добавить в график">${selectedTemplates.has(t.id) ? '✓' : '+'}</button></div>
      <p>${A.escapeHtml(t.desc)}</p>
      <div class="catalog-task-foot"><span>${A.phaseName(t.phase)} · ${t.duration} раб. дн.</span><span>${A.escapeHtml(shortName(t.owner))}</span></div>
    </article>`).join('') || '<div class="empty-plan">Шаблоны не найдены.</div>';
    list.querySelectorAll('[draggable="true"]').forEach(card => {
      card.addEventListener('dragstart', e => { card.classList.add('dragging'); e.dataTransfer.setData('application/x-ito-template', card.dataset.template); e.dataTransfer.effectAllowed = 'copy'; });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.addEventListener('dblclick', () => A.showTemplateDetail(card.dataset.template));
    });
    list.querySelectorAll('[data-add-template]').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); addTemplate(btn.dataset.addTemplate); }));
  }

  function renderPresets() {
    const host = document.getElementById('presetStrip');
    host.innerHTML = '<span class="preset-label">Быстрый состав:</span>' + D.presets.map(p => `<button class="btn btn-sm preset-btn" data-preset="${p.id}" title="${A.escapeHtml(p.desc)}">${A.escapeHtml(p.title)}</button>`).join('');
  }

  function addTemplate(templateId, silent = false) {
    const t = D.templates.find(x => x.id === templateId); if (!t) return;
    const existing = state.tasks.find(x => x.templateId === templateId);
    if (existing) { if (!silent) toast('Эта задача уже добавлена в проект'); return existing; }
    const resolvedDeps = (t.dependencies || []).map(depTemplateId => state.tasks.find(x => x.templateId === depTemplateId)?.instanceId).filter(Boolean);
    if (!resolvedDeps.length && state.mode === 'sequential' && state.tasks.length) resolvedDeps.push(state.tasks[state.tasks.length - 1].instanceId);
    const task = sanitizeTask({ ...t, instanceId: uid(), templateId: t.id, dependencies: resolvedDeps, progress: 0, lag: 0 });
    state.tasks.push(task);
    if (!silent) { commit(); toast(`Добавлено: ${t.title}`); } else { saveState(); scheduleCache = null; }
    return task;
  }

  function addPreset(presetId, silent = false) {
    const preset = D.presets.find(x => x.id === presetId); if (!preset) return;
    let added = 0;
    preset.tasks.forEach(id => { const before = state.tasks.length; addTemplate(id, true); if (state.tasks.length > before) added++; });
    commit(); if (!silent) toast(added ? `Добавлено задач: ${added}` : 'Все задачи этого набора уже в плане');
  }

  function addCustomTask() {
    const task = sanitizeTask({ instanceId: uid(), title: 'Новая техническая задача', phase: 'init', duration: 3, owner: 'Павел Сергеев', reviewer: 'Дмитрий Храпугин', approver: 'Дмитрий Храпугин', dependencies: state.mode === 'sequential' && state.tasks.length ? [state.tasks[state.tasks.length - 1].instanceId] : [], inputs: [], outputs: [], ready: [], done: [] });
    state.tasks.push(task); commit(); openTaskModal(task.instanceId);
  }

  function handleDropTemplate(e) {
    e.preventDefault(); e.currentTarget.classList.remove('drag-over');
    const id = e.dataTransfer.getData('application/x-ito-template'); if (id) addTemplate(id);
  }

  function clearPlan() {
    if (!state.tasks.length) return;
    if (!confirm('Удалить все задачи из текущего графика?')) return;
    state.tasks = []; commit(); toast('График очищен');
  }

  function renderMetrics() {
    const { schedules, finish, warnings } = computeSchedule();
    const totalWork = state.tasks.reduce((s,t) => s + t.duration, 0);
    const elapsed = state.tasks.length ? countWorkdays(isoToDate(state.startDate), finish) : 0;
    let deadlineText = 'Не задан'; let deadlineNote = 'Можно указать целевую дату'; let deadlineClass = '';
    if (state.deadline && state.tasks.length) {
      const delta = diffDays(finish, isoToDate(state.deadline));
      if (delta <= 0) { deadlineText = `${Math.abs(delta)} дн. резерв`; deadlineNote = 'Финиш укладывается в целевую дату'; deadlineClass = 'good'; }
      else { deadlineText = `+${delta} дн.`; deadlineNote = 'График выходит за целевую дату'; deadlineClass = 'danger'; }
    }
    const host = document.getElementById('plannerMetrics');
    host.innerHTML = `
      <div class="card planner-metric"><div class="metric-label">Задач в плане</div><div class="metric-value accent">${state.tasks.length}</div><div class="metric-note">${new Set(state.tasks.map(x => x.phase)).size} этапов проекта</div></div>
      <div class="card planner-metric"><div class="metric-label">Плановый финиш</div><div class="metric-value">${state.tasks.length ? formatDate(finish) : '—'}</div><div class="metric-note">${elapsed ? `${elapsed} рабочих дней от старта` : 'Добавьте задачи из библиотеки'}</div></div>
      <div class="card planner-metric"><div class="metric-label">Суммарный объём</div><div class="metric-value">${totalWork}</div><div class="metric-note">рабочих дней по всем задачам, включая параллельные</div></div>
      <div class="card planner-metric"><div class="metric-label">Относительно дедлайна</div><div class="metric-value ${deadlineClass}">${deadlineText}</div><div class="metric-note">${warnings.length ? warnings[0] : deadlineNote}</div></div>`;
  }

  function renderTaskList() {
    const host = document.getElementById('taskList');
    document.getElementById('planCount').textContent = state.tasks.length;
    document.getElementById('dropzone').classList.toggle('hidden', state.tasks.length > 0);
    if (!state.tasks.length) { host.innerHTML = '<div class="empty-plan">Перетащите задачу из библиотеки слева или выберите готовый состав проекта.</div>'; return; }
    host.innerHTML = state.tasks.map((t, index) => {
      const primary = t.dependencies[0] || '';
      const multi = t.dependencies.length > 1;
      return `<div class="task-row" draggable="true" data-task-row="${t.instanceId}">
        <div class="drag-handle" title="Перетащить">⠿</div>
        <div class="task-main" data-edit-task="${t.instanceId}"><div class="task-name">${index + 1}. ${A.escapeHtml(t.title)}</div><div class="task-sub"><span class="phase-pill">${A.phaseName(t.phase)}</span><span>${formatTaskDates(t.instanceId)}</span></div></div>
        <div class="owner-cell"><select class="select" data-field="owner" data-task="${t.instanceId}">${personOptions(t.owner)}</select></div>
        <div><input class="input" type="number" min="1" max="260" value="${t.duration}" data-field="duration" data-task="${t.instanceId}" title="Длительность, рабочие дни"></div>
        <div class="dependency-cell"><select class="select" data-field="dependency" data-task="${t.instanceId}" title="Основной предшественник; несколько связей задаются в редакторе">${multi ? `<option value="__multi" selected>Несколько связей (${t.dependencies.length})</option>` : ''}<option value="" ${!primary ? 'selected' : ''}>Без зависимости</option>${state.tasks.filter(x => x.instanceId !== t.instanceId).map(x => `<option value="${x.instanceId}" ${!multi && primary === x.instanceId ? 'selected' : ''}>${A.escapeHtml(x.title.slice(0,44))}</option>`).join('')}</select></div>
        <div class="progress-cell"><select class="select" data-field="progress" data-task="${t.instanceId}">${[0,25,50,75,100].map(v => `<option value="${v}" ${t.progress === v ? 'selected' : ''}>${v}%</option>`).join('')}</select></div>
        <div class="task-actions"><button class="icon-btn" data-edit-task="${t.instanceId}" title="Редактировать">✎</button><button class="icon-btn" data-remove-task="${t.instanceId}" title="Удалить">×</button></div>
      </div>`;
    }).join('');
    host.querySelectorAll('[data-field]').forEach(el => el.addEventListener('change', handleInlineChange));
    host.querySelectorAll('[data-edit-task]').forEach(el => el.addEventListener('click', () => openTaskModal(el.dataset.editTask)));
    host.querySelectorAll('[data-remove-task]').forEach(el => el.addEventListener('click', () => removeTask(el.dataset.removeTask)));
    host.querySelectorAll('[data-task-row]').forEach(row => {
      row.addEventListener('dragstart', e => { draggedTaskId = row.dataset.taskRow; e.dataTransfer.setData('application/x-ito-task', draggedTaskId); e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('application/x-ito-task')) { e.preventDefault(); row.classList.add('drag-over'); } });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('drag-over'); const source = e.dataTransfer.getData('application/x-ito-task') || draggedTaskId; reorderTask(source, row.dataset.taskRow); });
      row.addEventListener('dragend', () => { draggedTaskId = null; host.querySelectorAll('.drag-over').forEach(x => x.classList.remove('drag-over')); });
    });
  }

  function handleInlineChange(e) {
    const task = state.tasks.find(x => x.instanceId === e.target.dataset.task); if (!task) return;
    const field = e.target.dataset.field;
    if (field === 'duration') task.duration = Math.max(1, Number(e.target.value) || 1);
    if (field === 'owner') task.owner = e.target.value;
    if (field === 'progress') task.progress = Number(e.target.value);
    if (field === 'dependency' && e.target.value !== '__multi') task.dependencies = e.target.value ? [e.target.value] : [];
    commit();
  }

  function reorderTask(sourceId, targetId) {
    if (!sourceId || sourceId === targetId) return;
    const from = state.tasks.findIndex(x => x.instanceId === sourceId); const to = state.tasks.findIndex(x => x.instanceId === targetId);
    if (from < 0 || to < 0) return;
    const [item] = state.tasks.splice(from, 1); state.tasks.splice(to, 0, item); commit();
  }

  function removeTask(id) {
    const task = state.tasks.find(x => x.instanceId === id); if (!task) return;
    state.tasks = state.tasks.filter(x => x.instanceId !== id);
    state.tasks.forEach(x => x.dependencies = x.dependencies.filter(dep => dep !== id));
    commit(); toast(`Удалено: ${task.title}`);
  }

  function openTaskModal(id) {
    const task = state.tasks.find(x => x.instanceId === id); if (!task) return;
    const modal = document.getElementById('taskModal');
    modal.innerHTML = `<div class="modal"><div class="modal-head"><div><div class="eyebrow">Редактор задачи</div><h2>${A.escapeHtml(task.title)}</h2><p class="muted small">Изменения сразу влияют на расчёт сроков и Гант.</p></div><button class="icon-btn" data-close-modal>×</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field" style="grid-column:1/-1"><label>Название задачи</label><input class="input" id="editTitle" value="${A.escapeHtml(task.title)}"></div>
          <div class="field"><label>Этап</label><select class="select" id="editPhase">${D.phases.map(p => `<option value="${p.id}" ${task.phase === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}</select></div>
          <div class="field"><label>Длительность, рабочие дни</label><input class="input" id="editDuration" type="number" min="1" value="${task.duration}"></div>
          <div class="field"><label>Исполнитель</label><select class="select" id="editOwner">${personOptions(task.owner)}</select></div>
          <div class="field"><label>Проверяющий</label><select class="select" id="editReviewer">${personOptions(task.reviewer)}</select></div>
          <div class="field"><label>Принимающий</label><select class="select" id="editApprover">${personOptions(task.approver)}</select></div>
          <div class="field"><label>Лаг после предшественников, раб. дни</label><input class="input" id="editLag" type="number" min="0" value="${task.lag}"></div>
          <div class="field" style="grid-column:1/-1"><label>Предшественники — можно выбрать несколько</label><select class="select" id="editDependencies" multiple style="min-height:125px;padding:8px">${state.tasks.filter(x => x.instanceId !== task.instanceId).map(x => `<option value="${x.instanceId}" ${task.dependencies.includes(x.instanceId) ? 'selected' : ''}>${A.escapeHtml(x.title)}</option>`).join('')}</select></div>
          <div class="field" style="grid-column:1/-1"><label>Описание</label><textarea class="textarea" id="editDesc">${A.escapeHtml(task.desc)}</textarea></div>
        </div>
        <div class="detail-columns">
          ${editList('Входные данные', 'editInputs', task.inputs)}${editList('Результаты', 'editOutputs', task.outputs)}${editList('Definition of Ready', 'editReady', task.ready)}${editList('Definition of Done', 'editDone', task.done)}
        </div>
      </div>
      <div class="modal-foot"><button class="btn" data-close-modal>Отмена</button><button class="btn btn-primary" id="saveTaskEdit">Сохранить и пересчитать</button></div></div>`;
    modal.classList.add('open');
    modal.querySelector('#saveTaskEdit').addEventListener('click', () => {
      task.title = modal.querySelector('#editTitle').value.trim() || task.title;
      task.phase = modal.querySelector('#editPhase').value;
      task.duration = Math.max(1, Number(modal.querySelector('#editDuration').value) || 1);
      task.owner = modal.querySelector('#editOwner').value; task.reviewer = modal.querySelector('#editReviewer').value; task.approver = modal.querySelector('#editApprover').value;
      task.lag = Math.max(0, Number(modal.querySelector('#editLag').value) || 0);
      task.dependencies = [...modal.querySelector('#editDependencies').selectedOptions].map(x => x.value);
      task.desc = modal.querySelector('#editDesc').value.trim();
      task.inputs = lines(modal.querySelector('#editInputs').value); task.outputs = lines(modal.querySelector('#editOutputs').value);
      task.ready = lines(modal.querySelector('#editReady').value); task.done = lines(modal.querySelector('#editDone').value);
      closeTaskModal(); commit(); toast('Задача обновлена, график пересчитан');
    });
  }

  function editList(label, id, values) { return `<div class="field"><label>${label} — по одному пункту в строке</label><textarea class="textarea" id="${id}">${A.escapeHtml(values.join('\n'))}</textarea></div>`; }
  function lines(v) { return v.split('\n').map(x => x.trim()).filter(Boolean); }
  function closeTaskModal() { document.getElementById('taskModal').classList.remove('open'); }

  function renderGantt() {
    const host = document.getElementById('ganttGrid');
    if (!state.tasks.length) { host.innerHTML = '<div class="gantt-empty">Гант появится после добавления первой задачи.</div>'; return; }
    const { schedules, finish } = computeSchedule();
    const start = isoToDate(state.startDate);
    const endCandidate = state.deadline ? maxDate(addDays(finish, 6), addDays(isoToDate(state.deadline), 3)) : addDays(finish, 6);
    const days = Math.max(14, diffDays(endCandidate, start) + 1);
    const width = days * state.zoom;
    const dates = Array.from({ length: days }, (_,i) => addDays(start,i));
    const todayIndex = diffDays(new Date(), start);
    const weeks = [];
    for (let i = 0; i < days; i += 7) weeks.push({ left: i * state.zoom, width: Math.min(7, days-i)*state.zoom, label: dateRangeLabel(dates[i], dates[Math.min(i+6,days-1)]) });
    const dayHeader = dates.map(d => `<div class="day-cell ${isWeekend(d) ? 'weekend' : ''} ${sameDay(d,new Date()) ? 'today' : ''}" title="${fullDate(d)}">${d.getDate()}</div>`).join('');
    const bands = dates.map((d,i) => isWeekend(d) ? `<span class="weekend-band" style="left:${i*state.zoom}px;width:${state.zoom}px"></span>` : '').join('');
    const todayLine = todayIndex >= 0 && todayIndex < days ? `<span class="today-line" style="left:${todayIndex*state.zoom + state.zoom/2}px"></span>` : '';
    host.style.setProperty('--day-width', `${state.zoom}px`);
    host.innerHTML = `<div class="gantt-header"><div class="gantt-label-head">Задача / исполнитель</div><div class="timeline-head" style="width:${width}px"><div class="week-labels">${weeks.map(w => `<span class="week-label" style="left:${w.left}px;width:${w.width}px">${w.label}</span>`).join('')}</div><div class="day-labels">${dayHeader}</div></div></div>` + state.tasks.map(t => {
      const s = schedules[t.instanceId]; const left = diffDays(s.start,start)*state.zoom; const barDays = diffDays(s.end,s.start)+1; const barWidth = Math.max(20, barDays*state.zoom-4);
      return `<div class="gantt-row"><div class="gantt-label" data-edit-task="${t.instanceId}"><strong>${A.escapeHtml(t.title)}</strong><span>${A.escapeHtml(shortName(t.owner))} · ${t.duration} раб. дн.</span></div><div class="timeline-row" style="width:${width}px">${bands}${todayLine}<div class="gantt-bar phase-${t.phase}" data-bar-task="${t.instanceId}" style="left:${left+2}px;width:${barWidth}px" title="${A.escapeHtml(t.title)}\n${fullDate(s.start)} — ${fullDate(s.end)}"><span class="bar-text">${A.escapeHtml(t.title)} · ${t.duration}д</span><span class="resize-handle" data-resize-task="${t.instanceId}"></span></div></div></div>`;
    }).join('');
    host.querySelectorAll('[data-edit-task]').forEach(el => el.addEventListener('click', () => openTaskModal(el.dataset.editTask)));
    bindBarDragging();
  }

  function bindBarDragging() {
    document.querySelectorAll('[data-bar-task]').forEach(bar => {
      bar.addEventListener('pointerdown', e => {
        const task = state.tasks.find(x => x.instanceId === bar.dataset.barTask); if (!task) return;
        const resizing = !!e.target.closest('[data-resize-task]');
        e.preventDefault(); bar.setPointerCapture(e.pointerId); bar.classList.add('dragging');
        const startX = e.clientX; const originalLag = task.lag; const originalDuration = task.duration; let moved = false;
        const move = ev => { const delta = Math.round((ev.clientX-startX)/state.zoom); moved = moved || Math.abs(ev.clientX-startX) > 4; bar.style.transform = resizing ? '' : `translateX(${delta*state.zoom}px)`; if (resizing) bar.style.width = `${Math.max(20, (originalDuration + delta)*state.zoom-4)}px`; };
        const up = ev => {
          bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up); bar.classList.remove('dragging'); bar.style.transform = '';
          const delta = Math.round((ev.clientX-startX)/state.zoom);
          if (moved) {
            if (resizing) task.duration = Math.max(1, originalDuration + delta); else task.lag = Math.max(0, originalLag + delta);
            commit(); toast(resizing ? 'Длительность изменена' : 'Задача сдвинута, график пересчитан');
          }
        };
        bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
      });
      bar.addEventListener('dblclick', () => openTaskModal(bar.dataset.barTask));
    });
  }

  function renderWorkload() {
    const host = document.getElementById('workloadGrid');
    if (!state.tasks.length) { host.innerHTML = '<div class="muted small">Добавьте задачи, чтобы увидеть распределение объёма по исполнителям.</div>'; return; }
    const totals = {};
    state.tasks.forEach(t => totals[t.owner] = (totals[t.owner] || 0) + t.duration);
    const rows = Object.entries(totals).sort((a,b) => b[1]-a[1]); const max = rows[0]?.[1] || 1;
    host.innerHTML = rows.map(([name, days]) => `<div class="card workload-card"><div class="workload-top"><strong>${A.escapeHtml(name)}</strong><span class="accent">${days} дн.</span></div><div class="workload-bar"><div class="workload-fill" style="width:${Math.round(days/max*100)}%"></div></div></div>`).join('');
  }

  function computeSchedule() {
    if (scheduleCache) return scheduleCache;
    const map = Object.fromEntries(state.tasks.map(t => [t.instanceId,t])); const schedules = {}; const warnings = [];
    const projectStart = nextWorkday(isoToDate(state.startDate));
    function calc(id, stack = []) {
      if (schedules[id]) return schedules[id];
      const task = map[id]; if (!task) return null;
      if (stack.includes(id)) { warnings.push(`Циклическая зависимость у задачи «${task.title}»`); const start = addWorkdays(projectStart, task.lag); return schedules[id] = { start, end:addWorkdays(start,task.duration-1), cyclic:true }; }
      const depSchedules = task.dependencies.map(dep => calc(dep,[...stack,id])).filter(Boolean);
      let start = projectStart;
      if (depSchedules.length) {
        const latest = depSchedules.reduce((m,s) => s.end > m ? s.end : m, depSchedules[0].end);
        start = nextWorkday(addDays(latest,1));
      }
      start = addWorkdays(start, task.lag);
      const end = addWorkdays(start, task.duration-1);
      return schedules[id] = { start, end };
    }
    state.tasks.forEach(t => calc(t.instanceId));
    const finish = state.tasks.length ? state.tasks.reduce((m,t) => schedules[t.instanceId].end > m ? schedules[t.instanceId].end : m, schedules[state.tasks[0].instanceId].end) : projectStart;
    return scheduleCache = { schedules, finish, warnings };
  }

  function formatTaskDates(id) { const s = computeSchedule().schedules[id]; return s ? `${shortDate(s.start)} → ${shortDate(s.end)}` : ''; }
  function personOptions(selected) { return peopleNames.map(n => `<option value="${A.escapeHtml(n)}" ${selected === n ? 'selected' : ''}>${A.escapeHtml(n)}</option>`).join(''); }
  function shortName(name) { const p = name.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : name; }

  function exportJson() {
    const payload = { projectName: state.projectName, startDate: state.startDate, deadline: state.deadline, exportedAt: new Date().toISOString(), tasks: state.tasks.map(t => ({ ...t, schedule: serialSchedule(t.instanceId) })) };
    download(`${safeName(state.projectName)}_ito_plan.json`, JSON.stringify(payload,null,2), 'application/json'); toast('JSON-план выгружен');
  }
  function exportCsv() {
    const header = ['№','Этап','Задача','Исполнитель','Проверяющий','Принимающий','Начало','Окончание','Длительность, раб. дн.','Предшественники','Прогресс'];
    const rows = state.tasks.map((t,i) => { const s = computeSchedule().schedules[t.instanceId]; return [i+1,A.phaseName(t.phase),t.title,t.owner,t.reviewer,t.approver,dateToISO(s.start),dateToISO(s.end),t.duration,t.dependencies.map(id => state.tasks.find(x => x.instanceId === id)?.title || '').join(' | '),`${t.progress}%`]; });
    const csv = '\ufeff' + [header,...rows].map(r => r.map(csvCell).join(';')).join('\n');
    download(`${safeName(state.projectName)}_ito_plan.csv`, csv, 'text/csv;charset=utf-8'); toast('CSV-график выгружен');
  }
  function serialSchedule(id) { const s = computeSchedule().schedules[id]; return { start:dateToISO(s.start), end:dateToISO(s.end) }; }
  function csvCell(v) { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }
  function safeName(s) { return (s || 'project').replace(/[^a-zа-яё0-9_-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,80); }
  function download(name, content, type) { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); }

  function toast(text) { let el=document.getElementById('toast'); if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el);} el.textContent=text;el.classList.add('show');clearTimeout(window.__itoToast);window.__itoToast=setTimeout(()=>el.classList.remove('show'),2300); }
  function isoToDate(v) { const [y,m,d] = String(v || dateToISO(new Date())).split('-').map(Number); return new Date(y,m-1,d,12); }
  function dateToISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function addDays(d,n) { const x=new Date(d);x.setDate(x.getDate()+n);return x; }
  function isWeekend(d) { return d.getDay()===0 || d.getDay()===6; }
  function isWorkday(d) { return !isWeekend(d); }
  function nextWorkday(d) { let x=new Date(d); while(!isWorkday(x)) x=addDays(x,1); return x; }
  function addWorkdays(d,n) { let x=nextWorkday(d); let left=Math.max(0,n); while(left>0){x=addDays(x,1);if(isWorkday(x))left--;}return x; }
  function diffDays(a,b) { return Math.round((new Date(a.getFullYear(),a.getMonth(),a.getDate())-new Date(b.getFullYear(),b.getMonth(),b.getDate()))/86400000); }
  function countWorkdays(a,b) { let n=0,x=new Date(a); while(x<=b){if(isWorkday(x))n++;x=addDays(x,1);}return n; }
  function maxDate(a,b) { return a>b?a:b; }
  function sameDay(a,b) { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
  const months=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  function shortDate(d) { return `${d.getDate()} ${months[d.getMonth()]}`; }
  function formatDate(d) { return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`; }
  function fullDate(d) { return d.toLocaleDateString('ru-RU',{weekday:'short',day:'numeric',month:'long',year:'numeric'}); }
  function dateRangeLabel(a,b) { return a.getMonth()===b.getMonth()?`${a.getDate()}–${b.getDate()} ${months[a.getMonth()]}`:`${a.getDate()} ${months[a.getMonth()]} – ${b.getDate()} ${months[b.getMonth()]}`; }

  document.addEventListener('DOMContentLoaded', init);
})();
