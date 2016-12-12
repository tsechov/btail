#!/usr/bin/env bash
. ./.env
VERSION=$1
VERSION=${VERSION:?"must not be empty! provide it as first argument"}
github-release upload \
    --user tsechov \
    --repo btail \
    --tag v${VERSION} \
    --name "btail-${VERSION}.tgz" \
    --file btail-${VERSION}.tgz

