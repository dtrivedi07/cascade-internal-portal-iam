const bcrypt = require('bcryptjs');
const { Strategy: LocalStrategy } = require('passport-local');

// Single break-glass account, configured entirely via env — not a user table.
// This is intentionally minimal: it exists so you can get into the app when
// PingFederate isn't reachable, not to become a second real login system.
function buildLocalStrategy() {
  return new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    (email, password, done) => {
      const configuredEmail = process.env.LOCAL_ADMIN_EMAIL;
      const configuredHash = process.env.LOCAL_ADMIN_PASSWORD_HASH;

      if (!configuredEmail || !configuredHash) {
        return done(null, false, { message: 'Local login isn\u2019t configured — set LOCAL_ADMIN_EMAIL / LOCAL_ADMIN_PASSWORD_HASH in .env.' });
      }

      if (email.toLowerCase() !== configuredEmail.toLowerCase()) {
        return done(null, false, { message: 'Invalid email or password.' });
      }

      bcrypt.compare(password, configuredHash, (err, isMatch) => {
        if (err) return done(err);
        if (!isMatch) return done(null, false, { message: 'Invalid email or password.' });

        const groups = (process.env.LOCAL_ADMIN_GROUPS || 'admin')
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean);

        return done(null, {
          protocol: 'local',
          id: configuredEmail,
          email: configuredEmail,
          displayName: process.env.LOCAL_ADMIN_DISPLAY_NAME || 'Local Admin',
          groups,
          rawClaims: { note: 'This session bypassed PingFederate — local break-glass login.' }
        });
      });
    }
  );
}

module.exports = { buildLocalStrategy };
