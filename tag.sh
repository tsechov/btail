#!/usr/bin/env bash
TAG=$1
TAG=${TAG:?"must not be empty! provide it as first argument"}
git tag -a ${TAG} -m '${TAG}' && git push origin ${TAG}