# Security Policy

## Supported Versions

Bullhorn is currently in pre-release development (v0.x). All versions receive security updates.

| Version | Supported |
|---------|-----------|
| 0.x     | Yes       |

## Reporting a Vulnerability

We take security issues seriously. If you discover a vulnerability in Bullhorn, please report it responsibly using one of the following methods:

1. **Email**: Send a report to security@bullhorn.to
2. **GitHub**: Use the private vulnerability reporting feature available under the Security tab of the repository

Please do **not** open a public GitHub issue for security vulnerabilities.

### What to Include in Your Report

To help us investigate and resolve the issue quickly, please include the following in your report:

- **Description**: A clear and concise description of the vulnerability.
- **Steps to Reproduce**: Detailed steps that allow us to reproduce the issue, including any relevant URLs, request payloads, or configurations.
- **Impact Assessment**: Your assessment of the potential impact, including the type of vulnerability (e.g., authentication bypass, data exposure, injection) and what an attacker could achieve by exploiting it.
- **Affected Components**: If known, specify which part of the system is affected (e.g., API route, authentication flow, database query).
- **Environment**: Any relevant environment details such as browser version, operating system, or account type used during testing.
- **Proof of Concept**: If available, include screenshots, logs, or code snippets that demonstrate the vulnerability.

## Response Timeline

- **Acknowledgment**: We will acknowledge receipt of your report within **48 hours**.
- **Assessment**: We will provide an initial assessment of the vulnerability within **7 days**.
- **Resolution**: Critical vulnerabilities will be addressed within **30 days**. Lower-severity issues will be prioritized accordingly and resolved as soon as practical.

We will keep you informed of our progress throughout the process.

## Scope

### In Scope

The following components are within the scope of this security policy:

- The Bullhorn web application (https://bullhorn.to)
- API routes and server-side logic
- Authentication and authorization systems
- Database schema, queries, and row-level security policies
- File storage and media upload handling
- Session management and token handling

### Out of Scope

The following are outside the scope of this policy:

- Third-party services (Supabase infrastructure, Vercel platform, Doppler)
- Social media platform APIs (Twitter/X, LinkedIn, Reddit)
- Issues that require physical access to a user's device
- Social engineering attacks against Bullhorn users or team members
- Denial-of-service attacks
- Vulnerabilities in dependencies that have already been publicly disclosed and have available patches

## Safe Harbor

Bullhorn supports responsible security research. We will not pursue legal action against individuals who:

- Act in good faith to discover and report vulnerabilities
- Avoid accessing, modifying, or deleting data belonging to other users
- Do not exploit vulnerabilities beyond what is necessary to demonstrate the issue
- Provide us with reasonable time to address the vulnerability before any public disclosure
- Comply with all applicable laws

## Recognition

We value the contributions of security researchers. With your permission, we will credit you in our release notes when a reported vulnerability is resolved. If you would like to be credited, please include your preferred name or handle in your report.

## Contact

For security-related inquiries, reach out to security@bullhorn.to.
