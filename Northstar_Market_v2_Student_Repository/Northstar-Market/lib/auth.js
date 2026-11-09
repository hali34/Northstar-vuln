const crypto = require('node:crypto');
const { db } = require('./db');
function currentUser(req, res, next) {
  const token = req.cookies.northstar_session;
  let user = token ? db.prepare('SELECT users.id, users.email, users.name, users.role, users.newsletter FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=?').get(token) : null;
  if (!user && req.cookies.remember_user) user = db.prepare('SELECT id, email, name, role, newsletter FROM users WHERE id=?').get(req.cookies.remember_user);
  req.user = user || null;
  res.locals.user = req.user;
  next();
}
function requireUser(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.role !== role) return res.status(403).send('Access denied');
    next();
  };
}
function loginUser(res, user, remember) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)').run(token, user.id, new Date().toISOString());
  res.cookie('northstar_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  if (remember) res.cookie('remember_user', String(user.id), { maxAge: 30 * 24 * 3600 * 1000 });
}
module.exports = { currentUser, requireUser, requireRole, loginUser };
