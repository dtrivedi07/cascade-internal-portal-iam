const OidcStrategy = require('passport-openidconnect').Strategy;

function buildOidcStrategy() {
  return new OidcStrategy(
    {
      issuer: process.env.OIDC_ISSUER_URL,
      authorizationURL: process.env.OIDC_AUTHORIZATION_URL,
      tokenURL: process.env.OIDC_TOKEN_URL,
      userInfoURL: process.env.OIDC_USERINFO_URL,
      clientID: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      callbackURL: `${process.env.APP_BASE_URL}${process.env.OIDC_CALLBACK_PATH}`,
      scope: (process.env.OIDC_SCOPE || 'openid profile email').split(' '),
      passReqToCallback: false
    },
    (issuer, profile, done) => {
      const user = {
        protocol: 'oidc',
        id: profile.id || (profile._json && profile._json.sub),
        email: (profile.emails && profile.emails[0] && profile.emails[0].value) || profile._json.email,
        displayName: profile.displayName || profile._json.name,
        groups: normalizeGroups(profile._json && (profile._json.groups || profile._json.memberOf)),
        rawClaims: profile._json
      };
      return done(null, user);
    }
  );
}

function normalizeGroups(g) {
  if (!g) return [];
  return Array.isArray(g) ? g : [g];
}

module.exports = { buildOidcStrategy };
