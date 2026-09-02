(() => {
  'use strict';
  const C = window.NWLClassifier;
  const STORAGE_KEY = 'needwantlater.items.v1';
  const PREF_KEY = 'needwantlater.seeded.v1';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  const seed = [
    'Надо удалить зубы мудрости примерно 20-40к',
    'Мне нужны очки',
    'Нужен новый телефон примерно 80-100к',
    'Надо поставить брекеты примерно 200-300к',
    'Хочу мониторы в студию примерно 30к',
    'Хочу новую куртку примерно 10-20к',
    'Хочу татуировку',
    'Когда-нибудь путешествие в Исландию',
    'Потом проектор для дома примерно 60к',
    'Когда-нибудь гитару Fender Telecaster примерно 120к'
  ].map((text,i) => ({ id: crypto.randomUUID ? crypto.randomUUID() : `seed-${i}-${Date.now()}`, ...C.classify(text), sourceText:text, createdAt:Date.now()-i*1000, closed:false }));

  let items = loadItems();
  let editingId = null;
  let preview = null;
  let detailType = null;
  let toastTimer = null;

  if (!localStorage.getItem(PREF_KEY) && items.length === 0) {
    items = seed;
    localStorage.setItem(PREF_KEY,'1');
    saveItems();
  }

  function loadItems() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }
  function saveItems() { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  function activeItems() { return items.filter(x => !x.closed); }
  function esc(v='') { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function typeLabel(type) { return type === 'need' ? 'NEED' : type === 'want' ? 'WANT' : 'LATER'; }
  function typeRu(type) { return type === 'need' ? 'нужно' : type === 'want' ? 'хочу' : 'потом'; }

  function render() {
    renderSummary();
    renderBoard();
    renderSearch();
    renderClosed();
  }

  function renderSummary() {
    const act = activeItems();
    $('#totalCount').textContent = act.length;
    $('#typeSummary').innerHTML = ['need','want','later'].map(type => {
      const count = act.filter(x=>x.type===type).length;
      return `<div class="type-stat ${type}"><strong>${count}</strong><span>${typeLabel(type)}</span><small>${typeRu(type)}</small></div>`;
    }).join('');
    const known = act.filter(x => Number.isFinite(x.priceMin) && Number.isFinite(x.priceMax));
    const min = known.reduce((s,x)=>s+x.priceMin,0);
    const max = known.reduce((s,x)=>s+x.priceMax,0);
    $('#moneySummary').textContent = known.length ? moneySummary(min,max) : '—';
    const unknown = act.length-known.length;
    $('#unknownSummary').textContent = unknown ? `${unknown} без оценки` : 'все цены оценены';
  }

  function moneySummary(min,max) {
    const short = n => {
      if (n >= 1000000) return `${(n/1000000).toFixed(n%1000000?1:0)}M`;
      if (n >= 1000) return `${Math.round(n/1000)}K`;
      return String(n);
    };
    return min === max ? `≈${short(min)} ₽` : `≈${short(min)}–${short(max)} ₽`;
  }

  function renderBoard() {
    const board = $('#board');
    const groups = [
      ['need','Сначала важное'], ['want','Сначала ощутимое'], ['later','На потом']
    ];
    board.innerHTML = groups.map(([type,note]) => {
      const group = activeItems().filter(x=>x.type===type).sort(sortForBoard);
      if (!group.length) return '';
      return `<section class="board-section">
        <div class="board-head"><div class="board-title ${type}">${typeLabel(type)} <span class="count-pill">${group.length}</span></div><span class="sort-note">${note}</span></div>
        <div class="card-grid">${group.map((item,i)=>cardHTML(item,i)).join('')}</div>
      </section>`;
    }).join('') || `<div class="empty-state">Здесь пока пусто. Нажми «+» и напиши первую вещь, которая занимает место в голове.</div>`;
    $$('.item-card',board).forEach(el => el.addEventListener('click', e => {
      if (e.target.closest('.card-menu')) return;
      openDetail(el.dataset.id);
    }));
    $$('.card-menu',board).forEach(btn => btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.closest('.item-card').dataset.id;
      openDetail(id);
    }));
  }

  function sortForBoard(a,b) {
    const aKnown = Number.isFinite(a.priceMax), bKnown = Number.isFinite(b.priceMax);
    if (aKnown && bKnown) return (b.priceMax||0)-(a.priceMax||0);
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    return (b.createdAt||0)-(a.createdAt||0);
  }

  function cardHTML(item,index) {
    const compact = item.type !== 'need' || index > 1;
    const type = typeLabel(item.type);
    return `<article class="item-card ${compact?'compact':''}" data-id="${esc(item.id)}" style="--c1:${esc(item.c1||'#4b2497')};--c2:${esc(item.c2||'#24144f')}">
      <button class="card-menu" aria-label="Открыть детали">•••</button>
      <div class="card-content">
        <div class="card-icon">${esc(item.icon||'◌')}</div>
        <h3 class="card-title">${esc(item.title)}</h3>
        <span class="card-chip">${type} · ${esc(item.category)}</span>
        <div class="card-price">${esc(item.priceText||'цена неизвестна')}</div>
      </div>
      <div class="card-visual" aria-hidden="true">${esc(item.icon||'◌')}</div>
      <div class="card-action"><span class="action-arrow">→</span><span>${esc(item.next||'Посмотреть варианты')}</span></div>
    </article>`;
  }

  function renderSearch() {
    const q = ($('#searchInput').value || '').trim().toLowerCase();
    const pool = activeItems().filter(item => !q || [item.title,item.category,item.next,item.priceText].join(' ').toLowerCase().includes(q));
    $('#searchResults').innerHTML = pool.length ? pool.map(rowHTML).join('') : `<div class="empty-state">Ничего не найдено.</div>`;
    $$('.list-row',$('#searchResults')).forEach(el=>el.addEventListener('click',()=>openDetail(el.dataset.id)));
  }

  function renderClosed() {
    const pool = items.filter(x=>x.closed).sort((a,b)=>(b.closedAt||0)-(a.closedAt||0));
    $('#closedList').innerHTML = pool.length ? pool.map(rowHTML).join('') : `<div class="empty-state">Закрытых вещей пока нет.</div>`;
    $$('.list-row',$('#closedList')).forEach(el=>el.addEventListener('click',()=>openDetail(el.dataset.id)));
  }

  function rowHTML(item) {
    return `<article class="list-row" data-id="${esc(item.id)}"><div class="list-row-icon">${esc(item.icon||'◌')}</div><div class="list-row-main"><strong>${esc(item.title)}</strong><span>${typeLabel(item.type)} · ${esc(item.category)} · ${esc(item.priceText||'цена неизвестна')}</span></div><span>›</span></article>`;
  }

  function showView(name) {
    $$('.view').forEach(v=>v.classList.remove('active'));
    $$('.nav-item[data-view]').forEach(b=>b.classList.remove('active'));
    $(`#${name}View`).classList.add('active');
    $(`.nav-item[data-view="${name}"]`)?.classList.add('active');
    if (name === 'search') setTimeout(()=>$('#searchInput').focus(),100);
  }

  function openSheet(sheet) {
    $('#sheetBackdrop').hidden = false;
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeSheets() {
    $('#sheetBackdrop').hidden = true;
    $$('.bottom-sheet').forEach(s=>s.hidden=true);
    document.body.style.overflow = '';
  }

  function startAdd() {
    preview = null;
    $('#quickInput').value='';
    $('#captureStep').classList.add('active');
    $('#previewStep').classList.remove('active');
    openSheet($('#addSheet'));
    setTimeout(()=>$('#quickInput').focus(),120);
  }

  function analyzeInput() {
    const text = $('#quickInput').value.trim();
    if (!text) { toast('Напиши, что у тебя на уме'); return; }
    preview = C.classify(text);
    preview.sourceText = text;
    fillPreview(preview);
    $('#captureStep').classList.remove('active');
    $('#previewStep').classList.add('active');
  }

  function fillPreview(x) {
    $('#previewIcon').textContent=x.icon;
    $('#previewType').textContent=typeLabel(x.type);
    $('#previewTitleText').textContent=x.title;
    $('#previewCategoryText').textContent=x.category;
    $('#previewTitleInput').value=x.title;
    $('#previewPriceInput').value=x.priceText === 'цена неизвестна' ? '' : x.priceText;
    $('#previewCategoryInput').value=x.category;
    $('#previewNextInput').value=x.next;
    $$('[data-type-choice]').forEach(b=>b.classList.toggle('selected',b.dataset.typeChoice===x.type));
  }

  function setPreviewType(type) {
    if (!preview) return;
    preview.type=type;
    const [c1,c2]=C.palette(type,preview.category); preview.c1=c1; preview.c2=c2;
    fillPreview({...preview,title:$('#previewTitleInput').value,priceText:$('#previewPriceInput').value||'цена неизвестна',category:$('#previewCategoryInput').value,next:$('#previewNextInput').value});
  }

  function submitPreview(e) {
    e.preventDefault();
    if (!preview) return;
    const priceRaw=$('#previewPriceInput').value.trim();
    const parsed=priceRaw ? C.parsePriceInput(priceRaw) : {kind:'unknown',min:null,max:null,raw:'цена неизвестна'};
    const category=$('#previewCategoryInput').value.trim()||preview.category;
    const [c1,c2]=C.palette(preview.type,category);
    items.unshift({
      id:crypto.randomUUID ? crypto.randomUUID() : `i-${Date.now()}`,
      ...preview,
      title:$('#previewTitleInput').value.trim(), category,
      priceText:parsed.kind==='unknown' ? (priceRaw||'цена неизвестна') : parsed.raw,
      priceMin:parsed.min, priceMax:parsed.max,
      next:$('#previewNextInput').value.trim()||'Посмотреть варианты', c1,c2,
      createdAt:Date.now(),closed:false
    });
    saveItems(); render(); closeSheets(); showView('overview'); toast('Добавлено');
  }

  function openDetail(id) {
    const item=items.find(x=>x.id===id); if(!item) return;
    editingId=id; detailType=item.type;
    $('#detailMeta').textContent=`${typeLabel(item.type)} · ${item.category}`;
    $('#detailTitle').textContent=item.title;
    $('#detailVisual').textContent=item.icon||'◌';
    $('#detailVisual').style.background=`linear-gradient(145deg,${item.c1||'#4b2497'},${item.c2||'#162a60'})`;
    $('#detailTitleInput').value=item.title;
    $('#detailPriceInput').value=item.priceText==='цена неизвестна'?'':item.priceText;
    $('#detailCategoryInput').value=item.category;
    $('#detailNextInput').value=item.next||'';
    $('#detailNoteInput').value=item.note||'';
    $('#toggleClosed').textContent=item.closed?'Вернуть в активные':'Закрыть';
    $$('[data-detail-type]').forEach(b=>b.classList.toggle('selected',b.dataset.detailType===item.type));
    openSheet($('#detailSheet'));
  }

  function submitDetail(e) {
    e.preventDefault();
    const item=items.find(x=>x.id===editingId); if(!item) return;
    const category=$('#detailCategoryInput').value.trim()||'Личное';
    const priceRaw=$('#detailPriceInput').value.trim();
    const parsed=priceRaw ? C.parsePriceInput(priceRaw) : {kind:'unknown',min:null,max:null,raw:'цена неизвестна'};
    const cat=C.inferCategory(category+' '+$('#detailTitleInput').value);
    const [c1,c2]=C.palette(detailType,category);
    Object.assign(item,{
      title:$('#detailTitleInput').value.trim(),type:detailType,category,
      icon: cat.score ? cat.icon : item.icon,
      priceText:parsed.kind==='unknown'?(priceRaw||'цена неизвестна'):parsed.raw,
      priceMin:parsed.min,priceMax:parsed.max,
      next:$('#detailNextInput').value.trim(),note:$('#detailNoteInput').value.trim(),c1,c2
    });
    saveItems(); render(); closeSheets(); toast('Сохранено');
  }

  function toggleClosed() {
    const item=items.find(x=>x.id===editingId); if(!item) return;
    item.closed=!item.closed; item.closedAt=item.closed?Date.now():null;
    saveItems(); render(); closeSheets(); toast(item.closed?'Закрыто':'Возвращено');
  }
  function deleteCurrent() {
    if(!editingId) return;
    if(!confirm('Удалить эту вещь?')) return;
    items=items.filter(x=>x.id!==editingId); saveItems(); render(); closeSheets(); toast('Удалено');
  }

  function toast(msg) {
    const el=$('#toast'); el.textContent=msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),1600);
  }

  // Events
  $$('.nav-item[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $('#openAdd').addEventListener('click',startAdd);
  $('#analyzeButton').addEventListener('click',analyzeInput);
  $('#quickInput').addEventListener('keydown',e=>{ if((e.metaKey||e.ctrlKey)&&e.key==='Enter') analyzeInput(); });
  $('#backToCapture').addEventListener('click',()=>{ $('#previewStep').classList.remove('active'); $('#captureStep').classList.add('active'); });
  $('#previewStep').addEventListener('submit',submitPreview);
  $$('[data-type-choice]').forEach(b=>b.addEventListener('click',()=>setPreviewType(b.dataset.typeChoice)));
  $$('[data-detail-type]').forEach(b=>b.addEventListener('click',()=>{ detailType=b.dataset.detailType; $$('[data-detail-type]').forEach(x=>x.classList.toggle('selected',x===b)); }));
  $('#detailForm').addEventListener('submit',submitDetail);
  $('#toggleClosed').addEventListener('click',toggleClosed);
  $('#deleteItem').addEventListener('click',deleteCurrent);
  $('#searchInput').addEventListener('input',renderSearch);
  $('[data-close-sheet]', $('#addSheet')).addEventListener('click',closeSheets);
  $('[data-close-sheet]', $('#detailSheet')).addEventListener('click',closeSheets);
  $('#sheetBackdrop').addEventListener('click',closeSheets);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeSheets(); });

  if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  render();
})();
