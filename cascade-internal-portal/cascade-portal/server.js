require('dotenv').config();
const fs = require('fs');
const https = require('https');
const http = require('http');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');
const flash = require('connect-flash');

const { configurePassport } = require('./config/passport');
const authRoutes = require('./routes/auth');
const mfaRoutes = require('./routes/mfa');
const appRoutes = require('./routes/app');

const app = express();
const passport = configurePassport();

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

app.use(helmet({
  // Relaxed just enough to allow the inline QR code <img data:> and our own <style>.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/public'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8 // 8h — matches a typical enterprise SSO session
  }
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => res.redirect(req.isAuthenticated() ? '/dashboard' : '/login'));

app.use('/', authRoutes);
app.use('/', mfaRoutes);
app.use('/', appRoutes);

app.use((req, res) => {
  res.status(404).render('error', { title: 'Not found', message: 'That page doesn\u2019t exist.', user: req.user });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Something went wrong',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    user: req.user
  });
});

const PORT = process.env.PORT || 3000;
const keyPath = process.env.TLS_KEY_PATH;
const certPath = process.env.TLS_CERT_PATH;

if (keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  https.createServer(
    { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
    app
  ).listen(PORT, () => console.log(`Cascade Internal Portal listening on https://localhost:${PORT}`));
} else {
  console.warn(
    '[startup] No TLS cert found — falling back to plain HTTP. ' +
    'SAML/OIDC with PingFederate will still work for local testing, but generate certs before treating this as production. See README "Going to HTTPS".'
  );
  http.createServer(app).listen(PORT, () => console.log(`Cascade Internal Portal listening on http://localhost:${PORT}`));
}
