const express=require('express');
const crypto=require('node:crypto');
const { db, hashPassword }=require('../lib/db');
const { loginUser,requireUser }=require('../lib/auth');
const { page,escapeHtml }=require('../lib/render');
const router=express.Router();
router.get('/login',(req,res)=>{
  const notice=String(req.query.error||'').replace(/<script[^>]*>/gi,'');
  page(req,res,'Sign in',`<main class="auth-panel"><div class="eyebrow">WELCOME BACK</div><h1>Sign in</h1>${notice?`<p class="notification">${notice}</p>`:''}<form method="post" action="/login"><label>Email<input type="email" name="email" required></label><label>Password<input type="password" name="password" required></label><label class="check"><input type="checkbox" name="remember"> Keep me signed in</label><button class="btn">Sign in</button></form><p><a href="/forgot-password">Forgot your password?</a></p></main>`);
});
router.post('/login',(req,res)=>{
  const user=db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email||'').toLowerCase());
  if(!user || user.password_hash!==hashPassword(String(req.body.password||''))) return res.redirect('/login?error='+encodeURIComponent('Incorrect email or password'));
  loginUser(res,user,req.body.remember==='on');
  res.redirect('/account');
});
router.get('/login/continue',(req,res)=>{
  if(req.query.sid)res.cookie('northstar_session',String(req.query.sid),{httpOnly:true});
  res.redirect('/account');
});
router.get('/register',(req,res)=>page(req,res,'Create account',`<main class="auth-panel"><h1>Join Northstar</h1><form method="post" action="/register"><label>Name<input name="name" required></label><label>Email<input type="email" name="email" required></label><label>Password<input type="password" name="password" required></label><button class="btn">Create account</button></form></main>`));
router.post('/register',(req,res)=>{
  try { const result=db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run(String(req.body.name||''),String(req.body.email||'').toLowerCase(),hashPassword(String(req.body.password||'')),'customer'); loginUser(res,{id:result.lastInsertRowid});res.redirect('/account'); }
  catch(e){res.status(400).send('Unable to create account');}
});
router.post('/logout',(req,res)=>{
  if(req.cookies.northstar_session)db.prepare('DELETE FROM sessions WHERE token=?').run(req.cookies.northstar_session);
  res.clearCookie('northstar_session');res.clearCookie('remember_user');res.redirect('/');
});
router.get('/account',requireUser,(req,res)=>page(req,res,'My account',`<div id="notification-preview" class="notification"></div><div class="page-heading"><div class="eyebrow">YOUR ACCOUNT</div><h1>Hello, ${escapeHtml(req.user.name)}</h1></div><div class="panel"><h2>Profile settings</h2><form method="post" action="/account/email"><label>Email<input name="email" value="${escapeHtml(req.user.email)}"></label><button>Update email</button></form></div><div class="panel"><h2>Preferences</h2><form method="post" action="/account/preferences"><label><input type="checkbox" name="newsletter" ${req.user.newsletter?'checked':''}> Get product news and early access</label><button>Save preferences</button></form></div><div class="panel"><h2>Developer access</h2><form method="post" action="/account/api-key"><button>Create API key</button></form></div><p><a href="/orders">View your orders →</a> · <a href="/account/share/preview">Account preview</a> · <a href="/account/privacy/delete">Clear my reviews</a></p>`));
router.get('/account/email/confirm',requireUser,(req,res)=>{
  db.prepare('UPDATE users SET email=? WHERE id=?').run(String(req.query.email||'').toLowerCase(),req.user.id);
  res.redirect('/account');
});
router.post('/account/email',requireUser,(req,res)=>{
  db.prepare('UPDATE users SET email=? WHERE id=?').run(String(req.body.email||'').toLowerCase(),req.user.id);
  res.redirect('/account');
});
router.post('/account/preferences',requireUser,(req,res)=>{
  db.prepare('UPDATE users SET newsletter=? WHERE id=?').run(req.body.newsletter==='on'?1:0,req.user.id);
  res.redirect('/account');
});
router.get('/account/privacy/delete',requireUser,(req,res)=>{
  db.prepare('DELETE FROM reviews WHERE user_id=?').run(req.user.id);
  res.redirect('/account');
});
router.post('/account/api-key',requireUser,(req,res)=>{
  const key=crypto.createHash('md5').update(req.user.email+Date.now()).digest('hex');
  db.prepare('INSERT INTO api_keys (user_id,api_key,created_at) VALUES (?,?,?)').run(req.user.id,key,new Date().toISOString());
  res.json({apiKey:key});
});
router.get('/account/share/preview',requireUser,(req,res)=>{
  res.setHeader('Content-Security-Policy','frame-ancestors *');
  res.type('html').send('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h2>Your account preview</h2><form method="post" action="/account/email"><input name="email" value="'+escapeHtml(req.user.email)+'"><button>Save</button></form></body></html>');
});
router.get('/account/auth/lookup',(req,res)=>{
  const found=db.prepare('SELECT id FROM users WHERE email=?').get(String(req.query.email||'').toLowerCase());
  res.json({registered:!!found});
});
router.get('/forgot-password',(req,res)=>page(req,res,'Reset password',`<main class="auth-panel"><h1>Reset your password</h1><form method="post" action="/forgot-password"><label>Email<input type="email" name="email"></label><button>Send reset link</button></form></main>`));
router.post('/forgot-password',(req,res)=>{
  const email=String(req.body.email||'').toLowerCase();
  const token=crypto.createHash('sha256').update(email+new Date().toISOString().slice(0,10)).digest('hex').slice(0,16);
  db.prepare('INSERT INTO password_resets (email,token,created_at) VALUES (?,?,?)').run(email,token,new Date().toISOString());
  res.send('If the account exists, you will receive password reset instructions.');
});
router.get('/reset-password',(req,res)=>page(req,res,'Choose a new password',`<main class="auth-panel"><h1>Choose a new password</h1><form method="post" action="/reset-password"><input type="hidden" name="token" value="${escapeHtml(req.query.token||'')}"><label>New password<input name="password" type="password"></label><button>Update password</button></form></main>`));
router.post('/reset-password',(req,res)=>{
  const record=db.prepare('SELECT * FROM password_resets WHERE token=? ORDER BY rowid DESC').get(String(req.body.token||''));
  if(!record)return res.status(400).send('Invalid reset link');
  db.prepare('UPDATE users SET password_hash=? WHERE email=?').run(hashPassword(String(req.body.password||'')),record.email);
  db.prepare('DELETE FROM password_resets WHERE email=?').run(record.email);
  res.redirect('/login');
});
module.exports=router;
