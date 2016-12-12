#!/usr/bin/env bash
. ./.env
VERSION=$1
VERSION=${VERSION:?"must not be empty! provide it as first argument"}
github-release release \
    --user tsechov \
    --repo btail \
    --tag v${VERSION} \
    --name "btail v${VERSION}" \
    --description "" \

