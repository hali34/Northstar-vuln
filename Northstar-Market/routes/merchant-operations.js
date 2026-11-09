const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { exec, execFile } = require('node:child_process');
const { db, base } = require('../lib/db');
const { requireUser, requireRole } = require('../lib/auth');
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

router.post('/merchant/sku/verify', requireRole('seller'), (req,res) => {
  const code = String(req.body.sku||'');
  if(!/^[A-Z0-9-]{1,20}$/.test(code)) return res.status(400).send('Invalid SKU');
  execFile('printf',['%s',code], {timeout:3000}, (err,out)=>err?res.sendStatus(500):res.type('text/plain').send(out));
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

router.post('/merchant/logo/import',requireRole('seller'),async(req,res)=>{
  const url=String(req.body.imageUrl||'');
  if(!url.startsWith('http'))return res.sendStatus(400);
  try { const upstream=await fetch(url,{signal:AbortSignal.timeout(3000)});
    const raw=Buffer.from(await upstream.arrayBuffer());
    if(raw.length>1024*1024)return res.sendStatus(413);
    fs.writeFileSync(path.join(merchantFiles,'imported-branding'),raw);
    res.json({imported:true});
  } catch(e){res.sendStatus(400);}
});

router.post('/merchant/logo/check-cdn',requireRole('seller'),async(req,res)=>{
  try {
    const url=new URL(String(req.body.imageUrl||''));
    if(url.protocol!=='https:'||url.hostname!=='cdn.northstar.example'||url.port||url.username||url.password)return res.sendStatus(400);
    const result=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(2500)});
    if(result.status>=300&&result.status<400)return res.sendStatus(400);
    res.json({status:result.status});
  }catch(e){res.sendStatus(400);}
});

router.post('/merchant/logo/remote-preview',requireRole('seller'),async(req,res)=>{
  const url=String(req.body.logoUrl||'');
  if(!url.includes('northstar.example'))return res.sendStatus(400);
  try {const result=await fetch(url,{signal:AbortSignal.timeout(2500)});
    res.type('text/plain').send(String(result.status));
  }catch(e){res.sendStatus(400);}
});

router.post('/merchant/files/svg',requireRole('seller'),express.text({type:'image/svg+xml',limit:'128kb'}),(req,res)=>{
  const svg=String(req.body||'');
  if(!svg.trim().startsWith('<svg'))return res.sendStatus(400);
  const name='merchant-'+Date.now()+'.svg';
  fs.writeFileSync(path.join(merchantFiles,name),svg);
  res.json({file:'/merchant/branding/'+name});
});
router.get('/merchant/branding/:name',(req,res)=>{
  const name=path.basename(req.params.name);
  fs.readFile(path.join(merchantFiles,name),(err,data)=>err?res.sendStatus(404):res.type('image/svg+xml').send(data));
});

router.post('/merchant/import/catalog',requireRole('seller'),express.json({limit:'64kb'}),(req,res)=>{
  const filename=String(req.body.filename||'catalog.csv');
  const suffix=filename.split('.').pop().toLowerCase();
  if(!['csv','txt'].includes(suffix))return res.sendStatus(400);
  const destination=path.join(merchantFiles,filename);
  fs.writeFileSync(destination,String(req.body.content||''));
  res.json({stored:true});
});

router.get('/merchant/account-card',requireRole('seller'),(req,res)=>{
  const label=String(req.query.label||'Storefront');
  res.type('html').send('<section class="panel"><h2>Merchant card</h2><span>'+label.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'')+'</span></section>');
});
router.get('/merchant/summary-card',requireRole('seller'),(req,res)=>{
  const label=escapeHtml(String(req.query.label||'Storefront'));
  res.type('html').send('<section class="panel"><h2>Merchant card</h2><span>'+label+'</span></section>');
});

router.post('/merchant/tax/preview', requireRole('seller'), (req,res)=>{
  const format=String(req.body.format||'table');
  res.setHeader('Content-Security-Policy','frame-ancestors *');
  res.type('html').send('<html><body><h1>Tax preview</h1><p>Format: '+escapeHtml(format)+'</p></body></html>');
});

module.exports=router;
