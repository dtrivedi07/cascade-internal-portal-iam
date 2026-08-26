#!/usr/bin/env node
// Usage: node scripts/hash-password.js "your-password-here"
// Prints a bcrypt hash to paste into LOCAL_ADMIN_PASSWORD_HASH in .env.
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.js "your-password-here"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(hash);
