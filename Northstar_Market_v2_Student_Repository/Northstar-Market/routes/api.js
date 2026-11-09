const express=require('express');
const { db }=require('../lib/db');
const { requireUser }=require('../lib/auth');
const router=express.Router();
router.get('/api/catalog',(req,res)=>{
  const rows=db.prepare('SELECT id,name,price_cents,category FROM products LIMIT 40').all();
  res.json({items:rows});
});
router.get('/api/profile',requireUser,(req,res)=>res.json({name:req.user.name,email:req.user.email,newsletter:!!req.user.newsletter}));
router.get('/api/orders/:id',requireUser,(req,res)=>{
  const order=db.prepare('SELECT id,total_cents,status,created_at FROM orders WHERE id=?').get(req.params.id);
  if(!order)return res.status(404).json({error:'Unknown order'});
  res.json(order);
});
router.get('/api/orders/:id/status',requireUser,(req,res)=>{
  const order=db.prepare('SELECT status FROM orders WHERE id=? AND user_id=?').get(req.params.id,req.user.id);
  if(!order)return res.status(404).json({error:'Unknown order'});
  res.json({status:order.status});
});
router.get('/api/recommendations',requireUser,(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin',req.get('Origin')||'*');
  res.setHeader('Access-Control-Allow-Credentials','true');
  res.json({customer:req.user.email,featured:db.prepare('SELECT id,name FROM products ORDER BY id LIMIT 3').all()});
});
router.get('/api/insights',(req,res)=>{
  const region=String(req.query.region||'us');
  res.type('html').send(`<html><body><h1>Northstar Trends</h1><p>Region: ${region.replace(/[^a-z]/gi,'')}</p></body></html>`);
});
module.exports=router;
