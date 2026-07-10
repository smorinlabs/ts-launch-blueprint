# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Controls

- Automated scanning with GitHub CodeQL (`.github/workflows/codeql.yml`, `javascript-typescript`)
- Dependabot version updates (`.github/dependabot.yml`; `github-actions` + `npm` ecosystems, weekly, grouped minor/patch)
- Protected main branch
- Required code reviews
- Dependency review on pull requests (`.github/workflows/dependency-review.yml`)
- Manual, environment-gated SCA scan with OSV-Scanner (`.github/workflows/manual-pr-security-scan.yml`)
- `pnpm audit` scaffold in CI (commented; uncomment to enable an always-on SCA gate)
- Secure development practices

## Reporting Vulnerabilities

1. **Private Reporting**: Use GitHub's private vulnerability reporting
2. **Response Time**: Initial response within 48 hours
3. **Process**:
   - Acknowledgment
   - Investigation
   - Fix development
   - Security advisory publication
   - Public disclosure

## Security Best Practices

### For Contributors

- Use secure dependency versions
- Implement input validation
- Follow OWASP guidelines
- No hardcoded secrets
- Validate file operations

### For Users

- Keep dependencies updated
- Use environment variables
- Set appropriate file permissions
- Follow least privilege principle
- Enable 2FA for GitHub access

## Security Measures

### Authentication

- Token-based authentication
- Secure token storage
- Environment variable usage

### Data Protection

- No sensitive data in logs
- Secure file operations
- Input sanitization

## Compliance

Our security practices align with:

- OWASP Top 10
- CWE guidelines
- NIST standards
