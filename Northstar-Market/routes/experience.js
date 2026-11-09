const express=require('express');
const crypto=require('node:crypto');
const { db }=require('../lib/db');
const { requireUser,requireRole }=require('../lib/auth');
const { page,escapeHtml }=require('../lib/render');
const router=express.Router();

router.post('/account/profile/password',requireUser,(req,res)=>{
  const value=String(req.body.newPassword||'');
  if(value.length<8)return res.sendStatus(400);
  const nextHash=crypto.createHash('sha256').update(value).digest('hex');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(nextHash,req.user.id);
  res.redirect('/account');
});

router.get('/account/privacy/delete',requireUser,(req,res)=>{
  db.prepare('DELETE FROM reviews WHERE user_id=?').run(req.user.id);
  res.redirect('/account');
});

router.get('/account/preferences/widget',requireUser,(req,res)=>{
  const origin=req.get('Origin')||'*';
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Access-Control-Allow-Credentials','true');
  res.json({email:req.user.email,newsletter:req.user.newsletter});
});

router.get('/account/preferences/quickview',requireUser,(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin',req.get('Origin')||'*');
  res.setHeader('Access-Control-Allow-Credentials','true');
  res.json({email:req.user.email,role:req.user.role});
});

router.get('/service/order-lookup',requireUser,(req,res)=>{
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(req.query.orderId);
  if(!order)return res.sendStatus(404);
  res.json({id:order.id,totalCents:order.total_cents,status:order.status});
});

router.post('/service/orders/change-status',requireUser,(req,res)=>{
  const orderId=Number(req.body.orderId||0);
  const status=String(req.body.status||'Processing');
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(status,orderId);
  res.json({updated:true});
});

router.get('/service/diagnostics',requireRole('support'),(req,res)=>{
  res.json({runtime:process.version,workingDirectory:process.cwd(),configuration:process.env});
});

router.get('/service/upload/errors',requireRole('support'),(req,res)=>{
  const item=String(req.query.path||'');
  try {if(!item)throw new Error('Missing upload path');res.json({queued:item});}
  catch(e){res.status(500).send(e.stack);}
});

router.get('/service/export/overview',requireRole('support'),(req,res)=>{
  res.type('html').send('<h1>Support console</h1><p>Open requests are reviewed by the staff team.</p>');
});

router.get('/account/share/preview',requireUser,(req,res)=>{
  res.type('html').send('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h2>Your account preview</h2><form method="post" action="/account/profile/password"><input name="newPassword" type="password"><button>Save</button></form></body></html>');
});

router.post('/account/login/continue',(req,res)=>{
  const next=String(req.body.next||'/account');
  if(next.startsWith('/'))return res.redirect(next);
  res.redirect('/account');
});

router.get('/account/auth/lookup',(req,res)=>{
  const email=String(req.query.email||'');
  const found=db.prepare('SELECT id FROM users WHERE email=?').get(email);
  res.json({registered:!!found});
});

router.get('/account/auth/health',(req,res)=>{
  const email=String(req.query.email||'');
  db.prepare('SELECT id FROM users WHERE email=?').get(email);
  res.json({status:'ok'});
});

module.exports=router;
