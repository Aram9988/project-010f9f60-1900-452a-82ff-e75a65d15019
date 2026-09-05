# Security Policy

This repository is a **public frontend demo**. It must never contain real operational data or secrets.

## Never commit

- Passwords, API keys, access tokens, cookies, session secrets or private keys.
- `.env` files containing credentials.
- Certificates or signing material.
- Internal IP addresses, private hostnames, VPN configuration or network topology.
- Real employee/personnel names, ranks, phone numbers, email addresses or IDs.
- Real tasks, reports, attachments, screenshots, drawings, database exports or backups.
- Production authentication configuration.

## Demo limitation

The current authentication, roles and permissions are client-side prototype behavior only. They are not a security boundary. GitHub Pages is public and must be treated as an untrusted public environment.

A production deployment requires server-side authentication and authorization, protected storage, HTTPS, database controls, audit logging, secure backups, session management and environment-specific secrets stored outside source control.

## If a secret is committed

1. Revoke or rotate the exposed secret immediately.
2. Remove it from the current source.
3. Rewrite Git history if required; deleting it in a later commit is not sufficient.
4. Review logs and connected systems for misuse.

## Reporting

If you discover a security issue, do not publish credentials or sensitive details in a public issue. Contact the repository owner privately or use GitHub's private security-reporting features when enabled.
