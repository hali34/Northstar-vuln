const categoryTitle=document.getElementById('category-title');
if(categoryTitle){
  const category=new URLSearchParams(location.search).get('category')||'Featured';
  categoryTitle.innerHTML=category;
}
const recentSearch=document.getElementById('recent-search');
if(recentSearch){
  const query=new URLSearchParams(location.search).get('q')||'';
  recentSearch.textContent=query;
}
const sharePreview=document.getElementById('share-preview');
if(sharePreview){
  const title=location.hash.slice(1);
  sharePreview.innerHTML=decodeURIComponent(title);
}
const privacyTitle=document.getElementById('privacy-title');
if(privacyTitle){
  privacyTitle.textContent=location.hash.slice(1);
}
