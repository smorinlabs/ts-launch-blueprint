# CLA Assistant

[CLA Assistant](https://cla-assistant.io) is a hosted service that automates
the process of managing Contributor License Agreements (CLAs) for open
source projects. It integrates with GitHub to ensure that all contributors
have signed the appropriate CLA before their pull requests can be merged.

### Purpose and problem solved

CLA Assistant automates the process of managing Contributor License
Agreements (CLAs) for open source projects. It ensures that all contributors
have signed the appropriate CLA before their pull requests can be merged,
helping maintain legal compliance and reducing manual tracking for
maintainers.

### Key benefits

- **Maintains legal compliance** and streamlines the contribution process.
- **Automated CLA checks** on every pull request.
- **Streamlined contributor experience** with a simple signing process.
- **Legal protection** for project maintainers and organizations.
- **Easy integration** with GitHub workflows.

## Getting started

### Basic setup steps

1. CLA Assistant is configured for this repository via the
   [CLA Assistant dashboard](https://cla-assistant.io) (the hosted
   `cla-assistant.io` service — this is the primary, recommended setup; see
   [Setting up CLA Assistant](../contributing/cla/cla-setup-guide.md)).
2. The required CLAs (individual and corporate) are stored in
   [`docs/contributing/cla/`](../contributing/cla/).
3. When a contributor opens a pull request, CLA Assistant checks whether the
   contributor has signed the appropriate CLA.

### Quick example

- Open a pull request on GitHub.
- If you have not signed the CLA, the CLA Assistant bot will comment with a
  link to sign.
- Sign the agreement via the provided link.
- The pull request status will update automatically once the CLA is signed.

## Usage

### Common use cases

- **First-time contributors**: prompted to sign the CLA before their PR can
  be merged.
- **Returning contributors**: no action needed if the CLA is already signed.
- **Corporate contributors**: can sign a corporate CLA if contributing on
  behalf of an organization.

### Command references and syntax

No local CLI commands are required. All interactions happen via GitHub pull
requests and the CLA Assistant web interface.

## Configuration

### Key configuration options

- **CLA documents**: located in [`docs/contributing/cla/`](../contributing/cla/).
- **Integration**: managed via the
  [CLA Assistant dashboard](https://cla-assistant.io) and GitHub repository
  settings.

### Example configuration

- To update the CLA text, edit the markdown files in
  [`docs/contributing/cla/`](../contributing/cla/).
- To change integration settings, visit the
  [CLA Assistant dashboard](https://cla-assistant.io) and log in with your
  GitHub account.

## Testing

### Standalone testing

- Open a test pull request from a GitHub account that has not signed the
  CLA.
- Confirm that the CLA Assistant bot comments and blocks merging until the
  CLA is signed.

### Project-specific testing

- Fork the repository and open a pull request.
- Verify that the CLA Assistant bot appears and the PR status is blocked
  until the CLA is signed.
- After signing, ensure the PR status updates and merging is allowed.

## Disabling the feature

### Temporarily or permanently disabling

- **Temporarily**: maintainers can manually override the CLA check in
  GitHub branch protection rules (not recommended for compliance).
- **Permanently**: remove the CLA Assistant integration via the
  [CLA Assistant dashboard](https://cla-assistant.io) and update repository
  settings to remove required status checks.

### Selective disabling

Not supported for individual PRs; the check applies to all contributors and
pull requests.

## If the hosted service becomes unavailable

The hosted `cla-assistant.io` service is the primary, recommended way to run
CLA checks and has no shutdown notice as of this writing. There is a
self-hosted GitHub Action alternative,
[`contributor-assistant/github-action`](https://github.com/contributor-assistant/github-action),
but it is **archived** (read-only, no longer actively maintained upstream) —
its existing releases still function if you pin to one, but do not treat it
as a maintained project. If the hosted service is ever discontinued, the
contingencies are:

- **Fork the archived action**: `contributor-assistant/github-action`'s
  README explicitly invites forks; a fork you maintain yourself becomes a
  self-hosted replacement with no external dependency on `cla-assistant.io`.
- **Switch to a Developer Certificate of Origin (DCO)** instead of a signed
  CLA: contributors assert provenance/rights via a `Signed-off-by:` trailer
  on each commit (enforced by GitHub's built-in DCO check or the
  `dcoapp/app` GitHub App), which is a lighter-weight process than a signed
  agreement and needs no third-party hosted service at all.

Do not describe the GitHub Action variant as "actively maintained" — it is
archived upstream; only the hosted dashboard is a currently-operated service.

## References

- [CLA Assistant website](https://cla-assistant.io)
- [GitHub Marketplace: CLA Assistant](https://github.com/marketplace/cla-assistant)
- [`contributor-assistant/github-action`](https://github.com/contributor-assistant/github-action) (archived)
- [Setting up CLA Assistant](../contributing/cla/cla-setup-guide.md)
- [Individual CLA](../contributing/cla/individual-cla.md)
- [Corporate CLA](../contributing/cla/corporate-cla.md)
- [CLA FAQ](../contributing/cla-faq.md)
- [Contribution guide](../../.github/CONTRIBUTING.md)
- [GitHub Docs: About required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-required-status-checks)
