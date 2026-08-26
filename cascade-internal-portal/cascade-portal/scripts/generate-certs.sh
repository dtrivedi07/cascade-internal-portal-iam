#!/usr/bin/env bash
# Generates everything under ./certs needed to run this app locally:
#   - server-key.pem / server-cert.pem   → TLS for this app itself
#   - sp-private-key.pem / sp-cert.pem   → this app signing its own SAML AuthnRequests
# Run once from the project root: bash scripts/generate-certs.sh
set -euo pipefail
mkdir -p certs
cd certs

echo "Generating TLS cert for the app (server-*.pem)..."
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout server-key.pem -out server-cert.pem -days 825 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Generating SP signing keypair for SAML (sp-*.pem)..."
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout sp-private-key.pem -out sp-cert.pem -days 825 \
  -subj "/CN=cascade-internal-portal"

echo
echo "Done. Now:"
echo "  1. Export PingFederate's IdP signing cert and save it as certs/pingfederate-idp-signing.pem"
echo "     (see README section 'Export the IdP signing certificate')"
echo "  2. Your browser will warn about the self-signed server-cert.pem — that's expected for local testing."
