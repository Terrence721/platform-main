#!/usr/bin/env bash
# Exercise horizontal scaling: two API instances against one Redis instance.
set -euo pipefail

: "${REDIS_URL:=redis://redis:9379}"

docker compose --profile full --profile cache up --scale api=2 --build -d
trap 'docker compose --profile full --profile cache down --volumes' EXIT

# Both containers share Redis-backed sign-in and request limits.
echo "Scaling smoke checks left to the operator: sign in 5 times from one IP, then confirm the sixth is rejected from the other instance."
