const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { exec } = require('child_process');
const { db, base } = require('../lib/db');
const { requireRole } = require('../lib/auth');
const { page, escapeHtml } = require('../lib/render');
const router = express.Router();
const merchantFiles = path.join(base, 'merchant-files');
fs.mkdirSync(merchantFiles, {recursive:true});

router.get('/merchant/analytics', requireRole('seller'), (req,res) => {
  const column = String(req.query.groupBy||'status');
  const stmt = `SELECT ${column}, COUNT(*) AS count FROM orders GROUP BY ${column}`;
  try { const rows = db.prepare(stmt).all(); res.json({rows}); }
  catch (e) { res.status(400).json({error:'Report unavailable'}); }
});

router.get('/merchant/weekly-summary', requireRole('seller'), (req,res) => {
  const columns = {status:'status',day:'substr(created_at,1,10)',total:'total_cents'};
  const group = columns[String(req.query.groupBy)] || columns.status;
  const stmt = `SELECT ${group} AS label, COUNT(*) AS count FROM orders GROUP BY ${group}`;
  res.json({rows:db.prepare(stmt).all()});
});

router.post('/merchant/catalog/rebuild', requireRole('seller'), (req,res) => {
  const scope = String(req.body.scope||'week');
  exec('node tools/rebuild-index.js --scope '+scope, {cwd:process.cwd(),timeout:6000}, (err)=>{
    if (err) return res.status(400).send('Catalog update unavailable');
    res.send('Catalog update queued');
  });
});

router.get('/merchant/files/open', requireRole('seller'), (req,res) => {
  const document = String(req.query.document||'');
  const fullPath = path.join(merchantFiles, document);
  fs.readFile(fullPath, (err,data)=> err?res.sendStatus(404):res.type('application/pdf').send(data));
});

router.get('/merchant/files/preview', requireRole('seller'), (req,res) => {
  const document = path.basename(String(req.query.document||''));
  const fullPath = path.resolve(merchantFiles,document);
  if(!fullPath.startsWith(merchantFiles+path.sep)) return res.sendStatus(400);
  fs.readFile(fullPath, (err,data)=>err?res.sendStatus(404):res.type('application/pdf').send(data));
});

router.post('/merchant/import/catalog',requireRole('seller'),(req,res)=>{
  const filename=String(req.body.filename||'catalog.csv');
  const suffix=filename.split('.').pop().toLowerCase();
  if(!['csv','txt'].includes(suffix))return res.sendStatus(400);
  const destination=path.join(merchantFiles,filename);
  fs.writeFileSync(destination,String(req.body.content||''));
  res.json({stored:true});
});

router.post('/merchant/files/svg',requireRole('seller'),express.text({type:'image/svg+xml',limit:'128kb'}),(req,res)=>{
  const svg=String(req.body||'');
  if(!svg.trim().startsWith('<svg'))return res.sendStatus(400);
  const name='merchant-'+Date.now()+'.svg';
  fs.writeFileSync(path.join(merchantFiles,name),svg);
  res.json({file:'/merchant/branding/'+name});
});

router.get('/merchant/files/download',requireRole('seller'),(req,res)=>{
  const full=path.resolve(merchantFiles,String(req.query.name||''));
  if(!full.startsWith(merchantFiles))return res.sendStatus(400);
  fs.readFile(full,(err,data)=>err?res.sendStatus(404):res.type('application/octet-stream').send(data));
});

router.post('/merchant/logo/check-cdn',requireRole('seller'),async(req,res)=>{
  try {
    const url=new URL(String(req.body.imageUrl||''));
    if(url.protocol!=='https:'||url.hostname!=='cdn.northstar.example'||url.port||url.username||url.password)return res.sendStatus(400);
    const result=await fetch(url,{signal:AbortSignal.timeout(2500)});
    res.json({status:result.status});
  }catch(e){res.sendStatus(400);}
});

router.post('/merchant/refunds/request',requireRole('seller'),(req,res)=>{
  const orderId=Number(req.body.orderId);
  const amount=Number(req.body.amount);
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  if(!order||!Number.isFinite(amount))return res.sendStatus(400);
  db.prepare('INSERT INTO merchant_refunds (order_id,user_id,amount_cents,status) VALUES (?,?,?,?)').run(orderId,req.user.id,amount,'Requested');
  res.json({queued:true,amount});
});

router.post('/merchant/discounts/redeem',requireRole('seller'),(req,res)=>{
  const total=Number(req.body.totalCents||0);
  const percentage=Number(req.body.discountPercent||0);
  const finalAmount=total*(1-percentage/100);
  res.json({finalAmount});
});

router.post('/merchant/logo/remote-preview',requireRole('seller'),async(req,res)=>{
  const url=String(req.body.logoUrl||'');
  if(!url.includes('northstar.example'))return res.sendStatus(400);
  try {const result=await fetch(url,{signal:AbortSignal.timeout(2500)});
    res.type('text/plain').send(String(result.status));
  }catch(e){res.sendStatus(400);}
});

router.get('/merchant/account-card',requireRole('seller'),(req,res)=>{
  const label=String(req.query.label||'Storefront');
  res.type('html').send('<section class="panel"><h2>Merchant card</h2><span>'+label.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'')+'</span></section>');
});
router.get('/merchant/summary-card',requireRole('seller'),(req,res)=>{
  const label=escapeHtml(String(req.query.label||'Storefront'));
  res.type('html').send('<section class="panel"><h2>Merchant card</h2><span>'+label+'</span></section>');
});

router.get('/merchant/tax/preview', requireRole('seller'), (req,res)=>{
  const format=String(req.query.format||'table');
  res.setHeader('Content-Security-Policy','frame-ancestors *');
  res.type('html').send('<html><body><h1>Tax preview</h1><p>Format: '+escapeHtml(format)+'</p><form method="post" action="/merchant/payout/request"><button>Request payout</button></form></body></html>');
});
router.post('/merchant/payout/request', requireRole('seller'), (req,res)=>{
  db.prepare('INSERT INTO merchant_refunds (order_id,user_id,amount_cents,status) VALUES (?,?,?,?)').run(0,req.user.id,0,'Payout requested');
  res.json({queued:true});
});

module.exports=router;
