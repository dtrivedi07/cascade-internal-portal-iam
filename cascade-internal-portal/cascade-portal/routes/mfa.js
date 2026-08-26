const express = require('express');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const store = require('../data/store');
const { ensureAuthenticated } = require('../middleware/guards');

const router = express.Router();

// Slow down brute-forcing of the 6-digit code.
const mfaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many code attempts. Wait a few minutes and try again.'
});

function userKey(req) {
  return req.user.email || req.user.id;
}

// GET /mfa/verify — shown every fresh SSO login once a secret is enrolled
router.get('/mfa/verify', ensureAuthenticated, (req, res) => {
  const record = store.getMfaSecret(userKey(req));
  if (!record) return res.redirect('/mfa/setup');
  res.render('mfa-verify', { title: 'Verify your identity', error: null });
});

router.post('/mfa/verify', ensureAuthenticated, mfaLimiter, (req, res) => {
  const record = store.getMfaSecret(userKey(req));
  if (!record) return res.redirect('/mfa/setup');

  const { token } = req.body;
  const isValid = authenticator.check(String(token || '').trim(), record.secret);

  if (!isValid) {
    return res.status(401).render('mfa-verify', {
      title: 'Verify your identity',
      error: 'That code didn\u2019t match (or expired). Codes rotate every 30 seconds — check the time on your device and try the current one.'
    });
  }

  req.session.mfaVerified = true;
  const redirectTo = req.session.postLoginRedirect || '/dashboard';
  delete req.session.postLoginRedirect;
  res.redirect(redirectTo);
});

// GET /mfa/setup — first-time enrollment, generates a secret + QR code
router.get('/mfa/setup', ensureAuthenticated, async (req, res, next) => {
  try {
    const existing = store.getMfaSecret(userKey(req));
    if (existing) return res.redirect('/mfa/verify');

    // Secret is generated per visit and only persisted once confirmed below,
    // so an abandoned setup doesn't leave an unusable partial enrollment.
    const secret = authenticator.generateSecret();
    req.session.pendingMfaSecret = secret;

    const otpauth = authenticator.keyuri(
      userKey(req),
      process.env.MFA_ISSUER_NAME || 'Cascade Internal Portal',
      secret
    );
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    res.render('mfa-setup', {
      title: 'Set up multi-factor authentication',
      qrDataUrl,
      manualSecret: secret,
      error: null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/mfa/setup', ensureAuthenticated, mfaLimiter, async (req, res, next) => {
  try {
    const secret = req.session.pendingMfaSecret;
    if (!secret) return res.redirect('/mfa/setup');

    const { token } = req.body;
    const isValid = authenticator.check(String(token || '').trim(), secret);

    if (!isValid) {
      const otpauth = authenticator.keyuri(userKey(req), process.env.MFA_ISSUER_NAME || 'Cascade Internal Portal', secret);
      const qrDataUrl = await QRCode.toDataURL(otpauth);
      return res.status(401).render('mfa-setup', {
        title: 'Set up multi-factor authentication',
        qrDataUrl,
        manualSecret: secret,
        error: 'That code didn\u2019t verify. Make sure you scanned the current QR code, then try the 6-digit code your app shows right now.'
      });
    }

    store.setMfaSecret(userKey(req), secret);
    delete req.session.pendingMfaSecret;
    req.session.mfaVerified = true;

    const redirectTo = req.session.postLoginRedirect || '/dashboard';
    delete req.session.postLoginRedirect;
    res.redirect(redirectTo);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
