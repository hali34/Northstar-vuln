const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const { currentUser } = require('./lib/auth');
const { base } = require('./lib/db');
const app = express();
app.disable('x-powered-by');
app.use((req,res,next) => { res.setHeader('X-Frame-Options','SAMEORIGIN'); res.setHeader('X-Content-Type-Options','nosniff'); next(); });
app.use(express.json({limit:'250kb'}));
app.use(express.urlencoded({extended:false,limit:'250kb'}));
app.use(cookieParser());
app.use((req,res,next) => {
  if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (!origin) return next();
  try { if (new URL(origin).host !== req.get('Host')) return res.status(403).send('Cross-site request blocked'); }
  catch (e) { return res.status(403).send('Cross-site request blocked'); }
  next();
});
app.use(currentUser);
app.use('/static', express.static(path.join(__dirname,'public')));
app.use('/images', express.static(path.join(__dirname,'public','images')));
app.use('/uploads', express.static(path.join(base,'uploads')));
app.use('/merchant/branding', express.static(path.join(base,'merchant-files')));
app.use(require('./routes/store'));
app.use(require('./routes/account'));
app.use(require('./routes/orders'));
app.use(require('./routes/seller'));
app.use(require('./routes/support'));
app.use(require('./routes/api'));
app.use(require('./routes/merchant-operations'));
app.use(require('./routes/experience'));
app.use((req,res) => res.status(404).send('Page not found'));
app.use((err,req,res,next) => { if (res.headersSent) return next(err); res.status(500).send('Something went wrong'); });
const port = Number(process.env.PORT || 3000);
app.listen(port,'127.0.0.1',()=> process.stdout.write(`Northstar Market listening on http://127.0.0.1:${port}\n`));
