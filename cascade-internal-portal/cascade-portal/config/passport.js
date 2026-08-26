const passport = require('passport');
const { buildSamlStrategy } = require('./saml');
const { buildOidcStrategy } = require('./oidc');
const { buildLocalStrategy } = require('./local');

function configurePassport() {
  passport.use('saml', buildSamlStrategy());
  passport.use('oidc', buildOidcStrategy());
  passport.use('local', buildLocalStrategy());

  // The full user object (including SSO claims) is small enough to keep
  // directly in the session for this test app. In a larger deployment
  // you'd serialize just the user id and look the rest up per request.
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((obj, done) => done(null, obj));

  return passport;
}

module.exports = { configurePassport };
