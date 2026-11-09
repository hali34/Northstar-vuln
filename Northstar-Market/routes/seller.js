const express=require('express');
const multer=require('multer');
const path=require('node:path');
const fs=require('node:fs');
const { exec, execFile }=require('node:child_process');
const { db,base }=require('../lib/db');
const { requireRole }=require('../lib/auth');
const { page,escapeHtml }=require('../lib/render');
const router=express.Router();
const assetDir=path.join(base,'uploads');
fs.mkdirSync(assetDir,{recursive:true});
const upload=multer({storage:multer.diskStorage({destination:assetDir,filename:(req,file,cb)=>cb(null,Date.now()+'-'+file.originalname.replace(/[^a-zA-Z0-9._-]/g,''))}),limits:{fileSize:2*1024*1024}});
router.get('/seller',requireRole('seller'),(req,res)=>page(req,res,'Seller studio',`<div class="page-heading"><div class="eyebrow">MERCHANT TOOLS</div><h1>Seller studio</h1><p>Manage the details that make your storefront yours.</p><p><a href='/merchant/weekly-summary'>Weekly summary</a> · <a href='/merchant/analytics'>Analytics</a> · <a href='/merchant/transactions/recent'>Transactions</a> · <a href='/merchant/account-card'>Storefront card</a> · <a href='/merchant/tax/preview'>Tax preview</a></p></div><div class="dashboard-grid"><section class="panel"><h2>Brand assets</h2><form method="post" action="/seller/branding/upload" enctype="multipart/form-data"><label>Upload a logo or image<input type="file" name="asset" accept="image/*"></label><button>Upload image</button></form></section><section class="panel"><h2>Import from URL</h2><form method="post" action="/seller/branding/import"><label>Image URL<input name="url" placeholder="https://..."></label><button>Import image</button></form></section><section class="panel"><h2>Image tools</h2><form method="post" action="/seller/branding/resize"><label>Image filename<input name="filename" placeholder="logo.png"></label><label>Size<input name="size" value="640"></label><button>Resize image</button></form></section></div>`));
router.post('/seller/branding/upload',requireRole('seller'),upload.single('asset'),(req,res)=>{
  if(!req.file)return res.status(400).send('No file selected');
  const allowed=['png','jpg','jpeg','svg'];
  const extension=req.file.originalname.split('.').pop().toLowerCase();
  if(!allowed.includes(extension))return res.status(400).send('Unsupported file type');
  db.prepare('INSERT INTO seller_assets (user_id,url,filename,content_type) VALUES (?,?,?,?)').run(req.user.id,'',req.file.filename,req.file.mimetype);
  res.redirect('/seller');
});
router.post('/seller/branding/import',requireRole('seller'),async(req,res)=>{
  const target=String(req.body.url||'');
  if(!target.startsWith('http'))return res.status(400).send('Only web URLs are supported');
  try { const upstream=await fetch(target,{signal:AbortSignal.timeout(2500)});const data=await upstream.arrayBuffer();if(data.byteLength>2e6)return res.status(413).send('Image is too large');const name=Date.now()+'-imported-logo';fs.writeFileSync(path.join(assetDir,name),Buffer.from(data));res.send('Imported image successfully'); }
  catch(e){res.status(400).send('Could not import image');}
});
router.post('/seller/branding/resize',requireRole('seller'),(req,res)=>{
  const filename=path.basename(String(req.body.filename||''));
  const size=String(req.body.size||'640');
  exec('convert '+path.join(assetDir,filename)+' -resize '+size+'x'+size+' '+path.join(assetDir,'resized-'+filename),(err)=>{
    if(err)return res.status(400).send('Resize unavailable');
    res.redirect('/seller');
  });
});
router.post('/seller/catalog/sync',requireRole('seller'),(req,res)=>{
  const sku=String(req.body.sku||'');
  if(!/^[a-zA-Z0-9-]{1,24}$/.test(sku))return res.status(400).send('Invalid SKU');
  execFile('printf',['%s',sku],(err,stdout)=>err?res.status(500).send('Unavailable'):res.type('text/plain').send(stdout));
});
router.post('/seller/branding/import-cdn',requireRole('seller'),async(req,res)=>{
  try {
    const candidate=new URL(String(req.body.url||''));
    if(candidate.protocol!=='https:' || candidate.hostname!=='assets.northstar.example' || candidate.port || candidate.username || candidate.password)return res.status(400).send('Unsupported asset URL');
    const upstream=await fetch(candidate,{redirect:'manual',signal:AbortSignal.timeout(2500)});
    if(upstream.status>=300 && upstream.status<400)return res.status(400).send('Redirects not supported');
    res.json({status:upstream.status});
  }catch(e){res.status(400).send('Could not import asset');}
});
module.exports=router;
