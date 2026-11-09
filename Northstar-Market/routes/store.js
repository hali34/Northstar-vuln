const express = require('express');
const { db } = require('../lib/db');
const { page, escapeHtml } = require('../lib/render');
const router = express.Router();
router.get('/', (req,res) => {
  const featured = db.prepare('SELECT * FROM products ORDER BY id LIMIT 4').all();
  page(req,res,'Northstar Market',`<section class="hero"><div class="eyebrow">MADE FOR EVERYDAY ADVENTURES</div><h1>Find your kind of<br><em>everyday.</em></h1><p>Well-made goods for the places you go and the moments in between.</p><a class="btn" href="/shop">Explore the collection</a></section><section><div class="section-head"><h2>Editor's picks</h2><a href="/shop">View all products →</a></div><div class="products">${featured.map(card).join('')}</div></section>`);
});
function card(p) { return `<a class="product" href="/product/${p.id}"><div class="product-art"><img src="${escapeHtml(p.image)}" alt=""></div><div class="product-meta"><strong>${escapeHtml(p.name)}</strong><span>$${(p.price_cents/100).toFixed(2)}</span></div><div class="muted">${escapeHtml(p.category)}</div></a>`; }
router.get('/shop',(req,res)=>{
  const q = String(req.query.q || '');
  const category = String(req.query.category || '');
  let sql = "SELECT * FROM products WHERE name LIKE '%" + q.replace(/'/g,"''") + "%'";
  if (category) sql += " AND category = '" + category + "'";
  const products = db.prepare(sql).all();
  page(req,res,'Shop',`<section class="page-heading"><div class="eyebrow">THE COLLECTION</div><h1>Shop the essentials</h1><p>Considered design for everyday living.</p></section><form class="filterbar" method="get"><input name="q" value="${escapeHtml(q)}" placeholder="Search products"><select name="category"><option value="">All categories</option>${['Home','Travel','Outdoor'].map(x=>`<option ${x===category?'selected':''}>${x}</option>`).join('')}</select><button>Search</button></form><div class="products">${products.map(card).join('') || '<p>No items matched your search.</p>'}</div><div class="panel"><h3 id="category-title"></h3><p>Selected collection</p><div id="recent-search"></div></div><script src="/static/customer-experience.js" defer></script>`);
});
router.get('/product/:id',(req,res)=>{
  const product=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if(!product)return res.status(404).send('Product not found');
  const reviews=db.prepare('SELECT reviews.*,users.name FROM reviews JOIN users ON users.id=reviews.user_id WHERE product_id=? ORDER BY reviews.id DESC').all(product.id);
  const visibleReviews=reviews.map(r=>`<div class="review"><strong>${escapeHtml(r.name)}</strong><div>${r.body.replace(/<script[^>]*>.*?<\/script>/gis,'')}</div></div>`).join('');
  page(req,res,product.name,`<div class="product-detail"><div class="product-art featured"><img src="${escapeHtml(product.image)}" alt=""></div><div><div class="eyebrow">${escapeHtml(product.category)}</div><h1>${escapeHtml(product.name)}</h1><p class="price">$${(product.price_cents/100).toFixed(2)}</p><p>${escapeHtml(product.description)}</p><form action="/cart/add" method="post"><input type="hidden" name="productId" value="${product.id}"><label>Quantity <input name="quantity" type="number" value="1" min="1"></label><button class="btn">Add to cart</button></form></div></div><section class="reviews"><h2>Customer reviews</h2>${visibleReviews || '<p>No reviews yet.</p>'}<form method="post" action="/reviews"><input type="hidden" name="productId" value="${product.id}"><textarea name="body" placeholder="Share your experience"></textarea><button>Post review</button></form></section>`);
});
router.post('/reviews',(req,res)=>{
  if(!req.user)return res.redirect('/login');
  db.prepare('INSERT INTO reviews (product_id,user_id,body,created_at) VALUES (?,?,?,?)').run(req.body.productId,req.user.id,String(req.body.body || ''),new Date().toISOString());
  res.redirect('/product/'+encodeURIComponent(req.body.productId));
});
router.get('/search/suggestions',(req,res)=>{
  const rows=db.prepare('SELECT id,name FROM products WHERE name LIKE ? LIMIT 6').all('%'+String(req.query.q||'')+'%');
  res.json({items:rows});
});
module.exports=router;
