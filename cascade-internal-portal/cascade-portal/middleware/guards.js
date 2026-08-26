// Two-stage gate that mirrors a real enterprise flow:
//   1) ensureAuthenticated — did the user complete SSO with PingFederate?
//   2) ensureMfaVerified   — has this session cleared the TOTP step-up?
// Routes that should sit fully behind SSO+MFA use both, in order.

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  req.session.postLoginRedirect = req.originalUrl;
  return res.redirect('/login');
}

function ensureMfaVerified(req, res, next) {
  if (req.session.mfaVerified) return next();
  return res.redirect('/mfa/verify');
}

function ensureAdmin(req, res, next) {
  const groups = (req.user && req.user.groups) || [];
  const isAdmin = groups.some((g) => String(g).toLowerCase().includes('admin'));
  if (isAdmin) return next();
  return res.status(403).render('error', {
    title: 'Access denied',
    message: 'Your SSO groups don\u2019t include an admin role, so this page is blocked. This is the app enforcing authorization on top of authentication — being logged in isn\u2019t the same as being allowed in.',
    user: req.user
  });
}

module.exports = { ensureAuthenticated, ensureMfaVerified, ensureAdmin };
