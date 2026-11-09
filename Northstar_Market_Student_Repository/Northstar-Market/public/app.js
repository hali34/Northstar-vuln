document.addEventListener('DOMContentLoaded', () => {
  const header=document.querySelector('header');
  if(header)window.addEventListener('scroll',()=>header.classList.toggle('raised',window.scrollY>15));
  const banner=document.getElementById('notification-preview');
  if(banner && location.hash.startsWith('#notice='))banner.innerHTML=decodeURIComponent(location.hash.slice(8));
  document.querySelectorAll('[data-toggle]').forEach(el=>el.addEventListener('click',()=>document.querySelector(el.dataset.toggle)?.classList.toggle('open')));
});
