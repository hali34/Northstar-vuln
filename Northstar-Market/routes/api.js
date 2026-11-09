const express=require('express');
const { db }=require('../lib/db');
const { requireUser }=require('../lib/auth');
const router=express.Router();
router.get('/api/catalog',(req,res)=>{
  const rows=db.prepare('SELECT id,name,price_cents,category FROM products LIMIT 40').all();
  res.json({items:rows});
});
router.get('/api/cart/estimate',(req,res)=>{
  const qty=Number(req.query.quantity||1);
  const product=db.prepare('SELECT price_cents FROM products WHERE id=?').get(req.query.productId);
  if(!product)return res.status(404).json({error:'Unknown product'});
  res.json({totalCents:product.price_cents*qty});
});
router.get('/api/recommendations',requireUser,(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin',req.get('Origin')||'*');
  res.setHeader('Access-Control-Allow-Credentials','true');
  res.json({customer:req.user.email,featured:db.prepare('SELECT id,name FROM products ORDER BY id LIMIT 3').all()});
});
router.get('/api/checkout/status',requireUser,(req,res)=>res.json({ready:true,user:req.user.name}));
router.get('/api/profile',requireUser,(req,res)=>res.json({name:req.user.name,email:req.user.email,newsletter:!!req.user.newsletter}));
router.get('/api/wishlist-preview',(req,res)=>{
  const { escapeHtml }=require('../lib/render');
  res.json({label:escapeHtml(String(req.query.title||''))});
});
router.get('/api/insights',(req,res)=>{
  const region=String(req.query.region||'us');
  res.setHeader('Content-Security-Policy','frame-ancestors *');
  res.type('html').send(`<html><body><h1>Northstar Trends</h1><p>Region: ${region.replace(/[^a-z]/gi,'')}</p></body></html>`);
});
module.exports=router;
