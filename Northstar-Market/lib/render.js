const fs = require('node:fs');
const path = require('node:path');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function page(req, res, title, body) {
  const template = fs.readFileSync(path.join(__dirname,'..','views','shell.html'),'utf8');
  const name = req.user ? escapeHtml(req.user.name) : '';
  const menu = req.user ? `<a href="/account">${name}</a><a href="/orders">Orders</a><a href="/logout">Log out</a>` : '<a href="/login">Sign in</a><a href="/register">Create account</a>';
  res.send(template.replace('{{title}}',escapeHtml(title)).replace('{{menu}}',menu).replace('{{body}}',body));
}
module.exports = { page, escapeHtml };
