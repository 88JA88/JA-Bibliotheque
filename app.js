(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'ma-bibliotheque-v6';
  const LIBRARIES_KEY = 'ma-bibliotheque-libraries-v6';
  const fresh = (libraryName='Ma bibliothèque') => ({version:5, libraryName, cols:14, rows:10, fields:['Paramètre 1','Prêté à'], cases:[], separators:[], books:[], facadeLocked:false, facadeScale:14});
  let data = fresh(), libraries = [], activeLibraryId = null, mode = 'select', start = null, selectedCases = new Set(), selectedSeparators = new Set(), clipboard = null, selectedBook = null, selectedLocation = null, placing = false, removingBook = false, history = [], editing = null, sortBy = 'title';
  const id = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const clone = value => JSON.parse(JSON.stringify(value));
  const onGrid = Number.isInteger;
  function columnName(index) { let name=''; for (let n=index+1; n>0; n=Math.floor((n-1)/26)) name=String.fromCharCode(65+(n-1)%26)+name; return name; }
  function locationIndex(x,y) { return `${columnName(x)}-${y+1}`; }
  function matchesLocation(location, selected, c) {
    return !!location && !!selected && location.x === selected.x && location.y === selected.y;
  }

  function valid(v) {
    if (v && ((v.facadeLocked !== undefined && typeof v.facadeLocked !== 'boolean') || (v.facadeScale !== undefined && (!Number.isFinite(v.facadeScale) || v.facadeScale < 12 || v.facadeScale > 120)))) return false;
    if (!v || v.version !== 5 || typeof v.libraryName !== 'string' || !v.libraryName.trim() || !Number.isInteger(v.cols) || v.cols < 1 || v.cols > 60 || !Number.isInteger(v.rows) || v.rows < 1 || v.rows > 60 || !Array.isArray(v.fields) || v.fields.length !== 2 || !v.fields.every(x => typeof x === 'string' && x.trim()) || !Array.isArray(v.cases) || v.cases.length || !Array.isArray(v.separators) || !Array.isArray(v.books)) return false;
    const ids = new Set();
    for (const c of v.cases) { if (!c || typeof c.id !== 'string' || ids.has(c.id) || ![c.x,c.y,c.w,c.h].every(onGrid) || c.x < 0 || c.y < 0 || c.w < 1 || c.h < 1 || c.x+c.w > v.cols || c.y+c.h > v.rows) return false; ids.add(c.id); }
    const separatorIds = new Set();
    for (const s of v.separators) { if (!s || typeof s.id !== 'string' || separatorIds.has(s.id) || !['horizontal','vertical'].includes(s.orientation) || ![s.x,s.y,s.length].every(onGrid) || s.length < 1 || s.x < 0 || s.y < 0 || (s.orientation==='horizontal' && (s.y > v.rows || s.x+s.length > v.cols)) || (s.orientation==='vertical' && (s.x > v.cols || s.y+s.length > v.rows))) return false; separatorIds.add(s.id); }
    const bookIds = new Set();
    for (const b of v.books) { if (!b || typeof b.id !== 'string' || bookIds.has(b.id) || !['title','author','param1','param2'].every(k => typeof b[k] === 'string') || !b.title.trim()) return false; bookIds.add(b.id); if (b.location != null) { const l=b.location; if (!Number.isInteger(l.x) || !Number.isInteger(l.y) || l.x < 0 || l.y < 0 || l.x >= v.cols || l.y >= v.rows) return false; } }
    return true;
  }
  function validLibraries(v) { return !!v && v.version===5 && typeof v.activeId==='string' && Array.isArray(v.libraries) && v.libraries.length && v.libraries.every(l=>l && typeof l.id==='string' && typeof l.name==='string' && l.name.trim() && valid(l.data)) && v.libraries.some(l=>l.id===v.activeId); }
  function activeLibrary() { return libraries.find(l=>l.id===activeLibraryId); }
  function isEmptyLibrary(library) { const d=library?.data; return !!d && !d.cases.length && !d.separators.length && !d.books.length && !d.facadeLocked; }
  function filenameFromLibraryName(name) { const clean=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); return `${clean||'ma-bibliotheque'}.json`; }
  function uniqueLibraryName(name) { const names=new Set(libraries.map(l=>l.name)); if(!names.has(name))return name; for(let n=2;;n++){const candidate=`${name} ${n}`;if(!names.has(candidate))return candidate;} }
  let needsInitialSave=false;
  try {
    let invalidLibraries=false;
    const savedLibraries=localStorage.getItem(LIBRARIES_KEY);
    if(savedLibraries){try{const parsed=JSON.parse(savedLibraries);if(validLibraries(parsed)){libraries=parsed.libraries;activeLibraryId=parsed.activeId;data=activeLibrary().data;}else invalidLibraries=true;}catch(_){invalidLibraries=true;}}
    if(!libraries.length){const saved=localStorage.getItem(KEY);if(saved){try{const parsed=JSON.parse(saved);if(valid(parsed))data=parsed;else invalidLibraries=true;}catch(_){invalidLibraries=true;}}else needsInitialSave=true;activeLibraryId=id();libraries=[{id:activeLibraryId,name:data.libraryName,data}];needsInitialSave=true;}
    if(invalidLibraries){$('save-status').textContent='⚠ Données enregistrées illisibles : importez une sauvegarde';setTimeout(()=>alert('Certaines données enregistrées ne sont pas valides. Vous pouvez importer une sauvegarde.'),0);}
  } catch (_) { $('save-status').textContent = location.protocol === 'file:' ? '⚠ Fichier local : sauvegarde non fiable' : '⚠ Stockage local inaccessible : exportez vos données'; setTimeout(() => alert('Impossible de lire les données enregistrées sur cet appareil. La façade affichée peut ne pas être votre dernière version.'), 0); }
  if (data.facadeLocked) mode='view';
  function save() { try { const current=activeLibrary();if(current)current.data=data;localStorage.setItem(LIBRARIES_KEY,JSON.stringify({version:5,activeId:activeLibraryId,libraries}));localStorage.setItem(KEY, JSON.stringify(data)); $('save-status').textContent = location.protocol === 'file:' ? '⚠ Fichier local : sauvegarde non fiable — utilisez la PWA publiée' : '● Enregistré sur cet appareil'; } catch (_) { $('save-status').textContent = location.protocol === 'file:' ? '⚠ Fichier local : enregistrement impossible — exportez vos données' : '⚠ Enregistrement impossible : exportez vos données'; } }
  if (needsInitialSave) save();
  function checkpoint() { history.push(clone(data)); if (history.length > 30) history.shift(); }
  function changed() { save(); render(); }
  function message(s) { const t=$('toast'); t.textContent=s; t.classList.add('show'); clearTimeout(message.timer); message.timer=setTimeout(()=>t.classList.remove('show'),3000); }
  function overlap(a,b) { return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
  function setMode(next) { mode=next; start=null; placing=false; removingBook=false; if(next !== 'select'){selectedCases.clear();selectedSeparators.clear();} render(); }
  function renderLibraries(){const selector=$('library-selector');selector.replaceChildren(...libraries.map(l=>new Option(l.name,l.id)));selector.value=activeLibraryId;}
  function switchLibrary(nextId){if(nextId===activeLibraryId)return;save();const next=libraries.find(l=>l.id===nextId);if(!next)return;activeLibraryId=nextId;data=next.data;mode=data.facadeLocked?'view':'select';start=null;selectedCases.clear();selectedSeparators.clear();clipboard=null;selectedBook=null;selectedLocation=null;placing=false;removingBook=false;history=[];render();message(`Bibliothèque « ${next.name} » affichée.`);}
  function render() {
    renderLibraries();
    $('cols').value=data.cols; $('rows').value=data.rows;
    $('grid-settings').hidden=!!data.facadeLocked; $('toolbar').hidden=!!data.facadeLocked;
    $('save-facade').textContent=data.facadeLocked ? 'Modifier la façade' : 'Enregistrer la façade';
    const activeBook=data.books.find(b=>b.id===selectedBook);
    const hasLocation=!!activeBook?.location;
    $('place-book').disabled=!activeBook || hasLocation;
    $('place-book').textContent=hasLocation ? 'Placement enregistré' : 'Placer';
    $('place-book').title=activeBook ? (hasLocation ? `Emplacement de ${activeBook.title} enregistré` : `Placer ${activeBook.title}`) : 'Sélectionnez d’abord un livre';
    $('move-book').disabled=!hasLocation;
    $('move-book').title=hasLocation ? `Déplacer ${activeBook.title}` : 'Sélectionnez un livre déjà placé';
    document.querySelectorAll('.mode').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode && !placing));
    $('undo').disabled=!history.length; $('delete-selection').disabled=!selectedSeparators.size;
    $('book-count').textContent=data.books.length;
    const selectionCount=selectedCases.size+selectedSeparators.size;
    $('hint').textContent=placing ? 'Choisissez une petite case pour placer ce livre, ou cliquez hors de la grille pour le laisser sans emplacement.' : data.facadeLocked ? '' : mode==='line-horizontal' ? (start ? 'Choisissez un croisement sur la même ligne pour terminer la séparation.' : 'Choisissez le premier croisement de la séparation horizontale.') : mode==='line-vertical' ? (start ? 'Choisissez un croisement sur la même colonne pour terminer la séparation.' : 'Choisissez le premier croisement de la séparation verticale.') : selectionCount ? `${selectionCount} ligne${selectionCount > 1 ? 's sélectionnées' : ' sélectionnée'} — choisissez « Supprimer » ou appuyez sur Suppr.` : 'Cliquez sur une ligne rouge pour la sélectionner.';
    renderCanvas(); renderBooks();
  }
  function renderCanvas() {
    const canvas=$('canvas'); canvas.replaceChildren();
    const step=data.facadeScale || 14; canvas.style.width=(data.cols*step)+'px'; canvas.style.height=(data.rows*step)+'px';
    const book=data.books.find(b=>b.id===selectedBook), shownLocation=selectedLocation || book?.location;
    data.cases.forEach(c=>{
      const el=document.createElement('div'); el.className='case'+(selectedCases.has(c.id)?' selected':'')+(shownLocation?.caseId===c.id?' found':'');
      Object.assign(el.style,{left:(c.x*step)+'px',top:(c.y*step)+'px',width:(c.w*step)+'px',height:(c.h*step)+'px'});
      if (placing || data.facadeLocked || (shownLocation?.caseId===c.id)) {
        for(let row=0; row<c.h; row++) for(let col=0; col<c.w; col++) {
          const x=c.x+col, y=c.y+row;
          const highlighted=matchesLocation(shownLocation,{caseId:c.id,x,y},c);
          const btn=document.createElement('button'); btn.type='button'; btn.className='case-cell'+(highlighted?' highlight':'');
          Object.assign(btn.style,{left:(col/c.w*100)+'%',top:(row/c.h*100)+'%',width:(100/c.w)+'%',height:(100/c.h)+'%'});
          btn.setAttribute('aria-label',`Emplacement ${locationIndex(x,y)}`);btn.title=locationIndex(x,y);
          if(placing) btn.addEventListener('click',()=>{checkpoint();book.location={caseId:c.id,x,y};selectedLocation=null;placing=false;changed();message('Placement enregistré.');});
          else if(data.facadeLocked) btn.addEventListener('click',()=>{selectedBook=null;selectedLocation={caseId:c.id,x,y};render();});
          else btn.style.pointerEvents='none';
          el.append(btn);
        }
      }
      if(mode==='select' && !placing){const btn=document.createElement('button');btn.type='button';btn.className='case-select';btn.setAttribute('aria-label',`Sélectionner la case en colonne ${c.x+1}, ligne ${c.y+1}, ${c.w} par ${c.h} petites cases`);btn.setAttribute('aria-pressed',selectedCases.has(c.id));btn.onclick=(event)=>{if(event.shiftKey){selectedCases.has(c.id)?selectedCases.delete(c.id):selectedCases.add(c.id);}else{const wasOnlySelected=selectedCases.size===1 && selectedCases.has(c.id) && !selectedSeparators.size;selectedCases.clear();selectedSeparators.clear();if(!wasOnlySelected)selectedCases.add(c.id);}render();$('canvas').focus({preventScroll:true});};el.append(btn);}
      canvas.append(el);
    });
    for(let x=0;x<data.cols;x++){const label=document.createElement('span');label.className='axis-label axis-column';label.style.left=((x+0.5)*step)+'px';label.textContent=columnName(x);canvas.append(label);}
    for(let y=0;y<data.rows;y++){const label=document.createElement('span');label.className='axis-label axis-row';label.style.top=((y+0.5)*step)+'px';label.textContent=String(y+1);canvas.append(label);}
    for(let x=0;x<=data.cols;x++){const line=document.createElement('span');line.className='grid-line vertical';line.style.left=(x*step)+'px';canvas.append(line);}
    for(let y=0;y<=data.rows;y++){const line=document.createElement('span');line.className='grid-line horizontal';line.style.top=(y*step)+'px';canvas.append(line);}
    data.separators.forEach(s=>{const selectable=mode==='select'&&!placing;const line=document.createElement(selectable?'button':'span');if(selectable)line.type='button';line.className=`separator ${s.orientation}${selectable?' selectable':''}${selectedSeparators.has(s.id)?' selected':''}`;line.style.left=(s.x*step)+'px';line.style.top=(s.y*step)+'px';if(s.orientation==='horizontal')line.style.width=(s.length*step)+'px';else line.style.height=(s.length*step)+'px';if(selectable){line.setAttribute('aria-label',`Sélectionner la ligne rouge ${s.orientation==='horizontal'?'horizontale':'verticale'}`);line.setAttribute('aria-pressed',selectedSeparators.has(s.id));line.onclick=event=>{if(event.shiftKey){selectedSeparators.has(s.id)?selectedSeparators.delete(s.id):selectedSeparators.add(s.id);}else{const wasOnlySelected=selectedSeparators.size===1&&selectedSeparators.has(s.id)&&!selectedCases.size;selectedCases.clear();selectedSeparators.clear();if(!wasOnlySelected)selectedSeparators.add(s.id);}render();$('canvas').focus({preventScroll:true});};}canvas.append(line);});
    if(placing || data.facadeLocked || shownLocation) for(let y=0;y<data.rows;y++) for(let x=0;x<data.cols;x++){const highlighted=matchesLocation(shownLocation,{x,y});const cell=document.createElement('button');cell.type='button';cell.className='grid-cell'+(highlighted?' highlight':'');Object.assign(cell.style,{left:(x*step)+'px',top:(y*step)+'px',width:step+'px',height:step+'px'});cell.setAttribute('aria-label',`Emplacement ${locationIndex(x,y)}`);cell.title=locationIndex(x,y);if(placing)cell.onclick=()=>{checkpoint();book.location={x,y};selectedLocation=null;placing=false;removingBook=false;changed();message('Placement enregistré.');};else cell.onclick=()=>{selectedBook=null;selectedLocation={x,y};render();};canvas.append(cell);}
    if(data.facadeLocked){const handle=document.createElement('button');handle.type='button';handle.className='scale-handle';handle.setAttribute('aria-label','Agrandir ou réduire la façade');handle.title='Étirez pour ajuster la taille';handle.textContent='↘';handle.onpointerdown=startScale;handle.onkeydown=scaleByKeyboard;canvas.append(handle);}
    for(let y=0;y<=data.rows;y++) for(let x=0;x<=data.cols;x++) {
      if(!placing && (mode==='line-horizontal'||mode==='line-vertical')) { const button=document.createElement('button'); button.type='button'; button.className='intersection'+(start && start.x===x && start.y===y?' start':''); button.style.left=x*step+'px';button.style.top=y*step+'px';button.setAttribute('aria-label',`Croisement à ${x} petites cases du bord gauche et ${y} du haut`); button.onclick=()=>intersection(x,y);canvas.append(button); }
    }
  }
  function intersection(x,y) {
    if(mode==='paste') {
      const copies=clipboard.map(c=>({...c,id:id(),x:c.x+x,y:c.y+y}));
      if(copies.some(c=>c.x+c.w>data.cols || c.y+c.h>data.rows)){message('La copie dépasse de la grille. Choisissez un autre croisement.');return;}
      if(copies.some(c=>data.cases.some(existing=>overlap(c,existing))) && !confirm('La copie recouvre une ou plusieurs cases existantes. Voulez-vous quand même la coller ?')) return;
      checkpoint();data.cases.push(...copies);selectedCases=new Set(copies.length===1?[copies[0].id]:[]);mode='select';changed();message('Cases collées.');return;
    }
    if(mode==='line-horizontal'||mode==='line-vertical') {
      if(!start){start={x,y};render();return;}
      const horizontal=mode==='line-horizontal';
      if((horizontal && start.y!==y)||(!horizontal && start.x!==x)){message(horizontal?'Choisissez un croisement sur la même ligne.':'Choisissez un croisement sur la même colonne.');return;}
      const length=horizontal?Math.abs(x-start.x):Math.abs(y-start.y);
      if(!length){message('Choisissez un autre croisement.');return;}
      checkpoint();data.separators.push({id:id(),orientation:horizontal?'horizontal':'vertical',x:horizontal?Math.min(x,start.x):x,y:horizontal?y:Math.min(y,start.y),length});start=null;changed();message('Séparation ajoutée.');return;
    }
    if(!start){start={x,y};render();return;}
    if(start.x===x || start.y===y){message('Choisissez un croisement sur une autre ligne et une autre colonne.');return;}
    const c={id:id(),x:Math.min(x,start.x),y:Math.min(y,start.y),w:Math.abs(x-start.x),h:Math.abs(y-start.y)};
    if(data.cases.some(existing=>overlap(c,existing)) && !confirm('Cette case recouvre une case existante. Voulez-vous quand même la dessiner ?')) return;
    checkpoint();data.cases.push(c);start=null;changed();
  }
  function renderBooks(){
    const fields=[['all','Tous les champs'],['title','Titre'],['author','Auteur'],['param1',data.fields[0]],['param2','Prêté à']];
    const filter=$('filter-field'), oldFilter=filter.value||'all';
    filter.replaceChildren(...fields.map(([v,l])=>new Option(l,v)));filter.value=oldFilter;
    document.querySelectorAll('[data-sort]').forEach(button=>{const active=button.dataset.sort===sortBy;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    const query=$('search').value.trim().toLocaleLowerCase('fr');
    $('search-button').title=query ? 'Effacer la recherche et afficher tous les livres' : 'Saisir une recherche';
    const books=data.books.filter(b=>!query || (filter.value==='all'?['title','author','param1','param2']:[filter.value]).some(k=>b[k].toLocaleLowerCase('fr').includes(query))).sort((a,b)=>a[sortBy].localeCompare(b[sortBy],'fr',{sensitivity:'base'}));
    const list=$('books');list.replaceChildren();
    if(!books.length){const empty=document.createElement('div');empty.className='empty';const strong=document.createElement('strong');strong.textContent=data.books.length?'Aucun livre trouvé':'Votre catalogue commence ici';empty.append(strong,document.createTextNode(data.books.length?'Essayez une autre recherche.':'Ajoutez votre premier livre pour le retrouver facilement.'));list.append(empty);return;}
    books.forEach(b=>{
      const row=document.createElement('div');row.className='book'+(b.param2.trim()?' loaned':'')+(selectedBook===b.id || (selectedLocation && matchesLocation(b.location,selectedLocation))?' selected':'');
      const main=document.createElement('button');main.type='button';main.className='book-main';main.textContent=b.title;main.setAttribute('aria-label',`Ouvrir la fiche de ${b.title}`);
      const selectBook=()=>{selectedBook=b.id;selectedLocation=null;placing=false;removingBook=false;start=null;render();};
      let holdTimer=null, touchStart=null, held=false;
      const cancelHold=()=>{clearTimeout(holdTimer);holdTimer=null;};
      main.onclick=()=>{if(held){held=false;return;}selectBook();};
      main.oncontextmenu=event=>{event.preventDefault();cancelHold();if($('details-dialog').open)return;selectBook();showBookDetails(b);};
      main.onpointerdown=event=>{if(event.pointerType!=='touch')return;held=false;touchStart={x:event.clientX,y:event.clientY};cancelHold();holdTimer=setTimeout(()=>{held=true;selectBook();showBookDetails(b);},600);};
      main.onpointermove=event=>{if(touchStart && Math.hypot(event.clientX-touchStart.x,event.clientY-touchStart.y)>10)cancelHold();};
      main.onpointerup=()=>{cancelHold();touchStart=null;};
      main.onpointercancel=()=>{cancelHold();touchStart=null;};
      row.append(main);list.append(row);
    });
  }
  function showBookDetails(b){
    $('details-title').textContent=b.title;
    $('details-author').textContent=b.author || 'Non renseigné';
    $('details-param1-label').textContent=data.fields[0];$('details-param1').textContent=b.param1 || 'Non renseigné';
    $('details-param2-label').textContent='Prêté à';$('details-param2').textContent=b.param2 || 'Non renseigné';
    $('details-location').textContent=b.location ? locationIndex(b.location.x,b.location.y) : 'Non renseigné';
    $('details-dialog').showModal();
  }
  function openBook(book){editing=book?.id||null;const f=$('book-form');f.reset();$('dialog-title').textContent=book?'Modifier le livre':'Ajouter un livre';$('param1-label').textContent=data.fields[0];if(book) for(const k of ['title','author','param1','param2']) f.elements[k].value=book[k];$('book-dialog').showModal();f.elements.title.focus();}
  $('save-facade').onclick=()=>{data.facadeLocked=!data.facadeLocked;mode=data.facadeLocked?'view':'select';selectedCases.clear();selectedSeparators.clear();selectedLocation=null;start=null;placing=false;removingBook=false;history=[];changed();message(data.facadeLocked?'Façade enregistrée.':'Vous pouvez modifier la façade.');};
  let scaleDrag=null;
  function startScale(event){if(event.button!==0 && event.pointerType!=='touch')return;event.preventDefault();scaleDrag={id:event.pointerId,x:event.clientX,y:event.clientY,scale:data.facadeScale || 14};$('canvas').setPointerCapture(event.pointerId);}
  function scaleByKeyboard(event){if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(event.key))return;event.preventDefault();data.facadeScale=Math.max(12,Math.min(120,(data.facadeScale||14)+(['ArrowUp','ArrowRight'].includes(event.key)?4:-4)));save();renderCanvas();}
  $('canvas').addEventListener('pointermove',event=>{if(!scaleDrag || event.pointerId!==scaleDrag.id)return;const delta=Math.max((event.clientX-scaleDrag.x)/data.cols,(event.clientY-scaleDrag.y)/data.rows);data.facadeScale=Math.max(12,Math.min(120,Math.round(scaleDrag.scale+delta)));renderCanvas();});
  function finishScale(event){if(!scaleDrag || event.pointerId!==scaleDrag.id)return;const dragId=scaleDrag.id;scaleDrag=null;const canvas=$('canvas');if(canvas.hasPointerCapture?.(dragId))canvas.releasePointerCapture(dragId);save();render();}
  $('canvas').addEventListener('pointerup',finishScale);$('canvas').addEventListener('pointercancel',finishScale);window.addEventListener('pointerup',finishScale);window.addEventListener('pointercancel',finishScale);
  document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  $('resize').onclick=()=>{const cols=Number($('cols').value),rows=Number($('rows').value);if(!Number.isInteger(cols)||!Number.isInteger(rows)||cols<1||rows<1||cols>60||rows>60){alert('Choisissez entre 1 et 60 petites cases pour chaque dimension.');return;}if(data.cases.some(c=>c.x+c.w>cols||c.y+c.h>rows)){alert('Certaines cases dépasseraient de la nouvelle grille. Supprimez-les avant de réduire la grille.');return;}if(cols===data.cols&&rows===data.rows)return;checkpoint();data.cols=cols;data.rows=rows;start=null;changed();};
  function deleteSelectedItems(){if(!selectedCases.size&&!selectedSeparators.size)return;const caseCount=selectedCases.size,separatorCount=selectedSeparators.size;checkpoint();data.cases=data.cases.filter(c=>!selectedCases.has(c.id));data.separators=data.separators.filter(s=>!selectedSeparators.has(s.id));data.books.forEach(b=>{if(b.location && selectedCases.has(b.location.caseId))b.location=null;});selectedCases.clear();selectedSeparators.clear();changed();message(`${caseCount+separatorCount} élément${caseCount+separatorCount>1?'s supprimés':' supprimé'}. Utilisez Annuler pour revenir en arrière.`);}
  window.addEventListener('keydown', event => {
    const isDelete = event.key === 'Backspace' || event.key === 'Delete' || event.code === 'Backspace' || event.code === 'Delete';
    const target = event.target;
    const editingText = target instanceof Element && (target.isContentEditable || !!target.closest('input, textarea, select, dialog'));
    if (data.facadeLocked || !isDelete || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || editingText || placing || (!selectedCases.size&&!selectedSeparators.size)) return;
    event.preventDefault();
    deleteSelectedItems();
  }, true);
  $('delete-selection').onclick=deleteSelectedItems;
  $('undo').onclick=()=>{if(!history.length)return;data=history.pop();selectedCases.clear();selectedSeparators.clear();selectedLocation=null;start=null;placing=false;removingBook=false;mode=data.facadeLocked?'view':'select';if(!data.books.some(b=>b.id===selectedBook))selectedBook=null;changed();message('Dernière modification annulée.');};
  $('canvas-wrap').addEventListener('click',event=>{if(!placing||event.target!==event.currentTarget)return;const book=data.books.find(b=>b.id===selectedBook);if(!book)return;checkpoint();book.location=null;selectedLocation=null;placing=false;removingBook=false;changed();message('Livre sans emplacement sur la grille.');});
  function startPlacement(){const book=data.books.find(b=>b.id===selectedBook);if(!book)return;placing=true;removingBook=false;start=null;selectedCases.clear();selectedSeparators.clear();render();if(matchMedia('(max-width: 900px)').matches) $('facade-title').scrollIntoView({behavior:'smooth',block:'start'});}
  $('place-book').onclick=startPlacement;
  $('move-book').onclick=startPlacement;
  $('details-edit').onclick=()=>{const book=data.books.find(b=>b.id===selectedBook);if(!book)return;$('details-dialog').close();openBook(book);};
  $('details-delete').onclick=()=>{const book=data.books.find(b=>b.id===selectedBook);if(book && confirm(`Supprimer « ${book.title} » ?`)){checkpoint();data.books=data.books.filter(b=>b.id!==book.id);selectedBook=null;placing=false;removingBook=false;$('details-dialog').close();changed();}};
  $('notice-button').onclick=()=>$('notice-dialog').showModal();
  $('new-library').onclick=()=>{const name=prompt('Nom de la nouvelle bibliothèque :','Nouvelle bibliothèque');if(name===null)return;const nextName=name.trim();if(!nextName){alert('Choisissez un nom pour cette bibliothèque.');return;}if(libraries.some(l=>l.name===nextName)){alert('Une bibliothèque porte déjà ce nom.');return;}activeLibraryId=id();data=fresh(nextName);libraries.push({id:activeLibraryId,name:nextName,data});mode='select';start=null;selectedCases.clear();selectedSeparators.clear();clipboard=null;selectedBook=null;selectedLocation=null;placing=false;removingBook=false;history=[];changed();message(`Bibliothèque « ${nextName} » créée.`);};
  $('library-selector').onchange=e=>switchLibrary(e.currentTarget.value);
  $('rename-library').onclick=()=>{const library=activeLibrary(),name=prompt('Nouveau nom de cette bibliothèque :',library?.name);if(name===null)return;const nextName=name.trim();if(!nextName){alert('Choisissez un nom pour cette bibliothèque.');return;}if(libraries.some(l=>l.id!==library.id&&l.name===nextName)){alert('Une autre bibliothèque porte déjà ce nom.');return;}library.name=nextName;data.libraryName=nextName;save();render();message('Bibliothèque renommée.');};
  $('delete-library').onclick=()=>{const library=activeLibrary();if(libraries.length===1){alert('Il faut conserver au moins une bibliothèque.');return;}if(!library||!confirm(`Supprimer définitivement « ${library.name} » et tous ses livres ?\n\nExportez-la d’abord si vous souhaitez la conserver.`))return;const index=libraries.findIndex(l=>l.id===library.id);libraries=libraries.filter(l=>l.id!==library.id);const next=libraries[Math.min(index,libraries.length-1)];activeLibraryId=next.id;data=next.data;mode=data.facadeLocked?'view':'select';start=null;selectedCases.clear();selectedSeparators.clear();clipboard=null;selectedBook=null;selectedLocation=null;placing=false;removingBook=false;history=[];changed();message(`Bibliothèque « ${library.name} » supprimée.`);};
  $('add-book').onclick=()=>openBook();
  $('search-button').onclick=()=>{const search=$('search');if(search.value){search.value='';renderBooks();message('Tous les livres sont affichés.');}else search.focus();};
  document.querySelectorAll('[data-sort]').forEach(button=>button.onclick=()=>{sortBy=button.dataset.sort;renderBooks();});
  $('book-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget,values={};for(const k of ['title','author','param1','param2'])values[k]=f.elements[k].value.trim();if(!values.title)return;checkpoint();if(editing)Object.assign(data.books.find(b=>b.id===editing),values);else data.books.push({id:id(),...values,location:null});$('book-dialog').close();changed();message('Livre enregistré.');};
  $('fields-button').onclick=()=>{const f=$('fields-form');f.elements.field1.value=data.fields[0];$('fields-dialog').showModal();};
  $('fields-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget,a=f.elements.field1.value.trim();if(!a)return;checkpoint();data.fields=[a,'Prêté à'];$('fields-dialog').close();changed();};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('search').oninput=renderBooks;$('search').onsearch=renderBooks;$('filter-field').onchange=renderBooks;
  $('export').onclick=async()=>{
    const contents=JSON.stringify(data,null,2), blob=new Blob([contents],{type:'application/json'}), filename=filenameFromLibraryName(data.libraryName);
    if(typeof window.showSaveFilePicker==='function'){
      try{
        const handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'Sauvegarde JSON',accept:{'application/json':['.json']}}]});
        const writable=await handle.createWritable();await writable.write(blob);await writable.close();
        message('Sauvegarde enregistrée dans le dossier choisi.');return;
      }catch(error){if(error?.name==='AbortError')return;}
    }
    const file=new File([blob],filename,{type:'application/json'});
    const shareData={files:[file]};
    if(navigator.maxTouchPoints>0 && typeof navigator.share==='function' && typeof navigator.canShare==='function' && navigator.canShare(shareData)){
      try{await navigator.share(shareData);message('Partage terminé. Vérifiez la destination choisie.');return;}
      catch(error){if(error?.name==='AbortError')return;}
    }
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message('Fichier téléchargé. Déplacez-le vers iCloud Drive > Ma Bibliothèque.');
  };
  $('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const incoming=JSON.parse(await file.text());if(!valid(incoming))throw Error('invalid');const initialPlaceholder=libraries.length===1&&isEmptyLibrary(activeLibrary());const name=initialPlaceholder?incoming.libraryName.trim():uniqueLibraryName(incoming.libraryName.trim());incoming.libraryName=name;const question=initialPlaceholder?`Charger « ${name} » comme unique bibliothèque ?`:`Ajouter « ${name} » comme bibliothèque distincte et l’afficher ?`;if(confirm(question)){if(initialPlaceholder){libraries=[{id:activeLibraryId,name,data:incoming}];}else{activeLibraryId=id();libraries.push({id:activeLibraryId,name,data:incoming});}data=incoming;selectedCases.clear();selectedSeparators.clear();selectedBook=null;selectedLocation=null;placing=false;removingBook=false;start=null;mode=data.facadeLocked?'view':'select';clipboard=null;history=[];changed();message(initialPlaceholder?`Bibliothèque « ${name} » chargée.`:`Bibliothèque « ${name} » importée.`);}}catch(_){alert('Ce fichier n’est pas une sauvegarde actuelle identifiée de Ma bibliothèque.');}e.target.value='';};
  render();
})();
