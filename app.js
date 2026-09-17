const K='ielts_vocab_ios_v1', P='ielts_progress_ios_v1'; let words=[],session={n:0,ok:0},current=null;
const $=id=>document.getElementById(id); const norm=s=>(s||'').replace(/\s+/g,' ').trim();
async function init(){let saved=localStorage.getItem(K); if(saved) words=JSON.parse(saved); else {words=await fetch('seed_words.json').then(r=>r.json()); save();} normalize(); renderDays(); updateCount(); next(); if('serviceWorker'in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});}
function splitMeaningNote(meaning,note=''){
  meaning=norm(meaning); note=norm(note);
  // Older Day documents sometimes stored a short Chinese definition and an English study note in one cell.
  // Split only when the trailing part clearly looks like an English/example note, so normal Chinese definitions stay intact.
  const m=meaning.match(/^(.+?)([。；;])\s*(.+)$/);
  if(m && /[A-Za-z=]/.test(m[3])){
    const extra=norm(m[3]);
    return {meaning:norm(m[1]),note:norm([extra,note].filter(Boolean).join('；'))};
  }
  return {meaning,note};
}
function cleanDay(d){
  d=norm(String(d||'Imported'));
  const m=d.match(/(?:Day\s*)?(\d+)/i);
  return m?m[1]:d;
}
function normalize(){words=words.map((w,i)=>{
  const x=splitMeaningNote(w.meaning||w.chinese||'',w.note||w.notes||w.example||'');
  return {id:w.id||Date.now()+i,term:norm(w.term||w.word||w.english||''),meaning:x.meaning,note:x.note,day:cleanDay(w.day||w.source_day||'Imported'),wrong:+(w.wrong||0),right:+(w.right||0)}
}).filter(w=>w.term&&w.meaning); save()}
function save(){localStorage.setItem(K,JSON.stringify(words))} function updateCount(){$('count').textContent=words.length+' 词'}
function renderDays(){let old=$('day').value||'all'; let ds=[...new Set(words.map(w=>w.day))].sort((a,b)=>parseInt(a)-parseInt(b)); $('day').innerHTML='<option value="all">全部 Day</option>'+ds.map(d=>`<option value="${esc(d)}">Day ${esc(d)}</option>`).join(''); $('day').value=[...$('day').options].some(o=>o.value===old)?old:'all'}
function pool(){let d=$('day').value,a=d==='all'?words:words.filter(w=>w.day===d); return a.length?a:words}
function weighted(a){let bag=[];a.forEach(w=>{let n=Math.min(6,1+(w.wrong||0));for(let i=0;i<n;i++)bag.push(w)});return bag[Math.floor(Math.random()*bag.length)]}
function next(){if(!words.length)return; current=weighted(pool()); $('reveal').classList.add('hide'); $('choices').innerHTML=''; $('answer').value=''; let en=$('mode').value==='en-zh'; $('prompt').textContent=en?current.term:current.meaning; $('meta').textContent='Day '+current.day; $('inputArea').classList.toggle('hide',$('type').value!=='input'); if($('type').value==='choice') makeChoices(en)}
function makeChoices(en){let correct=en?current.meaning:current.term; let opts=[correct]; let candidates=pool().filter(w=>w.id!==current.id).sort(()=>Math.random()-.5); for(let w of candidates){let x=en?w.meaning:w.term;if(x&&!opts.includes(x))opts.push(x);if(opts.length===4)break} opts.sort(()=>Math.random()-.5); opts.forEach(x=>{let b=document.createElement('button');b.className='choice';b.textContent=x;b.onclick=()=>grade(x===correct,b);$('choices').appendChild(b)})}
function grade(ok,btn){session.n++; if(ok)session.ok++; current[ok?'right':'wrong']++; save(); $('todayStat').textContent=session.ok+' / '+session.n; if(btn){[...document.querySelectorAll('.choice')].forEach(b=>{b.disabled=true; let truth=$('mode').value==='en-zh'?current.meaning:current.term;if(b.textContent===truth)b.classList.add('correct')}); if(!ok)btn.classList.add('wrong')} reveal()}
function reveal(){let en=$('mode').value==='en-zh'; $('truth').textContent=(en?current.term+' — '+current.meaning:current.meaning+' — '+current.term); $('note').textContent=current.note; $('reveal').classList.remove('hide')}
$('check').onclick=()=>{let en=$('mode').value==='en-zh',truth=en?current.meaning:current.term,ans=norm($('answer').value).toLowerCase(); grade(ans===truth.toLowerCase())}; $('known').onclick=()=>next(); $('again').onclick=()=>{current.wrong+=2;save();next()}; $('mode').onchange=next;$('type').onchange=next;$('day').onchange=next;
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{let id=b.dataset.tab;['study','import','stats'].forEach(x=>$(x).classList.toggle('hide',x!==id));document.querySelectorAll('[data-tab]').forEach(z=>z.classList.toggle('secondary',z.dataset.tab!==id))});
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
$('file').onchange=async e=>{let f=e.target.files[0];if(!f)return; try{let arr=await f.arrayBuffer(),zip=await JSZip.loadAsync(arr),xml=await zip.file('word/document.xml').async('string'),dom=new DOMParser().parseFromString(xml,'application/xml');let rows=[...dom.getElementsByTagNameNS('*','tr')], found=[]; let day=(f.name.match(/Day[_\s-]?(\d+)/i)||[])[1]||'Imported'; for(let row of rows){let cells=[...row.getElementsByTagNameNS('*','tc')].map(c=>norm([...c.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join(' '))); if(cells.length>=2){let a=cells[0],b=cells[1],c=cells[2]||''; if(/word|phrase|expression|词汇|短语/i.test(a)&&/meaning|含义|中文/i.test(b))continue; if(a&&b&&/[A-Za-z]/.test(a)){let x=splitMeaningNote(b,c);found.push({id:Date.now()+found.length,term:a,meaning:x.meaning,note:x.note,day:cleanDay(day),wrong:0,right:0})}}}
let keys=new Set(words.map(w=>(w.term+'|'+w.meaning).toLowerCase()));let fresh=found.filter(w=>!keys.has((w.term+'|'+w.meaning).toLowerCase()));words.push(...fresh);save();renderDays();updateCount();$('importResult').textContent=`识别 ${found.length} 条，新增 ${fresh.length} 条。${fresh.length?'已经加入题库。':'没有发现新词。'}`; }catch(err){$('importResult').textContent='导入失败：'+err.message}}
$('export').onclick=()=>{let blob=new Blob([JSON.stringify(words,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='IELTS_vocab_backup.json';a.click();URL.revokeObjectURL(a.href)};
$('restore').onchange=async e=>{try{let x=JSON.parse(await e.target.files[0].text());if(Array.isArray(x)){words=x;normalize();save();renderDays();updateCount();next();alert('恢复完成')}}catch{alert('JSON 文件无效')}};
init();
