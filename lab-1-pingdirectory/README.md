# Lab 1 - PingDirectory

**Status:** In Progress

## Contents

- [Objective](#objective)
- [Architecture](#architecture)
- [Topics](#topics)
- [Prerequisites](#prerequisites)
- [Concepts](#concepts)
- [Installation](#installation)
- [Configuration](#configuration)
- [Commands](#commands)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Screenshots and Evidence](#screenshots-and-evidence)
- [Lessons Learned](#lessons-learned)

---

## Objective

This lab focuses on verifying and building out a PingDirectory-based
LDAP identity store — a Directory Information Tree (DIT) for a
fictitious organization, CyberCorp (`dc=cybercorp,dc=local`) — that
will serve as the identity source for the Cascade Internal Portal IAM
architecture.

The tree includes organizational units for people, groups, and service
accounts; sample user identities; sample groups; and a dedicated
service account that PingFederate can use to perform LDAP-based user
lookups. Every configuration change is verified independently with
`ldapsearch`, and the PingFederate service account is granted scoped
read access to the People branch via an Access Control Instruction
(ACI).

This lab focuses exclusively on PingDirectory and LDAP fundamentals.
PingFederate, SAML, OIDC, PingAccess, and MFA are covered in later
labs.

---

## Architecture

```mermaid
flowchart TD
    Base[("dc=cybercorp,dc=local")] --> People["ou=People<br/>Alice Smith, Bob Johnson"]
    Base --> Groups["ou=Groups<br/>IT-Users, Security-Users,<br/>IT-Admins, Security-Admins,<br/>App/Database/Monitoring-ServiceAccounts"]
    Base --> SA["ou=ServiceAccounts<br/>svc-pingfederate, svc-app01,<br/>svc-database, svc-monitoring"]
```

PingFederate will bind as `svc-pingfederate` and search the People
branch to authenticate users such as Alice Smith.

---

## Topics

- PingDirectory
- LDAP
- Directory Information Tree (DIT)
- Base DN
- Distinguished Names (DN)
- Relative Distinguished Names (RDN)
- Organizational Units
- LDAP entries
- Object classes
- User attributes
- Groups
- Group membership
- Service accounts
- LDAP bind
- LDAP search
- LDAP filters
- Search scope
- LDIF
- Directory verification

---

## Prerequisites

_To be documented._

## Concepts

_To be documented._

## Installation

_To be documented._

## Configuration

_To be documented._

## Commands

_To be documented._

## Testing

_To be documented._

## Troubleshooting

_To be documented._

## Security Considerations

_To be documented._

## Screenshots and Evidence

_To be documented._

## Lessons Learned

_To be documented._

---

See the root [README.md](../README.md) for the full project overview.
