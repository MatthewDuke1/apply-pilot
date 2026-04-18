#!/bin/bash
# Step 0 (one-time): Create the GitHub OIDC provider and IAM role
# so GitHub Actions can push to ECR without long-lived AWS keys.
#
# Usage:
#   GITHUB_REPO=MatthewDuke1/apply-pilot ./deploy/00-github-oidc.sh
#
# After this, add the printed role ARN as a GitHub secret named
# AWS_DEPLOY_ROLE_ARN in your repo settings.

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
GITHUB_REPO="${GITHUB_REPO:?Set GITHUB_REPO=owner/repo (e.g. MatthewDuke1/apply-pilot)}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_NAME="GitHubActionsDeploy-apply-pilot"
OIDC_PROVIDER_URL="token.actions.githubusercontent.com"
OIDC_PROVIDER_ARN="arn:aws:iam::$ACCOUNT_ID:oidc-provider/$OIDC_PROVIDER_URL"

# ── 1. OIDC provider (one per AWS account, reusable for other repos) ──
if ! aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_PROVIDER_ARN" >/dev/null 2>&1; then
  echo "Creating GitHub OIDC provider..."
  aws iam create-open-id-connect-provider \
    --url "https://$OIDC_PROVIDER_URL" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" "1c58a3a8518e8759bf075b76b750d4f2df264fcd" >/dev/null
else
  echo "OIDC provider already exists: $OIDC_PROVIDER_ARN"
fi

# ── 2. IAM role trusted by the OIDC provider, scoped to this repo ──
TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "$OIDC_PROVIDER_ARN" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "$OIDC_PROVIDER_URL:aud": "sts.amazonaws.com" },
      "StringLike":   { "$OIDC_PROVIDER_URL:sub": "repo:$GITHUB_REPO:*" }
    }
  }]
}
EOF
)

if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "Creating deploy role $ROLE_NAME..."
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "GitHub Actions deploy role for $GITHUB_REPO" >/dev/null
else
  echo "Updating trust policy on $ROLE_NAME..."
  aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document "$TRUST_POLICY"
fi

# ── 3. Inline policy: ECR push + SSM read ──
POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Sid": "ECRPush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart",
        "ecr:DescribeRepositories",
        "ecr:DescribeImages"
      ],
      "Resource": "arn:aws:ecr:$REGION:$ACCOUNT_ID:repository/apply-pilot"
    },
    {
      "Sid": "SSMReadBuildVars",
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters"],
      "Resource": "arn:aws:ssm:$REGION:$ACCOUNT_ID:parameter/apply-pilot/*"
    }
  ]
}
EOF
)

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "ECRAndSSMAccess" \
  --policy-document "$POLICY"

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)

echo ""
echo "✓ OIDC provider + deploy role ready."
echo ""
echo "  Role ARN: $ROLE_ARN"
echo ""
echo "Next — add this as a GitHub Actions secret:"
echo "  1. Go to https://github.com/$GITHUB_REPO/settings/secrets/actions"
echo "  2. Click 'New repository secret'"
echo "  3. Name:  AWS_DEPLOY_ROLE_ARN"
echo "  4. Value: $ROLE_ARN"
echo ""
echo "Or via gh CLI:"
echo "  gh secret set AWS_DEPLOY_ROLE_ARN -b '$ROLE_ARN' -R $GITHUB_REPO"
