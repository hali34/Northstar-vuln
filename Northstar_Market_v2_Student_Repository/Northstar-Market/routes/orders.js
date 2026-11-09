const express=require('express');
const fs=require('node:fs');
const path=require('node:path');
const { db,base }=require('../lib/db');
const { requireUser }=require('../lib/auth');
const { page,escapeHtml }=require('../lib/render');
const router=express.Router();
router.get('/cart',requireUser,(req,res)=>{
  const lines=db.prepare('SELECT products.name,products.price_cents,cart_items.quantity FROM cart_items JOIN products ON products.id=cart_items.product_id WHERE cart_items.user_id=?').all(req.user.id);
  page(req,res,'Your cart',`<div class="page-heading"><h1>Your cart</h1></div><div class="panel">${lines.map(x=>`<div class="cartline"><span>${escapeHtml(x.name)} × ${x.quantity}</span><span>$${(x.price_cents*x.quantity/100).toFixed(2)}</span></div>`).join('')||'<p>Your cart is empty.</p>'}<form method="post" action="/checkout"><label>Promo code<input name="coupon" placeholder="Optional"></label><button class="btn">Place demo order</button></form></div>`);
});
router.post('/cart/add',requireUser,(req,res)=>{
  const quantity=Number.parseInt(req.body.quantity,10);
  const productId=Number.parseInt(req.body.productId,10);
  if(!Number.isInteger(quantity)||quantity<1||quantity>10||!Number.isInteger(productId))return res.status(400).send('Invalid quantity');
  if(!db.prepare('SELECT id FROM products WHERE id=?').get(productId))return res.status(404).send('Product not found');
  db.prepare('INSERT INTO cart_items (user_id,product_id,quantity) VALUES (?,?,?)').run(req.user.id,productId,quantity);
  res.redirect('/cart');
});
router.post('/checkout',requireUser,(req,res)=>{
  const lines=db.prepare('SELECT products.id,products.price_cents,cart_items.quantity FROM cart_items JOIN products ON products.id=cart_items.product_id WHERE cart_items.user_id=?').all(req.user.id);
  if(!lines.length)return res.redirect('/cart');
  let total=lines.reduce((sum,x)=>sum+x.price_cents*x.quantity,0);
  const code=String(req.body.coupon||'').toUpperCase();
  const coupon=db.prepare('SELECT * FROM coupons WHERE code=?').get(code);
  const used=coupon&&db.prepare('SELECT 1 AS used FROM coupon_redemptions WHERE user_id=? AND code=?').get(req.user.id,code);
  if(coupon && !used && total>=coupon.min_cents){total=Math.max(0,total-coupon.discount_cents);db.prepare('INSERT INTO coupon_redemptions (user_id,code) VALUES (?,?)').run(req.user.id,code);}
  const order=db.prepare('INSERT INTO orders (user_id,total_cents,status,created_at) VALUES (?,?,?,?)').run(req.user.id,total,'Processing',new Date().toISOString());
  const add=db.prepare('INSERT INTO order_items (order_id,product_id,quantity,unit_cents) VALUES (?,?,?,?)');
  for(const x of lines)add.run(order.lastInsertRowid,x.id,x.quantity,x.price_cents);
  db.prepare('DELETE FROM cart_items WHERE user_id=?').run(req.user.id);
  res.redirect('/orders');
});
router.get('/orders',requireUser,(req,res)=>{
  const orders=db.prepare("SELECT * FROM orders WHERE user_id="+req.user.id+" ORDER BY "+String(req.query.sort||'id').replace(/;/g,'')+" DESC").all();
  page(req,res,'Orders',`<div class="page-heading"><h1>Your orders</h1></div><div class="panel"><p class="muted">Sort by <a href="/orders?sort=id">newest</a> · <a href="/orders?sort=total_cents">total</a></p>${orders.map(o=>`<a class="cartline" href="/orders/${o.id}"><span>Order #${o.id} · ${escapeHtml(o.status)}</span><strong>$${(o.total_cents/100).toFixed(2)}</strong></a>`).join('')||'<p>No orders yet.</p>'}</div>`);
});
router.get('/orders/:id',requireUser,(req,res)=>{
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if(!order)return res.status(404).send('Order not found');
  const items=db.prepare('SELECT products.name, order_items.quantity FROM order_items JOIN products ON products.id=order_items.product_id WHERE order_id=?').all(order.id);
  const cancel=order.status==='Processing'?`<p><a href="/orders/${order.id}/cancel">Cancel this order</a></p>`:'';
  page(req,res,'Order details',`<div class="page-heading"><h1>Order #${order.id}</h1></div><div class="panel"><p>Status: ${escapeHtml(order.status)}</p><p>Total: $${(order.total_cents/100).toFixed(2)}</p>${items.map(i=>`<p>${escapeHtml(i.name)} × ${i.quantity}</p>`).join('')}<form method="get" action="/order-confirmation"><input type="hidden" name="orderId" value="${order.id}"><label>Gift message<input name="gift" maxlength="200"></label><button>Add gift note</button></form>${cancel}<a href="/statements/${order.id}">Download statement</a></div>`);
});
router.get('/orders/:id/cancel',requireUser,(req,res)=>{
  db.prepare("UPDATE orders SET status='Cancelled' WHERE id=? AND user_id=? AND status='Processing'").run(req.params.id,req.user.id);
  res.redirect('/orders');
});
router.get('/statements/:filename',requireUser,(req,res)=>{
  const filename=String(req.params.filename);
  const file=path.join(base,'statements',filename+'.txt');
  fs.readFile(file,'utf8',(err,data)=>{
    if(err)return res.status(404).send('Statement not available');
    res.type('text/plain').send(data);
  });
});
module.exports=router;
