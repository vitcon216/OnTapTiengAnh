// ════════════════════════════════════════════════════════════
// STUDY4 — Dán đoạn này vào Console (F12) tại trang Study4
// Script sẽ tự scrape 23 lists và tải file words.json về máy
// ════════════════════════════════════════════════════════════

(async()=>{
const log=m=>console.log('%c✅ '+m,'color:#58CC02;font-weight:bold');
const seen=new Set();let id=1;const all=[];
function parse(doc,topic){
  const w=[];
  doc.querySelectorAll('.termlist-item').forEach(item=>{
    const h2=item.querySelector('h2');if(!h2)return;
    const c=h2.cloneNode(true);
    c.querySelectorAll('span,button,i,a').forEach(e=>e.remove());
    const word=c.textContent.trim().replace(/\s+/g,' ');
    if(!word||!/^[a-zA-Z]/.test(word))return;
    let ipa='',type='';
    h2.querySelectorAll('span').forEach(s=>{
      const t=s.textContent.trim();
      if(/^\/.*\/$/.test(t))ipa=t;
      else if(/^\(.*\)$/.test(t))type=t.slice(1,-1);
    });
    let vi='';const pw=item.querySelector('.prewrap');
    if(pw)pw.innerText.split('\n').filter(Boolean).forEach(l=>{if(!vi&&!l.startsWith('='))vi=l.trim();});
    let ex='',tr='';
    const li=item.querySelector('.termlist-item-examples li');
    if(li){const lc=lc||li.cloneNode(true);
      lc.querySelectorAll('.jq-audio-player,.jq-audio-btn').forEach(e=>e.remove());
      const txt=lc.innerText.trim();
      const m=txt.match(/^(.+?)\s*\(=Dịch:\s*(.+?)\)\s*$/s);
      if(m){ex=m[1].replace(/\[|\]/g,'').trim();tr=m[2].trim();}else ex=txt.replace(/\[|\]/g,'').trim();
    }
    const k=word.toLowerCase();if(seen.has(k))return;seen.add(k);
    w.push({id:'w'+(id++),word,ipa,type,meaning:vi,example:ex,translation:tr,topic});
  });return w;
}
log('Bắt đầu scrape 23 lists...');
for(let i=0;i<23;i++){
  const lid=45101+i;
  try{
    const r=await fetch(`https://study4.com/flashcards/lists/${lid}/`,{credentials:'include'});
    const html=await r.text();
    const doc=new DOMParser().parseFromString(html,'text/html');
    const title=(doc.querySelector('title')?.textContent||'').replace('| STUDY4','').trim();
    const w=parse(doc,title||`List ${lid}`);
    all.push(...w);
    console.log(`List ${lid}: ${w.length} từ | Tổng: ${all.length}`);
  }catch(e){console.warn(`List ${lid}:`,e.message);}
  await new Promise(r=>setTimeout(r,400));
}
log(`XONG! Tổng ${all.length} từ vựng`);
const blob=new Blob([JSON.stringify(all,null,2)],{type:'application/json'});
const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'words.json'});
document.body.appendChild(a);a.click();document.body.removeChild(a);
log('✅ File words.json đã tải về! Copy vào thư mục data/ của EngVocab');
})();
