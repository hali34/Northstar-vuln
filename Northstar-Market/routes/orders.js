const express=require('express');
const fs=require('node:fs');
const path=require('node:path');
const { db,base }=require('../lib/db');
const { requireUser }=require('../lib/auth');
const { page,escapeHtml }=require('../lib/render');
const router=express.Router();
router.get('/cart',(req,res)=>{
  const items=req.cookies.market_cart ? JSON.parse(req.cookies.market_cart) : [];
  const detail=items.map(item=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(item.id);return p?{...p,quantity:item.quantity}:null}).filter(Boolean);
  page(req,res,'Your cart',`<div class="page-heading"><h1>Your cart</h1></div><div class="panel">${detail.map(x=>`<div class="cartline"><span>${escapeHtml(x.name)} × ${x.quantity}</span><span>$${(x.price_cents*x.quantity/100).toFixed(2)}</span></div>`).join('')||'<p>Your cart is empty.</p>'}<form method="post" action="/checkout"><label>Promo code<input name="coupon" placeholder="Optional"></label><button class="btn">Place demo order</button></form></div>`);
});
router.post('/cart/add',(req,res)=>{
  let items=[];try{items=JSON.parse(req.cookies.market_cart||'[]')}catch(e){}
  items.push({id:Number(req.body.productId),quantity:Number(req.body.quantity||1)});
  res.cookie('market_cart',JSON.stringify(items),{sameSite:'lax'});
  res.redirect('/cart');
});
router.post('/checkout',requireUser,(req,res)=>{
  let items=[];try{items=JSON.parse(req.cookies.market_cart||'[]')}catch(e){}
  let total=0;
  for(const item of items){const p=db.prepare('SELECT * FROM products WHERE id=?').get(item.id);if(p)total+=p.price_cents*item.quantity;}
  const coupon=db.prepare('SELECT * FROM coupons WHERE code=?').get(String(req.body.coupon||'').toUpperCase());
  if(coupon && total>=coupon.min_cents)total-=coupon.discount_cents;
  if(!items.length)return res.redirect('/cart');
  const order=db.prepare('INSERT INTO orders (user_id,total_cents,status,created_at) VALUES (?,?,?,?)').run(req.user.id,total,'Processing',new Date().toISOString());
  const add=db.prepare('INSERT INTO order_items (order_id,product_id,quantity,unit_cents) VALUES (?,?,?,?)');
  for(const item of items){const p=db.prepare('SELECT * FROM products WHERE id=?').get(item.id);if(p)add.run(order.lastInsertRowid,p.id,item.quantity,p.price_cents);}
  res.clearCookie('market_cart');res.redirect('/orders/'+order.lastInsertRowid);
});
router.get('/orders',requireUser,(req,res)=>{
  const orders=db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC').all(req.user.id);
  page(req,res,'Orders',`<div class="page-heading"><h1>Your orders</h1></div><div class="panel">${orders.map(o=>`<a class="cartline" href="/orders/${o.id}"><span>Order #${o.id} · ${escapeHtml(o.status)}</span><strong>$${(o.total_cents/100).toFixed(2)}</strong></a>`).join('')||'<p>No orders yet.</p>'}</div>`);
});
router.get('/orders/:id',requireUser,(req,res)=>{
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if(!order)return res.status(404).send('Order not found');
  const items=db.prepare('SELECT products.name, order_items.quantity FROM order_items JOIN products ON products.id=order_items.product_id WHERE order_id=?').all(order.id);
  page(req,res,'Order details',`<div class="page-heading"><h1>Order #${order.id}</h1></div><div class="panel"><p>Status: ${escapeHtml(order.status)}</p><p>Total: $${(order.total_cents/100).toFixed(2)}</p>${items.map(i=>`<p>${escapeHtml(i.name)} × ${i.quantity}</p>`).join('')}<a href="/statements/${order.id}">Download statement</a></div>`);
});
router.get('/statements/:filename',requireUser,(req,res)=>{
  const filename=String(req.params.filename);
  const file=path.join(base,'statements',filename+'.txt');
  fs.readFile(file,'utf8',(err,data)=>{
    if(err)return res.status(404).send('Statement not available');
    res.type('text/plain').send(data);
  });
});
router.get('/receipts/:filename',requireUser,(req,res)=>{
  const requested=String(req.params.filename||'');
  const filename=path.basename(requested);
  const receipts=path.join(base,'receipts');
  const file=path.resolve(receipts,filename);
  if(!file.startsWith(receipts+path.sep))return res.status(400).send('Invalid receipt');
  fs.readFile(file,'utf8',(err,data)=>err?res.status(404).send('Not found'):res.type('text/plain').send(data));
});
module.exports=router;
