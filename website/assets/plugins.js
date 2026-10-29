/* SPDX-License-Identifier: GPL-3.0-or-later */
const list=document.querySelector('#catalog'),count=document.querySelector('#count'),search=document.querySelector('#search'),source=document.querySelector('#source'),category=document.querySelector('#category');
try {
 const response=await fetch('../assets/plugins.json');if(!response.ok)throw Error('Catalog unavailable');
 const plugins=await response.json();
 const requested=new URLSearchParams(location.search).get('source');if(['evencord','vencord','equicord'].includes(requested))source.value=requested;
 const element=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
 for(const tag of [...new Set(plugins.flatMap(p=>p.tags||[]))].sort()) { const option=element('option',tag);option.value=tag;category.append(option); }
 function render(){
  const q=search.value.trim().toLocaleLowerCase();
  const matches=plugins.filter(p=>(source.value==='all'||source.value===p.source)&&(category.value==='all'||p.tags?.includes(category.value))&&[p.name,p.description,...p.authors.map(a=>a.name)].join(' ').toLocaleLowerCase().includes(q));
  list.replaceChildren();count.textContent=`${matches.length} of ${plugins.length} plugins · Windows desktop catalog`;
  for(const p of matches){
   const card=element('article','','plugin');const badge=element('span',`${{evencord:'EvenCord',equicord:'Equicord',vencord:'Vencord'}[p.source]} Plugin`,'source-label '+p.source);card.append(badge,element('h2',p.name),element('p',p.description));
   card.append(element('p',p.authors.length?'By '+p.authors.map(a=>a.name).join(', '):'Public author not declared in source','authors'));
   card.append(element('div',[...(p.tags||[]),...(p.required?['System dependency']:[])].join(' · '),'tags'));
   const link=element('a','View source ?');link.href='https://github.com/alrimii/evencord/tree/main/'+p.filePath;card.append(link);list.append(card);
  }
  if(!matches.length)list.append(element('p','No plugins match these filters. Try a broader search.','empty'));
 }
 for(const input of [search,source,category])input.addEventListener('input',render);render();
}catch(error){count.textContent='The catalog could not load. Please reload or browse the source repository.';}
