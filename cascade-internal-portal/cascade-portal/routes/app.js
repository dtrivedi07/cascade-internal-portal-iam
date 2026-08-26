const express = require('express');
const store = require('../data/store');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/guards');

const router = express.Router();
router.use(ensureAuthenticated);

router.get('/dashboard', (req, res) => {
  res.render('dashboard', { title: 'Dashboard', user: req.user });
});

router.get('/profile', (req, res) => {
  res.render('profile', { title: 'Your profile', user: req.user });
});

router.get('/reports', (req, res) => {
  res.render('reports', { title: 'Reports', user: req.user, reports: store.getReports() });
});

router.get('/admin', ensureAdmin, (req, res) => {
  res.render('admin', { title: 'Admin', user: req.user });
});

router.post('/admin/reset-mfa', ensureAdmin, (req, res) => {
  store.clearMfaSecret(req.user.email || req.user.id);
  req.session.mfaVerified = false;
  res.redirect('/mfa/setup');
});

module.exports = router;
