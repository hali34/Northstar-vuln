const express=require('express');
const { requireUser }=require('../lib/auth');
const { page }=require('../lib/render');
const router=express.Router();
router.get('/account/preferences/widget',requireUser,(req,res)=>{
  const origin=req.get('Origin')||'';
  const trusted=['https://www.northstar.example','https://partners.northstar.example'];
  if(trusted.includes(origin)){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Credentials','true');
  }
  res.json({email:req.user.email,newsletter:req.user.newsletter});
});
router.get('/order-confirmation',requireUser,(req,res)=>{
  const gift=String(req.query.gift||'').slice(0,200);
  page(req,res,'Order confirmed',`<div class="page-heading"><h1>Thank you</h1></div><div class="panel"><p id="gift-note"></p></div><script>var giftNote=${JSON.stringify(gift)};document.getElementById('gift-note').textContent=giftNote;</script>`);
});
router.get('/wishlist',requireUser,(req,res)=>{
  const title=String(req.query.title||'My wishlist').replace(/"/g,'').replace(/<script[^>]*>/gi,'');
  page(req,res,'Wishlist',`<div class="page-heading"><h1>Wishlist</h1></div><div class="panel"><form method="get"><label>List name<input name="title" value='${title}'></label><button>Rename</button></form></div>`);
});
router.get('/service/export/overview',(req,res)=>{
  res.setHeader('Content-Security-Policy',"frame-ancestors 'self'");
  res.type('html').send('<h1>Support console</h1><p>Open requests are reviewed by the staff team.</p>');
});
module.exports=router;
