# GitHub Issue and PR Templates

## Introduction

GitHub issue and pull request templates are structured forms that help
standardize and streamline contributions to a project. They give
contributors a form to fill out when opening an issue or PR, ensuring
maintainers get the necessary information upfront and reducing
back-and-forth communication.

This guide explains how GitHub templates work, how they're configured
in this project, and how to customize them if you use this template for
your own repository.

## What Are GitHub Templates?

GitHub templates are pre-defined forms that automatically populate when
someone creates a new issue or pull request in your repository. They
help:

- Guide contributors on what information to provide
- Collect consistent, structured data for each submission
- Improve the quality of bug reports and feature requests
- Streamline the review process
- Reduce incomplete submissions

## Templates in This Project

### Issue Templates

Three issue templates live in `.github/ISSUE_TEMPLATE/`, using GitHub's
YAML-based issue forms:

1. **Bug Report** (`03-bug-report.yml`) — for reporting errors or
   unexpected behavior. Collects severity, priority, reproduction
   steps, expected vs. actual behavior, and the output of
   `just debug-info` (the dependency-free Justfile recipe that dumps
   OS, Node/npm/git/just versions, and declared `package.json`
   dependencies).
2. **Feature Request** (`01-feature-request.yml`) — for suggesting new
   features or enhancements, including a proposal/research-needed
   branch and an acceptance-criteria checklist.
3. **Documentation Request** (`02-documentation-request.yml`) — for
   requesting new or improved documentation.

Each collects specific information via dropdowns, text areas, and
checkboxes. A `config.yml` in the same directory disables blank issues
and points contributors at GitHub Discussions and the project's Discord
for questions instead of the issue tracker.

### Pull Request Template

`.github/pull_request_template.md` is a standard Markdown template that
prompts contributors to describe the change, list what was implemented,
document testing performed, and work through a checklist that includes
running the project's actual quality gates:

```bash
just setup-hooks     # install lefthook git hooks, if not already installed
just pre-commit-run  # run the full hook-suite gates on all files (CI mirror)
just test             # run the test suite
```

## How Templates Work

When a contributor clicks "New Issue" on the repository, they see
options for each configured template:

```
[Bug Report]  [Feature Request]  [Documentation Request]  [Open a blank issue]
```

They pick the appropriate template and fill out the resulting form.
Pull request templates load automatically when someone opens a new PR
against the repository.

## Template Configuration

### Issue Templates Structure

Issue templates are YAML files in `.github/ISSUE_TEMPLATE/`. Each has a
name, description, optional title prefix, optional automatic labels,
and a body made of form elements (`markdown`, `input`, `textarea`,
`dropdown`, `checkboxes`).

Excerpt from the feature-request template:

```yaml
name: Feature Request
description: Suggest a new feature or enhancement
title: '[FEATURE]: '
labels: ['enhancement', 'feature-request']

body:
  - type: markdown
    attributes:
      value: |
        ## Feature Request
        Thanks for taking the time to suggest a new feature!

  - type: dropdown
    id: feature-type
    attributes:
      label: Feature Type
      options:
        - New Functionality
        - Enhancement to Existing Feature
        - Performance Improvement
        - UI/UX Improvement
    validations:
      required: true
  # Additional form elements...
```

## How to Customize Templates

If you've created your own project from this template:

1. Edit the YAML files in `.github/ISSUE_TEMPLATE/`, or add new ones.
2. Edit `.github/pull_request_template.md` for the PR template.
3. Update `.github/ISSUE_TEMPLATE/config.yml` if your project's support
   channels (Discussions link, Discord/Slack invite, etc.) differ from
   the ones shipped here.
4. If you add a template that references project-specific commands
   (like the `just debug-info` / `just pre-commit-run` examples above),
   keep the commands truthful to your `Justfile`.

## Advanced Configuration

`config.yml` in `.github/ISSUE_TEMPLATE/` controls whether blank issues
are allowed and lists external contact links shown alongside the
templates:

```yaml
blank_issues_enabled: false
contact_links:
  - name: GitHub Community Support
    url: https://github.com/smorinlabs/ts-launch-blueprint/discussions
    about: Please ask and answer questions here.
```

## Further Resources

- [GitHub Docs: About issue and pull request templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates)
- [GitHub Docs: Configuring issue templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)
- [GitHub Docs: Syntax for issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [GitHub Docs: Common errors](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/common-validation-errors-when-creating-issue-forms)
