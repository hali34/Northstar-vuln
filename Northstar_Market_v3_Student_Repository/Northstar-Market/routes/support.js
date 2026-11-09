const express=require('express');
const { db }=require('../lib/db');
const { requireUser,requireRole,loginUser }=require('../lib/auth');
const { page,escapeHtml }=require('../lib/render');
const router=express.Router();
router.get('/help',requireUser,(req,res)=>page(req,res,'Help centre',`<div class="page-heading"><h1>Contact support</h1></div><div class="panel"><form method="post" action="/help/ticket"><label>Subject<input name="subject" required></label><label>Message<textarea name="body" required></textarea></label><button class="btn">Send</button></form></div>`));
router.post('/help/ticket',requireUser,(req,res)=>{
  db.prepare('INSERT INTO tickets (user_id,subject,body,created_at) VALUES (?,?,?,?)').run(req.user.id,String(req.body.subject||'').slice(0,120),String(req.body.body||'').slice(0,2000),new Date().toISOString());
  res.redirect('/help');
});
router.get('/staff/login',(req,res)=>page(req,res,'Staff sign in',`<main class="auth-panel"><h1>Staff sign in</h1><form method="post" action="/staff/login"><label>Email<input type="email" name="email" required></label><label>Staff PIN<input type="password" name="pin" required></label><button class="btn">Sign in</button></form></main>`));
router.post('/staff/login',(req,res)=>{
  const pin=process.env.STAFF_PIN||'northstar-2024';
  const user=db.prepare('SELECT * FROM users WHERE email=? AND role=?').get(String(req.body.email||'').toLowerCase(),'support');
  if(!user || req.body.pin!==pin)return res.status(401).send('Incorrect details');
  loginUser(res,user);
  res.redirect('/support');
});
router.get('/support',requireRole('support'),(req,res)=>{
  const recent=db.prepare('SELECT orders.id,orders.status,users.email FROM orders JOIN users ON users.id=orders.user_id ORDER BY orders.id DESC LIMIT 20').all();
  page(req,res,'Support desk',`<div class="page-heading"><div class="eyebrow">SUPPORT CONSOLE</div><h1>Order support</h1><p><a href="/support/tickets">Open tickets</a></p></div><div class="panel"><form method="get" action="/support/orders"><label>Find orders by customer email<input name="email" placeholder="customer@example.com"></label><button>Find orders</button></form>${recent.map(o=>`<div class="cartline"><span>#${o.id} · ${escapeHtml(o.email)}</span><span>${escapeHtml(o.status)}</span></div>`).join('')}</div>`);
});
router.get('/support/orders',requireRole('support'),(req,res)=>{
  const orders=db.prepare("SELECT orders.* FROM orders JOIN users ON users.id=orders.user_id WHERE users.email='"+String(req.query.email||'').replace(/--/g,'')+"'").all();
  page(req,res,'Support results',`<div class="page-heading"><h1>Order lookup</h1></div><p>${escapeHtml(String(req.query.email||''))}</p><div class="panel">${orders.map(o=>`<p>Order #${o.id} — ${escapeHtml(o.status)}</p>`).join('')||'<p>No matching orders.</p>'}</div>`);
});
router.get('/support/tickets',requireRole('support'),(req,res)=>{
  const tickets=db.prepare('SELECT tickets.*,users.email FROM tickets JOIN users ON users.id=tickets.user_id ORDER BY tickets.id DESC LIMIT 50').all();
  page(req,res,'Tickets',`<div class="page-heading"><h1>Open tickets</h1></div><div class="panel">${tickets.map(t=>`<div class="review"><strong>${escapeHtml(t.subject)}</strong> · ${escapeHtml(t.email)}<div>${t.body.replace(/<script[^>]*>/gi,'')}</div></div>`).join('')||'<p>No open tickets.</p>'}</div>`);
});
router.get('/support/status',requireRole('support'),(req,res)=>{
  const show=req.query.details==='1';
  const details=show?JSON.stringify({runtime:process.version,workingDirectory:process.cwd(),environment:process.env},null,2):'Ready';
  res.type('text/plain').send(details);
});
router.get('/service/upload/errors',requireRole('support'),(req,res)=>{
  const item=String(req.query.path||'');
  try {if(!item)throw new Error('Missing upload path');res.json({queued:item});}
  catch(e){res.status(500).send(e.stack);}
});
router.post('/service/orders/change-status',requireUser,(req,res)=>{
  const orderId=Number(req.body.orderId||0);
  const status=String(req.body.status||'Processing');
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(status,orderId);
  res.json({updated:true});
});
module.exports=router;
