const crypto = require('node:crypto');
const { db } = require('./db');
function currentUser(req, res, next) {
  const token = req.cookies.northstar_session;
  req.user = token ? db.prepare('SELECT users.id, users.email, users.name, users.role, users.newsletter FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=?').get(token) : null;
  res.locals.user = req.user;
  next();
}
function requireUser(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}
function requireRole(role) {
  return (req,res,next) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.role !== role) return res.status(403).send('Access denied');
    next();
  };
}
function loginUser(res, user) {
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)').run(token,user.id,new Date().toISOString());
  res.cookie('northstar_session',token,{httpOnly:true,sameSite:'lax'});
}
module.exports = { currentUser, requireUser, requireRole, loginUser };
