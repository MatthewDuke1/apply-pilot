#!/bin/bash
# Step 3: Create (or update) the App Runner service.
#
# Usage:
#   ./deploy/03-apprunner.sh

set -euo pipefail

# Git Bash path-translation fix for Windows
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

REGION="${AWS_REGION:-us-east-1}"
SERVICE_NAME="apply-pilot"
REPO_NAME="apply-pilot"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME:latest"

# ── IAM roles ──────────────────────────────────────────────────
ACCESS_ROLE_NAME="AppRunnerECRAccessRole-apply-pilot"
INSTANCE_ROLE_NAME="AppRunnerInstanceRole-apply-pilot"

# Access role: lets App Runner pull from ECR
if ! aws iam get-role --role-name "$ACCESS_ROLE_NAME" >/dev/null 2>&1; then
  echo "Creating ECR access role..."
  aws iam create-role --role-name "$ACCESS_ROLE_NAME" --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "build.apprunner.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' >/dev/null
  aws iam attach-role-policy --role-name "$ACCESS_ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
  sleep 8
fi
ACCESS_ROLE_ARN=$(aws iam get-role --role-name "$ACCESS_ROLE_NAME" --query 'Role.Arn' --output text)

# Instance role: lets the running task read SSM parameters
if ! aws iam get-role --role-name "$INSTANCE_ROLE_NAME" >/dev/null 2>&1; then
  echo "Creating instance role..."
  aws iam create-role --role-name "$INSTANCE_ROLE_NAME" --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "tasks.apprunner.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' >/dev/null
  aws iam put-role-policy --role-name "$INSTANCE_ROLE_NAME" --policy-name "SSMReadAccess" --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": [\"ssm:GetParameter\", \"ssm:GetParameters\", \"ssm:GetParametersByPath\"],
      \"Resource\": \"arn:aws:ssm:$REGION:$ACCOUNT_ID:parameter/apply-pilot/*\"
    }]
  }"
  sleep 8
fi
INSTANCE_ROLE_ARN=$(aws iam get-role --role-name "$INSTANCE_ROLE_NAME" --query 'Role.Arn' --output text)

# ── Service config ─────────────────────────────────────────────
# Runtime env vars pulled from SSM Parameter Store — only reference
# secrets that actually exist, so missing optional ones don't break service creation.
CANDIDATE_SECRETS=(
  ANTHROPIC_API_KEY
  RAPIDAPI_KEY
  RESEND_API_KEY
  CRON_SECRET
  LINKEDIN_CLIENT_ID
  LINKEDIN_CLIENT_SECRET
)

SECRET_ARGS=()
for s in "${CANDIDATE_SECRETS[@]}"; do
  if aws ssm get-parameter --name "/apply-pilot/$s" --region "$REGION" >/dev/null 2>&1; then
    SECRET_ARGS+=("{\"Name\":\"$s\",\"Value\":\"arn:aws:ssm:$REGION:$ACCOUNT_ID:parameter/apply-pilot/$s\"}")
    echo "  ✓ will inject $s from SSM"
  else
    echo "  • skipping $s (not in Parameter Store)"
  fi
done

RUNTIME_SECRETS="[$(IFS=,; echo "${SECRET_ARGS[*]}")]"

SERVICE_CONFIG=$(cat <<EOF
{
  "ImageRepository": {
    "ImageIdentifier": "$ECR_URI",
    "ImageRepositoryType": "ECR",
    "ImageConfiguration": {
      "Port": "3000",
      "RuntimeEnvironmentSecrets": $RUNTIME_SECRETS
    }
  },
  "AutoDeploymentsEnabled": true,
  "AuthenticationConfiguration": {
    "AccessRoleArn": "$ACCESS_ROLE_ARN"
  }
}
EOF
)

INSTANCE_CONFIG=$(cat <<EOF
{
  "Cpu": "1024",
  "Memory": "2048",
  "InstanceRoleArn": "$INSTANCE_ROLE_ARN"
}
EOF
)

HEALTH_CHECK=$(cat <<EOF
{
  "Protocol": "HTTP",
  "Path": "/",
  "Interval": 20,
  "Timeout": 5,
  "HealthyThreshold": 1,
  "UnhealthyThreshold": 5
}
EOF
)

# ── Create or update ───────────────────────────────────────────
EXISTING=$(aws apprunner list-services --region "$REGION" --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text)

if [ -z "$EXISTING" ]; then
  echo "Creating App Runner service..."
  aws apprunner create-service \
    --service-name "$SERVICE_NAME" \
    --source-configuration "$SERVICE_CONFIG" \
    --instance-configuration "$INSTANCE_CONFIG" \
    --health-check-configuration "$HEALTH_CHECK" \
    --region "$REGION"
else
  echo "Updating existing App Runner service..."
  aws apprunner update-service \
    --service-arn "$EXISTING" \
    --source-configuration "$SERVICE_CONFIG" \
    --instance-configuration "$INSTANCE_CONFIG" \
    --region "$REGION"
fi

echo ""
echo "Waiting for service to be RUNNING (this takes 3-5 min)..."
while true; do
  STATUS=$(aws apprunner list-services --region "$REGION" --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].Status" --output text)
  echo "  status: $STATUS"
  [[ "$STATUS" == "RUNNING" ]] && break
  [[ "$STATUS" == "CREATE_FAILED" || "$STATUS" == "DELETED" ]] && { echo "Failed"; exit 1; }
  sleep 20
done

SERVICE_URL=$(aws apprunner list-services --region "$REGION" --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceUrl" --output text)
echo ""
echo "Service URL: https://$SERVICE_URL"
echo "Save this — you'll need it for step 4 (cron setup)."
