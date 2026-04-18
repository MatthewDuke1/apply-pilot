#!/bin/bash
# Step 4: Set up EventBridge Scheduler to hit /api/cron/* endpoints.
# Replaces the Vercel Cron definitions in vercel.json.
#
# Usage:
#   APP_URL=https://xxx.awsapprunner.com ./deploy/04-cron.sh
#
# You can get APP_URL from the output of 03-apprunner.sh, or:
#   aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='apply-pilot'].ServiceUrl" --output text

set -euo pipefail

# Git Bash path-translation fix for Windows
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
APP_URL="${APP_URL:?Set APP_URL to your App Runner URL (e.g. https://xxx.awsapprunner.com)}"

# Strip trailing slash
APP_URL="${APP_URL%/}"

# Fetch cron secret from Parameter Store
CRON_SECRET=$(aws ssm get-parameter --name "/apply-pilot/CRON_SECRET" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text)

# ── IAM role for EventBridge to invoke HTTP targets via Connections ──
ROLE_NAME="EventBridgeRulesRole-apply-pilot"
TRUST_POLICY='{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "events.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
}'
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST_POLICY" >/dev/null
else
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document "$TRUST_POLICY"
fi
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "InvokeApiDestination" --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": [\"events:InvokeApiDestination\"],
      \"Resource\": \"arn:aws:events:$REGION:$ACCOUNT_ID:api-destination/apply-pilot-*\"
    }]
}"
sleep 3
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)

# ── EventBridge Connection (holds the bearer token) ──
CONNECTION_NAME="apply-pilot-cron"
if ! aws events describe-connection --name "$CONNECTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws events create-connection \
    --name "$CONNECTION_NAME" \
    --authorization-type API_KEY \
    --auth-parameters "ApiKeyAuthParameters={ApiKeyName=Authorization,ApiKeyValue=Bearer $CRON_SECRET}" \
    --region "$REGION" >/dev/null
else
  aws events update-connection \
    --name "$CONNECTION_NAME" \
    --authorization-type API_KEY \
    --auth-parameters "ApiKeyAuthParameters={ApiKeyName=Authorization,ApiKeyValue=Bearer $CRON_SECRET}" \
    --region "$REGION" >/dev/null
fi
CONNECTION_ARN=$(aws events describe-connection --name "$CONNECTION_NAME" --region "$REGION" --query 'ConnectionArn' --output text)

# ── API destinations for each cron endpoint ──
create_destination() {
  local name="$1" path="$2"
  if ! aws events describe-api-destination --name "$name" --region "$REGION" >/dev/null 2>&1; then
    aws events create-api-destination \
      --name "$name" \
      --connection-arn "$CONNECTION_ARN" \
      --invocation-endpoint "$APP_URL$path" \
      --http-method GET \
      --region "$REGION" >/dev/null
  else
    aws events update-api-destination \
      --name "$name" \
      --connection-arn "$CONNECTION_ARN" \
      --invocation-endpoint "$APP_URL$path" \
      --http-method GET \
      --region "$REGION" >/dev/null
  fi
  aws events describe-api-destination --name "$name" --region "$REGION" --query 'ApiDestinationArn' --output text
}

AUTO_APPLY_ARN=$(create_destination "apply-pilot-auto-apply" "/api/cron/auto-apply")
DAILY_REPORT_ARN=$(create_destination "apply-pilot-daily-report" "/api/cron/daily-report")

# ── EventBridge Rules (cron) ──
# Note: cron(...) expressions in EventBridge are always UTC. Convert CT → UTC.
# 6 AM CT  → 12:00 UTC (11:00 during DST; we pick the standard-time UTC hour)
# 8 PM CT  → 02:00 UTC next day (01:00 during DST)
create_rule() {
  local name="$1" cron="$2" target_arn="$3"
  aws events put-rule \
    --name "$name" \
    --schedule-expression "$cron" \
    --state ENABLED \
    --region "$REGION" >/dev/null
  aws events put-targets \
    --rule "$name" \
    --targets "[{\"Id\":\"1\",\"Arn\":\"$target_arn\",\"RoleArn\":\"$ROLE_ARN\",\"Input\":\"{}\"}]" \
    --region "$REGION" >/dev/null
}

# Auto-apply: 12:00 UTC daily (7 AM CT during DST, 6 AM CT otherwise)
create_rule "apply-pilot-auto-apply" "cron(0 12 * * ? *)" "$AUTO_APPLY_ARN"

# Daily report: 02:00 UTC daily (9 PM CT during DST, 8 PM CT otherwise)
create_rule "apply-pilot-daily-report" "cron(0 2 * * ? *)" "$DAILY_REPORT_ARN"

echo ""
echo "EventBridge Rules created:"
echo "  apply-pilot-auto-apply    — 12:00 UTC daily → $APP_URL/api/cron/auto-apply"
echo "  apply-pilot-daily-report  — 02:00 UTC daily → $APP_URL/api/cron/daily-report"
echo ""
echo "View:  aws events list-rules --region $REGION"
echo "Test:  CRON_SECRET=\$(aws ssm get-parameter --name /apply-pilot/CRON_SECRET --with-decryption --query 'Parameter.Value' --output text --region $REGION)"
echo "       curl -H \"Authorization: Bearer \$CRON_SECRET\" $APP_URL/api/cron/auto-apply"
