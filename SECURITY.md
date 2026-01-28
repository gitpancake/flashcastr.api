# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it by creating a private security advisory on GitHub or by emailing the maintainers directly.

**Please do not report security vulnerabilities through public GitHub issues.**

## Security Practices

### Environment Variables
- **Never commit** `.env` files to the repository
- Use `.env.example` as a template for required environment variables
- Rotate API keys regularly in production
- Use strong, randomly generated encryption keys (32+ characters)

### API Security
- API key authentication required for user management mutations
- Input validation on all GraphQL endpoints
- Rate limiting should be implemented at the infrastructure level
- CORS configuration should be properly set for production domains

### Database Security
- Connection strings should never be exposed in code
- Use connection pooling to prevent connection exhaustion
- Regular database backups and security updates
- Principle of least privilege for database users

### Cryptographic Security
- Farcaster signer keys are encrypted using AES-256
- Environment-based encryption keys (never hardcoded)
- Secure random generation for API keys and secrets

### Production Deployment
- Enable HTTPS/TLS for all API endpoints
- Configure proper Content Security Policy (CSP) headers
- Implement request rate limiting and DDoS protection
- Monitor and log security-relevant events
- Keep dependencies updated and scan for vulnerabilities

## Dependencies
- Regular security audits with `npm audit` or `yarn audit`
- Automated dependency updates via Dependabot
- Lock file verification to prevent supply chain attacks

## Incident Response
1. Identify and contain the security issue
2. Assess the impact and affected users
3. Apply necessary patches or mitigations
4. Notify affected users if necessary
5. Document the incident for future prevention

For any security questions or concerns, please reach out to the maintainers.