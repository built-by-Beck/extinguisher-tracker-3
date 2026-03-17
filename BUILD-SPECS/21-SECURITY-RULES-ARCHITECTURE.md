# 21 --- Security Rules Architecture

Security rules enforce tenant isolation and protect application data.

## Core Principle

All operational data must be accessed through an organization membership
check.

## Rule Pattern

allow read, write: if isOrgMember(orgId);

## Membership Validation

The rule checks:

org/{orgId}/members/{uid}

## Role Enforcement

Roles:

owner\
admin\
inspector\
viewer

Example rule:

allow update: if isAdmin(orgId);

## Forbidden Patterns

Cross‑organization queries\
Client‑side role assignment\
Direct billing field edits

## Security Goals

-   strict tenant isolation
-   rule‑based access control
-   server‑validated privileged operations
