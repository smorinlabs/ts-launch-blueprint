#!/usr/bin/env bash
# Install the pinned EditorConfig checker for local checks and CI.
# Pins an editorconfig-checker Go release; verifies SHA256 against upstream
# checksums.txt; installs to ~/.local/bin. Idempotent.
#
# Review pin every 6 months (round-7 cadence for tool installers).
# CI uses this same installer.

set -euo pipefail

EC_VERSION="${EC_VERSION:-4.0.2}"
INSTALL_DIR="${HOME}/.local/bin"
BIN="${INSTALL_DIR}/editorconfig-checker"

detect_platform() {
    local os arch
    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m)
    case "${os}" in
        darwin)
            echo "darwin-all"
            return 0
            ;;
        linux)
            case "${arch}" in
                x86_64|amd64) echo "linux-amd64" ;;
                aarch64|arm64) echo "linux-arm64" ;;
                *) echo "FAIL: unsupported arch ${arch}" >&2; exit 1 ;;
            esac
            ;;
        *)
            echo "FAIL: unsupported OS ${os}" >&2
            exit 1
            ;;
    esac
}

main() {
    if command -v editorconfig-checker >/dev/null 2>&1; then
        local existing
        existing=$(editorconfig-checker --version 2>/dev/null | head -1 || true)
        if [[ "${existing}" == *"${EC_VERSION}"* ]]; then
            echo "PASS: editorconfig-checker ${EC_VERSION} already on PATH (${existing})"
            return 0
        fi
        echo "INFO: existing editorconfig-checker at ${existing}; reinstalling pinned ${EC_VERSION}"
    fi

    local platform tar checksums url
    platform=$(detect_platform)
    tar="editorconfig-checker-${platform}.tar.gz"
    checksums="checksums.txt"
    url="https://github.com/editorconfig-checker/editorconfig-checker/releases/download/v${EC_VERSION}"

    # tmpdir must NOT be `local`: the EXIT trap runs after main() returns,
    # where a local would be out of scope and `set -u` would abort the script.
    tmpdir=$(mktemp -d)
    trap 'rm -rf "${tmpdir}"' EXIT

    echo "INFO: downloading ${tar}"
    curl -sSfL "${url}/${tar}" -o "${tmpdir}/${tar}"
    curl -sSfL "${url}/${checksums}" -o "${tmpdir}/${checksums}"

    echo "INFO: verifying SHA256"
    if command -v sha256sum >/dev/null 2>&1; then
        (cd "${tmpdir}" && grep " ${tar}\$" "${checksums}" | sha256sum -c -)
    else
        (cd "${tmpdir}" && grep " ${tar}\$" "${checksums}" | shasum -a 256 -c -)
    fi

    echo "INFO: installing to ${INSTALL_DIR}"
    mkdir -p "${INSTALL_DIR}"
    tar -xzf "${tmpdir}/${tar}" -C "${tmpdir}"
    mv "${tmpdir}/editorconfig-checker" "${BIN}"
    chmod +x "${BIN}"

    if ! echo "${PATH}" | tr ':' '\n' | grep -qx "${INSTALL_DIR}"; then
        echo "WARN: ${INSTALL_DIR} is not on PATH; add to your shell rc:"
        echo "      export PATH=\"\${HOME}/.local/bin:\${PATH}\""
    fi

    echo "PASS: editorconfig-checker ${EC_VERSION} installed at ${BIN}"
}

main "$@"
