const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const base = path.join(__dirname, '..', 'runtime');
fs.mkdirSync(base, { recursive: true });
const db = new Database(path.join(base, 'market.db'));
db.pragma('journal_mode = WAL');
const hashPassword = password => crypto.scryptSync(password, 'northstar-local-demo', 64).toString('hex');

db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, role TEXT, name TEXT, newsletter INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER, created_at TEXT);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, price_cents INTEGER, image TEXT, description TEXT, stock INTEGER);
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER, total_cents INTEGER, status TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS order_items (order_id INTEGER, product_id INTEGER, quantity INTEGER, unit_cents INTEGER);
CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY, product_id INTEGER, user_id INTEGER, body TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS coupons (code TEXT PRIMARY KEY, discount_cents INTEGER, min_cents INTEGER);
CREATE TABLE IF NOT EXISTS password_resets (email TEXT, token TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS seller_assets (id INTEGER PRIMARY KEY, user_id INTEGER, url TEXT, filename TEXT, content_type TEXT);
`);
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0) {
  const addUser = db.prepare('INSERT INTO users (email,password_hash,role,name) VALUES (?,?,?,?)');
  addUser.run('alex@example.test', hashPassword('Welcome123!'), 'customer', 'Alex Rivera');
  addUser.run('blair@example.test', hashPassword('Welcome123!'), 'customer', 'Blair Chen');
  addUser.run('seller@example.test', hashPassword('Welcome123!'), 'seller', 'Taylor Seller');
  addUser.run('support@example.test', hashPassword('Welcome123!'), 'support', 'Morgan Support');
  const addProduct = db.prepare('INSERT INTO products (name,category,price_cents,image,description,stock) VALUES (?,?,?,?,?,?)');
  const catalog = [
    ['Ridgefield Daypack','Travel',7900,'/images/daypack.svg','Everyday carry with weatherproof fabric.',45],
    ['Studio Ceramic Mug','Home',2200,'/images/mug.svg','A hand-finished cup for slow mornings.',120],
    ['Summit Water Bottle','Outdoor',3500,'/images/bottle.svg','Lightweight steel with an insulated sleeve.',85],
    ['Canvas Weekender','Travel',10900,'/images/weekender.svg','Room for a few days away.',35],
    ['Desk Organizer','Home',4900,'/images/organizer.svg','Keep essentials within reach.',60],
    ['Trail Notebook','Outdoor',1800,'/images/notebook.svg','Durable pages for adventures.',150]
  ];
  for (const row of catalog) addProduct.run(...row);
  db.prepare('INSERT INTO orders (user_id,total_cents,status,created_at) VALUES (1,10100,?,?)').run('Shipped',new Date().toISOString());
  db.prepare('INSERT INTO orders (user_id,total_cents,status,created_at) VALUES (2,3500,?,?)').run('Processing',new Date().toISOString());
  db.prepare('INSERT INTO coupons (code,discount_cents,min_cents) VALUES (?,?,?)').run('WELCOME10',1000,3000);
  db.prepare('INSERT INTO reviews (product_id,user_id,body,created_at) VALUES (?,?,?,?)').run(1,1,'Perfect size for a day out.',new Date().toISOString());
}
for (const folder of ['statements','receipts']) fs.mkdirSync(path.join(base,folder),{recursive:true});
for(const id of [1,2]) { const dest=path.join(base,'statements',id+'.txt'); if(!fs.existsSync(dest))fs.copyFileSync(path.join(__dirname,'..','fixtures','statements',id+'.txt'),dest); }
module.exports = { db, hashPassword, base };

db.exec('CREATE TABLE IF NOT EXISTS merchant_refunds (id INTEGER PRIMARY KEY, order_id INTEGER, user_id INTEGER, amount_cents REAL, status TEXT)');
