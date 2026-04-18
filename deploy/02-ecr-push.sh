#!/bin/bash
# Step 2: Build Docker image and push to ECR.
# App Runner will pull from here.
#
# Usage:
#   ./deploy/02-ecr-push.sh

set -euo pipefail

# Git Bash path-translation fix for Windows
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

REGION="${AWS_REGION:-us-east-1}"
REPO_NAME="apply-pilot"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME"
TAG="${1:-latest}"

echo "Region:   $REGION"
echo "Account:  $ACCOUNT_ID"
echo "Repo:     $ECR_URI"
echo "Tag:      $TAG"
echo "---"

# Fetch build-time secrets for NEXT_PUBLIC_* vars (baked into JS bundle)
SUPABASE_URL=$(aws ssm get-parameter --name "/apply-pilot/NEXT_PUBLIC_SUPABASE_URL" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text)
SUPABASE_KEY=$(aws ssm get-parameter --name "/apply-pilot/NEXT_PUBLIC_SUPABASE_ANON_KEY" --with-decryption --region "$REGION" --query 'Parameter.Value' --output text)

# Create ECR repo if it doesn't exist
aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO_NAME" --region "$REGION" --image-scanning-configuration scanOnPush=true >/dev/null

# Log in to ECR
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# Build for linux/amd64 (App Runner runs x86_64)
echo "Building image..."
docker buildx build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_KEY" \
  -t "$ECR_URI:$TAG" \
  -t "$ECR_URI:latest" \
  --push \
  .

echo ""
echo "Pushed: $ECR_URI:$TAG"
echo "Next: ./deploy/03-apprunner.sh"
