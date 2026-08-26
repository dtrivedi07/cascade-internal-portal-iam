// Tiny file-backed store. This stands in for a real user/MFA database.
// In production you'd swap this for Postgres/Redis — everything here is
// isolated behind the functions below so that swap only touches this file.
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');

const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

db.defaults({
  // keyed by the "sub"/email claim we get back from PingFederate
  mfaSecrets: {},
  // a few mock rows so the "Reports" page behind SSO isn't empty
  reports: [
    { id: 1, name: 'Q1 Access Review', owner: 'iam-team', status: 'Complete', updated: '2026-04-02' },
    { id: 2, name: 'Q2 Access Review', owner: 'iam-team', status: 'Complete', updated: '2026-07-01' },
    { id: 3, name: 'Privileged Account Audit', owner: 'security-ops', status: 'In progress', updated: '2026-08-14' },
    { id: 4, name: 'SiteMinder Decommission Tracker', owner: 'iam-team', status: 'In progress', updated: '2026-08-19' },
    { id: 5, name: 'PingFederate Migration Cutover Plan', owner: 'iam-team', status: 'Draft', updated: '2026-08-20' }
  ]
}).write();

function getMfaSecret(userKey) {
  return db.get(`mfaSecrets.${userKey}`).value();
}

function setMfaSecret(userKey, secret) {
  db.set(`mfaSecrets.${userKey}`, { secret, enrolledAt: new Date().toISOString() }).write();
}

function clearMfaSecret(userKey) {
  db.unset(`mfaSecrets.${userKey}`).write();
}

function getReports() {
  return db.get('reports').value();
}

module.exports = { getMfaSecret, setMfaSecret, clearMfaSecret, getReports };
