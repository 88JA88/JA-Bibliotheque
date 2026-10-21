(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEY = 'ma-bibliotheque-v1';
  const fresh = () => ({version:1, cols:8, rows:5, fields:['Paramètre 1','Prêté à'], cases:Array.from({length:40},(_,i)=>({id:`initial-${i}`,x:i%8,y:Math.floor(i/8),w:1,h:1})), books:[], facadeLocked:true, facadeScale:48});
  let data = fresh(), mode = 'draw', start = null, selectedCases = new Set(), clipboard = null, selectedBook = null, selectedLocation = null, placing = false, history = [], editing = null;
  const id = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const clone = value => JSON.parse(JSON.stringify(value));
  // Une case peut commencer ou finir sur une demi-division de module.
  const onGrid = n => Number.isFinite(n) && Number.isInteger(n * 2);
  const columnCount = c => Math.ceil(c.x + c.w) - Math.floor(c.x);
  function columnName(index) { let name=''; for (let n=index+1; n>0; n=Math.floor((n-1)/26)) name=String.fromCharCode(65+(n-1)%26)+name; return name; }
  function locationIndex(x,y) { return `${columnName(Math.floor(x/2))}(${x%2===0?'g':'d'})-${Math.floor(y/2)+1}`; }
  function matchesLocation(location, selected, c) {
    if (!location || !selected || location.caseId !== selected.caseId) return false;
    if (location.x !== undefined && selected.x !== undefined) return location.x === selected.x && Math.floor(location.y/2) === Math.floor(selected.y/2);
    if (location.column !== undefined && selected.x !== undefined) return Math.floor(selected.x/2)-Math.floor(c.x) === location.column;
    if (location.x !== undefined && selected.column !== undefined) return Math.floor(location.x/2)-Math.floor(c.x) === selected.column;
    return location.column === selected.column;
  }

  function valid(v) {
    if (v && ((v.facadeLocked !== undefined && typeof v.facadeLocked !== 'boolean') || (v.facadeScale !== undefined && (!Number.isFinite(v.facadeScale) || v.facadeScale < 24 || v.facadeScale > 120)))) return false;
    if (!v || v.version !== 1 || !Number.isInteger(v.cols) || v.cols < 1 || v.cols > 30 || !Number.isInteger(v.rows) || v.rows < 1 || v.rows > 30 || !Array.isArray(v.fields) || v.fields.length !== 2 || !v.fields.every(x => typeof x === 'string' && x.trim()) || !Array.isArray(v.cases) || !Array.isArray(v.books)) return false;
    const ids = new Set();
    for (const c of v.cases) { if (!c || typeof c.id !== 'string' || ids.has(c.id) || ![c.x,c.y,c.w,c.h].every(onGrid) || c.x < 0 || c.y < 0 || c.w < 0.5 || c.h < 0.5 || c.x+c.w > v.cols || c.y+c.h > v.rows) return false; ids.add(c.id); }
    const bookIds = new Set();
    for (const b of v.books) { if (!b || typeof b.id !== 'string' || bookIds.has(b.id) || !['title','author','param1','param2'].every(k => typeof b[k] === 'string') || !b.title.trim()) return false; bookIds.add(b.id); if (b.location != null) { const c = v.cases.find(c => c.id === b.location.caseId); if (!c) return false; const l=b.location; if (l.x !== undefined || l.y !== undefined) { if (!Number.isInteger(l.x) || !Number.isInteger(l.y) || l.x < c.x*2 || l.y < c.y*2 || l.x >= (c.x+c.w)*2 || l.y >= (c.y+c.h)*2) return false; } else if (!Number.isInteger(l.column) || l.column < 0 || l.column >= columnCount(c)) return false; } }
    return true;
  }
  let needsInitialSave=false;
  try { const saved = localStorage.getItem(KEY); if (saved) { const parsed = JSON.parse(saved); if (valid(parsed)) data = parsed; else setTimeout(() => alert('Les données enregistrées ne sont pas valides. Vous pouvez importer une sauvegarde.'), 0); } else needsInitialSave=true; } catch (_) { setTimeout(() => alert('Impossible de lire les données enregistrées sur cet appareil.'), 0); }
  if (data.facadeLocked) mode='view';
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); $('save-status').textContent = '● Enregistré sur cet appareil'; } catch (_) { $('save-status').textContent = '⚠ Enregistrement impossible : exportez vos données'; } }
  if (needsInitialSave) save();
  function checkpoint() { history.push(clone(data)); if (history.length > 30) history.shift(); }
  function changed() { save(); render(); }
  function message(s) { const t=$('toast'); t.textContent=s; t.classList.add('show'); clearTimeout(message.timer); message.timer=setTimeout(()=>t.classList.remove('show'),3000); }
  function overlap(a,b) { return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }
  function setMode(next) { mode=next; start=null; placing=false; if(next !== 'select') selectedCases.clear(); render(); }
  function render() {
    $('cols').value=data.cols; $('rows').value=data.rows;
    $('grid-settings').hidden=!!data.facadeLocked; $('toolbar').hidden=!!data.facadeLocked;
    $('save-facade').textContent=data.facadeLocked ? 'Modifier la façade' : 'Enregistrer la façade';
    const activeBook=data.books.find(b=>b.id===selectedBook);
    $('place-book').disabled=!activeBook || !data.cases.length;
    $('place-book').title=activeBook ? `Placer ${activeBook.title}` : 'Sélectionnez d’abord un livre';
    document.querySelectorAll('.mode').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode && !placing));
    $('undo').disabled=!history.length; $('copy').disabled=!selectedCases.size; $('paste').disabled=!clipboard;
    $('case-count').textContent=data.cases.length+' case'+(data.cases.length===1?'':'s'); $('book-count').textContent=data.books.length;
    $('hint').textContent=placing ? 'Touchez le carré où se trouve ce livre.' : data.facadeLocked ? 'Façade enregistrée. Étirez l’angle inférieur droit pour ajuster sa taille.' : mode==='draw' ? (start ? 'Choisissez le croisement opposé pour terminer la case.' : 'Choisissez deux croisements opposés pour dessiner une case.') : mode==='paste' ? 'Choisissez le croisement où placer le coin supérieur gauche de la copie.' : selectedCases.size ? `${selectedCases.size} case${selectedCases.size > 1 ? 's sélectionnées' : ' sélectionnée'} — appuyez sur Suppr pour supprimer. Maj permet d’ajouter une case.` : 'Cliquez dans une case pour la sélectionner. Maintenez Maj pour en sélectionner plusieurs.';
    renderCanvas(); renderBooks();
  }
  function renderCanvas() {
    const canvas=$('canvas'); canvas.replaceChildren();
    const step=data.facadeScale || 48; canvas.style.width=(data.cols*step)+'px'; canvas.style.height=(data.rows*step)+'px';
    const book=data.books.find(b=>b.id===selectedBook), shownLocation=selectedLocation || book?.location;
    data.cases.forEach(c=>{
      const el=document.createElement('div'); el.className='case'+(selectedCases.has(c.id)?' selected':'')+(shownLocation?.caseId===c.id?' found':'');
      Object.assign(el.style,{left:(c.x*step)+'px',top:(c.y*step)+'px',width:(c.w*step)+'px',height:(c.h*step)+'px'});
      if (placing || data.facadeLocked || (shownLocation?.caseId===c.id)) {
        for(let row=0; row<c.h*2; row++) for(let col=0; col<c.w*2; col++) {
          const x=c.x*2+col, y=c.y*2+row;
          const highlighted=matchesLocation(shownLocation,{caseId:c.id,x,y},c);
          const btn=document.createElement('button'); btn.type='button'; btn.className='case-cell'+(highlighted?' highlight':'');
          Object.assign(btn.style,{left:(col/(c.w*2)*100)+'%',top:(row/(c.h*2)*100)+'%',width:(100/(c.w*2))+'%',height:(100/(c.h*2))+'%'});
          btn.setAttribute('aria-label',`Emplacement ${locationIndex(x,y)}`);btn.title=locationIndex(x,y);
          if(placing) btn.addEventListener('click',()=>{checkpoint();book.location={caseId:c.id,x,y};selectedLocation=null;placing=false;changed();message('Placement enregistré.');});
          else if(data.facadeLocked) btn.addEventListener('click',()=>{selectedBook=null;selectedLocation={caseId:c.id,x,y};render();});
          else btn.style.pointerEvents='none';
          el.append(btn);
        }
      }
      if(mode==='select' && !placing){const btn=document.createElement('button');btn.type='button';btn.className='case-select';btn.setAttribute('aria-label',`Sélectionner la case en colonne ${c.x+1}, ligne ${c.y+1}, ${c.w} par ${c.h} modules`);btn.setAttribute('aria-pressed',selectedCases.has(c.id));btn.onclick=(event)=>{if(event.shiftKey){selectedCases.has(c.id)?selectedCases.delete(c.id):selectedCases.add(c.id);}else{const wasOnlySelected=selectedCases.size===1 && selectedCases.has(c.id);selectedCases.clear();if(!wasOnlySelected)selectedCases.add(c.id);}render();$('canvas').focus({preventScroll:true});};el.append(btn);}
      canvas.append(el);
    });
    for(let x=0;x<data.cols;x++){const label=document.createElement('span');label.className='axis-label axis-column';label.style.left=((x+0.5)*step)+'px';label.textContent=columnName(x);canvas.append(label);}
    for(let y=0;y<data.rows;y++){const label=document.createElement('span');label.className='axis-label axis-row';label.style.top=((y+0.5)*step)+'px';label.textContent=String(y+1);canvas.append(label);}
    for(let x=0;x<=data.cols*2;x++){const line=document.createElement('span');line.className='grid-line vertical '+(x%2?'secondary':'primary-line');line.style.left=(x*step/2)+'px';canvas.append(line);}
    for(let y=0;y<=data.rows*2;y++){const line=document.createElement('span');line.className='grid-line horizontal '+(y%2?'secondary':'primary-line');line.style.top=(y*step/2)+'px';canvas.append(line);}
    if(data.facadeLocked){const handle=document.createElement('button');handle.type='button';handle.className='scale-handle';handle.setAttribute('aria-label','Agrandir ou réduire la façade');handle.title='Étirez pour ajuster la taille';handle.textContent='↘';handle.onpointerdown=startScale;handle.onkeydown=scaleByKeyboard;canvas.append(handle);}
    for(let yi=0;yi<=data.rows*2;yi++) for(let xi=0;xi<=data.cols*2;xi++) {
      const x=xi/2,y=yi/2;
      if(!placing && (mode==='draw'||mode==='paste')) { const button=document.createElement('button'); button.type='button'; button.className='intersection'+(start && start.x===x && start.y===y?' start':''); button.style.left=x*step+'px';button.style.top=y*step+'px';button.setAttribute('aria-label',`Croisement à ${x} modules du bord gauche et ${y} du haut`); button.onclick=()=>intersection(x,y);canvas.append(button); }
    }
  }
  function intersection(x,y) {
    if(mode==='paste') {
      const copies=clipboard.map(c=>({...c,id:id(),x:c.x+x,y:c.y+y}));
      if(copies.some(c=>c.x+c.w>data.cols || c.y+c.h>data.rows)){message('La copie dépasse de la grille. Choisissez un autre croisement.');return;}
      if(copies.some(c=>data.cases.some(existing=>overlap(c,existing))) && !confirm('La copie recouvre une ou plusieurs cases existantes. Voulez-vous quand même la coller ?')) return;
      checkpoint();data.cases.push(...copies);selectedCases=new Set(copies.length===1?[copies[0].id]:[]);mode='select';changed();message('Cases collées.');return;
    }
    if(!start){start={x,y};render();return;}
    if(start.x===x || start.y===y){message('Choisissez un croisement sur une autre ligne et une autre colonne.');return;}
    const c={id:id(),x:Math.min(x,start.x),y:Math.min(y,start.y),w:Math.abs(x-start.x),h:Math.abs(y-start.y)};
    if(data.cases.some(existing=>overlap(c,existing)) && !confirm('Cette case recouvre une case existante. Voulez-vous quand même la dessiner ?')) return;
    checkpoint();data.cases.push(c);start=null;changed();
  }
  function renderBooks(){
    const fields=[['all','Tous les champs'],['title','Titre'],['author','Auteur'],['param1',data.fields[0]],['param2','Prêté à']];
    const filter=$('filter-field'),sort=$('sort-field'), oldFilter=filter.value||'all',oldSort=sort.value||'title';
    filter.replaceChildren(...fields.map(([v,l])=>new Option(l,v)));filter.value=oldFilter;
    sort.replaceChildren(...fields.slice(1).map(([v,l])=>new Option(l,v)));sort.value=oldSort;
    const query=$('search').value.trim().toLocaleLowerCase('fr');
    const books=data.books.filter(b=>!query || (filter.value==='all'?['title','author','param1','param2']:[filter.value]).some(k=>b[k].toLocaleLowerCase('fr').includes(query))).sort((a,b)=>a[sort.value].localeCompare(b[sort.value],'fr',{sensitivity:'base'}));
    const list=$('books');list.replaceChildren();
    if(!books.length){const empty=document.createElement('div');empty.className='empty';const strong=document.createElement('strong');strong.textContent=data.books.length?'Aucun livre trouvé':'Votre catalogue commence ici';empty.append(strong,document.createTextNode(data.books.length?'Essayez une autre recherche.':'Ajoutez votre premier livre pour le retrouver facilement.'));list.append(empty);return;}
    books.forEach(b=>{
      const locationCase=selectedLocation && data.cases.find(c=>c.id===selectedLocation.caseId);
      const row=document.createElement('div');row.className='book'+(b.param2.trim()?' loaned':'')+(selectedBook===b.id || (locationCase && matchesLocation(b.location,selectedLocation,locationCase))?' selected':'');
      const main=document.createElement('button');main.type='button';main.className='book-main';main.textContent=b.title;main.setAttribute('aria-label',`Ouvrir la fiche de ${b.title}`);
      const selectBook=()=>{selectedBook=b.id;selectedLocation=null;placing=false;start=null;render();};
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
    $('details-location').textContent=b.location ? (b.location.x !== undefined ? locationIndex(b.location.x,b.location.y) : 'Ancien repère par colonne à préciser') : 'Non renseigné';
    $('details-dialog').showModal();
  }
  function openBook(book){editing=book?.id||null;const f=$('book-form');f.reset();$('dialog-title').textContent=book?'Modifier le livre':'Ajouter un livre';$('param1-label').textContent=data.fields[0];if(book) for(const k of ['title','author','param1','param2']) f.elements[k].value=book[k];$('book-dialog').showModal();f.elements.title.focus();}
  $('save-facade').onclick=()=>{if(!data.facadeLocked && !data.cases.length){message('Dessinez au moins une case avant d’enregistrer la façade.');return;}data.facadeLocked=!data.facadeLocked;mode=data.facadeLocked?'view':'draw';selectedCases.clear();selectedLocation=null;start=null;placing=false;history=[];changed();message(data.facadeLocked?'Façade enregistrée.':'Vous pouvez modifier la façade.');};
  let scaleDrag=null;
  function startScale(event){if(event.button!==0 && event.pointerType!=='touch')return;event.preventDefault();scaleDrag={id:event.pointerId,x:event.clientX,y:event.clientY,scale:data.facadeScale || 48};$('canvas').setPointerCapture(event.pointerId);}
  function scaleByKeyboard(event){if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(event.key))return;event.preventDefault();data.facadeScale=Math.max(24,Math.min(120,(data.facadeScale||48)+(['ArrowUp','ArrowRight'].includes(event.key)?4:-4)));save();renderCanvas();}
  $('canvas').addEventListener('pointermove',event=>{if(!scaleDrag || event.pointerId!==scaleDrag.id)return;const delta=((event.clientX-scaleDrag.x)*data.cols+(event.clientY-scaleDrag.y)*data.rows)/(data.cols*data.cols+data.rows*data.rows);data.facadeScale=Math.max(24,Math.min(120,Math.round(scaleDrag.scale+delta)));renderCanvas();});
  function finishScale(event){if(!scaleDrag || event.pointerId!==scaleDrag.id)return;scaleDrag=null;save();render();}
  $('canvas').addEventListener('pointerup',finishScale);$('canvas').addEventListener('pointercancel',finishScale);
  document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  $('resize').onclick=()=>{const cols=Number($('cols').value),rows=Number($('rows').value);if(!Number.isInteger(cols)||!Number.isInteger(rows)||cols<1||rows<1||cols>30||rows>30){alert('Choisissez entre 1 et 30 modules pour chaque dimension.');return;}if(data.cases.some(c=>c.x+c.w>cols||c.y+c.h>rows)){alert('Certaines cases dépasseraient de la nouvelle grille. Supprimez-les avant de réduire la grille.');return;}if(cols===data.cols&&rows===data.rows)return;checkpoint();data.cols=cols;data.rows=rows;start=null;changed();};
  $('copy').onclick=()=>{const cases=data.cases.filter(c=>selectedCases.has(c.id));if(!cases.length)return;const x=Math.min(...cases.map(c=>c.x)),y=Math.min(...cases.map(c=>c.y));clipboard=cases.map(c=>({x:c.x-x,y:c.y-y,w:c.w,h:c.h}));message(`${cases.length} case${cases.length>1?'s copiées':' copiée'}. Choisissez Coller.`);render();};
  $('paste').onclick=()=>{mode='paste';placing=false;start=null;render();};
  function deleteSelectedCases(){if(!selectedCases.size)return;const count=selectedCases.size;checkpoint();data.cases=data.cases.filter(c=>!selectedCases.has(c.id));data.books.forEach(b=>{if(b.location && selectedCases.has(b.location.caseId))b.location=null;});selectedCases.clear();changed();message(`${count} case${count > 1 ? 's supprimées' : ' supprimée'}. Utilisez Annuler pour revenir en arrière.`);}
  window.addEventListener('keydown', event => {
    const isDelete = event.key === 'Backspace' || event.key === 'Delete' || event.code === 'Backspace' || event.code === 'Delete';
    const target = event.target;
    const editingText = target instanceof Element && (target.isContentEditable || !!target.closest('input, textarea, select, dialog'));
    if (data.facadeLocked || !isDelete || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || editingText || placing || !selectedCases.size) return;
    event.preventDefault();
    deleteSelectedCases();
  }, true);
  $('undo').onclick=()=>{if(!history.length)return;data=history.pop();selectedCases.clear();selectedLocation=null;start=null;placing=false;mode=data.facadeLocked?'view':'draw';if(!data.books.some(b=>b.id===selectedBook))selectedBook=null;changed();message('Dernière modification annulée.');};
  $('place-book').onclick=()=>{const book=data.books.find(b=>b.id===selectedBook);if(!book || !data.cases.length)return;placing=true;start=null;selectedCases.clear();render();if(matchMedia('(max-width: 900px)').matches) $('facade-title').scrollIntoView({behavior:'smooth',block:'start'});};
  $('details-edit').onclick=()=>{const book=data.books.find(b=>b.id===selectedBook);if(!book)return;$('details-dialog').close();openBook(book);};
  $('details-delete').onclick=()=>{const book=data.books.find(b=>b.id===selectedBook);if(book && confirm(`Supprimer « ${book.title} » ?`)){checkpoint();data.books=data.books.filter(b=>b.id!==book.id);selectedBook=null;placing=false;$('details-dialog').close();changed();}};
  $('notice-button').onclick=()=>$('notice-dialog').showModal();
  $('add-book').onclick=()=>openBook();
  $('book-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget,values={};for(const k of ['title','author','param1','param2'])values[k]=f.elements[k].value.trim();if(!values.title)return;checkpoint();if(editing)Object.assign(data.books.find(b=>b.id===editing),values);else data.books.push({id:id(),...values,location:null});$('book-dialog').close();changed();message('Livre enregistré.');};
  $('fields-button').onclick=()=>{const f=$('fields-form');f.elements.field1.value=data.fields[0];$('fields-dialog').showModal();};
  $('fields-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget,a=f.elements.field1.value.trim();if(!a)return;checkpoint();data.fields=[a,'Prêté à'];$('fields-dialog').close();changed();};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('search').oninput=renderBooks;$('filter-field').onchange=renderBooks;$('sort-field').onchange=renderBooks;
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ma-bibliotheque.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const incoming=JSON.parse(await file.text());if(!valid(incoming))throw Error('invalid');if(confirm('Restaurer cette sauvegarde remplacera les données actuellement affichées. Continuer ?')){checkpoint();data=incoming;selectedCases.clear();selectedBook=null;selectedLocation=null;placing=false;start=null;mode=data.facadeLocked?'view':'draw';clipboard=null;changed();message('Sauvegarde restaurée.');}}catch(_){alert('Ce fichier ne contient pas une sauvegarde valide de Ma bibliothèque.');}e.target.value='';};
  render();
})();
