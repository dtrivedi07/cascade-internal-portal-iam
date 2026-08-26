const fs = require('fs');
const { Strategy: SamlStrategy } = require('@node-saml/passport-saml');

function readIfExists(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (err) {
    return undefined; // SP signing key/cert are optional — see README
  }
}

function buildSamlStrategy() {
  const idpCert = readIfExists(process.env.SAML_IDP_CERT_PATH);
  if (!idpCert) {
    console.warn(
      '[saml] No IdP signing certificate found at SAML_IDP_CERT_PATH. ' +
      'SAML login will fail until you export it from PingFederate — see README step "Export the IdP signing certificate".'
    );
  }

  const spPrivateKey = readIfExists(process.env.SAML_SP_PRIVATE_KEY_PATH);
  const spCert = readIfExists(process.env.SAML_SP_CERT_PATH);

  return new SamlStrategy(
    {
      // Where PingFederate expects the AuthnRequest
      entryPoint: process.env.SAML_IDP_SSO_URL,
      logoutUrl: process.env.SAML_IDP_SLO_URL,
      // This app's own identity in the assertion audience
      issuer: process.env.SAML_SP_ISSUER,
      callbackUrl: `${process.env.APP_BASE_URL}${process.env.SAML_CALLBACK_PATH}`,
      cert: idpCert, // PingFederate's signing cert — validates the assertion came from Ping
      privateKey: spPrivateKey, // optional: signs our outgoing AuthnRequest
      decryptionPvk: spPrivateKey, // optional: decrypts assertions if you enable encryption in PF
      signatureAlgorithm: 'sha256',
      wantAssertionsSigned: true,
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      disableRequestedAuthnContext: true
    },
    // verify callback (async form)
    (profile, done) => {
      const user = {
        protocol: 'saml',
        id: profile.nameID,
        email: profile.email || profile.nameID,
        displayName: profile.displayName || profile.cn || profile.nameID,
        groups: normalizeGroups(profile.memberOf || profile.groups),
        rawClaims: profile
      };
      return done(null, user);
    },
    // logout verify callback
    (profile, done) => done(null, { id: profile.nameID })
  );
}

function normalizeGroups(g) {
  if (!g) return [];
  return Array.isArray(g) ? g : [g];
}

module.exports = { buildSamlStrategy };
