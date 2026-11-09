const encodeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categoryTitle=document.getElementById('category-title');
if(categoryTitle){
  categoryTitle.textContent=new URLSearchParams(location.search).get('category')||'Featured';
}
const recentSearch=document.getElementById('recent-search');
if(recentSearch){
  const query=new URLSearchParams(location.search).get('q')||'';
  recentSearch.innerHTML=encodeHtml(query);
}
