const express=require('express');
const { db }=require('../lib/db');
const { requireRole }=require('../lib/auth');
const { page,escapeHtml }=require('../lib/render');
const router=express.Router();
router.get('/support',requireRole('support'),(req,res)=>{
  const recent=db.prepare('SELECT orders.id,orders.status,users.email FROM orders JOIN users ON users.id=orders.user_id ORDER BY orders.id DESC LIMIT 20').all();
  page(req,res,'Support desk',`<div class="page-heading"><div class="eyebrow">SUPPORT CONSOLE</div><h1>Order support</h1></div><div class="panel"><form method="get" action="/support/orders"><label>Find orders by customer email<input name="email" placeholder="customer@example.com"></label><button>Find orders</button></form>${recent.map(o=>`<div class="cartline"><span>#${o.id} · ${escapeHtml(o.email)}</span><span>${escapeHtml(o.status)}</span></div>`).join('')}</div>`);
});
router.get('/support/orders',requireRole('support'),(req,res)=>{
  const email=String(req.query.email||'');
  const orders=db.prepare('SELECT orders.* FROM orders JOIN users ON users.id=orders.user_id WHERE users.email=?').all(email);
  page(req,res,'Support results',`<div class="page-heading"><h1>Order lookup</h1></div><p>${escapeHtml(email)}</p><div class="panel">${orders.map(o=>`<p>Order #${o.id} — ${escapeHtml(o.status)}</p>`).join('')||'<p>No matching orders.</p>'}</div>`);
});
router.get('/support/status',requireRole('support'),(req,res)=>{
  const show=req.query.details==='1';
  const details=show?JSON.stringify({runtime:process.version,workingDirectory:process.cwd(),environment:process.env},null,2):'Ready';
  res.type('text/plain').send(details);
});
router.get('/support/reports',requireRole('support'),(req,res)=>{
  const q=String(req.query.email||'');
  const sql='SELECT id,email,role FROM users WHERE email LIKE ? ORDER BY id LIMIT 100';
  const users=db.prepare(sql).all('%'+q+'%');
  page(req,res,'Customer directory',`<div class="page-heading"><h1>Customer directory</h1></div><div class="panel">${users.map(x=>`<p>${escapeHtml(x.email)} · ${escapeHtml(x.role)}</p>`).join('')}</div>`);
});

router.get('/support/returns/search',requireRole('support'),(req,res)=>{
  const email=String(req.query.customer||'');
  const statement="SELECT orders.id,orders.status FROM orders JOIN users ON users.id=orders.user_id WHERE users.email='"+email+"'";
  try {res.json({results:db.prepare(statement).all()});}
  catch(error){res.status(400).json({error:'Could not find returns'});}
});

router.post('/support/cases/verify',requireRole('support'),(req,res)=>{
  const reference=String(req.body.reference||'');
  exec('grep -R '+reference+' ./runtime/receipts',{timeout:3500},(error,output)=>{
    if(error)return res.sendStatus(400);
    res.type('text/plain').send(output);
  });
});

router.get('/support/announcements/preview',requireRole('support'),(req,res)=>{
  const message=String(req.query.message||'Maintenance planned');
  res.send('<section><h1>Service announcement</h1><p>'+message+'</p></section>');
});

router.get('/support/orders/detail',requireRole('support'),(req,res)=>{
  const row=db.prepare('SELECT * FROM orders WHERE id=?').get(req.query.orderId);
  if(!row)return res.sendStatus(404);
  res.json(row);
});

module.exports=router;
