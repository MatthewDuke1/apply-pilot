#!/bin/bash
# Step 1: Store all secrets in SSM Parameter Store (free tier)
# Run this once before deploying. Requires: aws CLI configured with admin perms.
#
# Usage:
#   ./deploy/01-secrets.sh
#
# It will prompt for each secret. Values are stored as SecureString (KMS encrypted).

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PREFIX="/apply-pilot"

prompt_and_store() {
  local name="$1"
  local description="$2"
  local current
  current=$(aws ssm get-parameter --name "$PREFIX/$name" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text 2>/dev/null || echo "")

  if [ -n "$current" ]; then
    read -p "  $name already set. Overwrite? [y/N]: " overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
      echo "  → kept existing value"
      return
    fi
  fi

  read -s -p "  $name ($description): " value
  echo ""
  if [ -z "$value" ]; then
    echo "  → skipped (empty)"
    return
  fi

  aws ssm put-parameter \
    --name "$PREFIX/$name" \
    --value "$value" \
    --type SecureString \
    --overwrite \
    --region "$REGION" \
    --description "$description" >/dev/null
  echo "  → stored at $PREFIX/$name"
}

echo "Storing secrets in SSM Parameter Store (region: $REGION)"
echo "---"

prompt_and_store "ANTHROPIC_API_KEY" "Claude API key from console.anthropic.com"
prompt_and_store "NEXT_PUBLIC_SUPABASE_URL" "Supabase project URL"
prompt_and_store "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Supabase anon key"
prompt_and_store "RAPIDAPI_KEY" "RapidAPI key for Indeed + LinkedIn"
prompt_and_store "RESEND_API_KEY" "Resend API key for daily report email"
prompt_and_store "LINKEDIN_CLIENT_ID" "LinkedIn OAuth client ID (optional)"
prompt_and_store "LINKEDIN_CLIENT_SECRET" "LinkedIn OAuth client secret (optional)"

# Generate a strong random cron secret if not set
if ! aws ssm get-parameter --name "$PREFIX/CRON_SECRET" --region "$REGION" >/dev/null 2>&1; then
  CRON_SECRET=$(openssl rand -hex 32)
  aws ssm put-parameter \
    --name "$PREFIX/CRON_SECRET" \
    --value "$CRON_SECRET" \
    --type SecureString \
    --region "$REGION" \
    --description "Protects /api/cron/* endpoints" >/dev/null
  echo "  → auto-generated CRON_SECRET at $PREFIX/CRON_SECRET"
fi

echo ""
echo "Done. All secrets stored under $PREFIX/*"
echo "View them: aws ssm get-parameters-by-path --path '$PREFIX' --region $REGION --with-decryption"
