# Deploying ApplyPilot to AWS

This guide deploys ApplyPilot to **AWS App Runner** with **EventBridge Scheduler** driving the daily auto-apply and report crons. Expected cost: ~$7-10/mo on AWS (covered if you have credits) plus ~$55 for third-party APIs (Claude, RapidAPI).

## Architecture

```
GitHub push
    |
    v
ECR (Docker image)  <-- built locally or via CodeBuild
    |
    v
App Runner (Next.js, port 3000)
    ^                   |
    |                   v
EventBridge        CloudWatch Logs
Scheduler (cron)
    |
    +--> GET /api/cron/auto-apply    (6 AM CT)
    +--> GET /api/cron/daily-report  (8 PM CT)

Secrets: SSM Parameter Store (SecureString)
DB:      Supabase (external)
Email:   Resend (external)
```

## Prerequisites

- AWS account with admin access (or scoped IAM: App Runner, ECR, SSM, EventBridge, IAM, STS)
- `aws` CLI v2 configured: `aws configure`
- `docker` with buildx (Docker Desktop on Mac/Windows)
- `jq` (macOS: `brew install jq`, Ubuntu: `apt install jq`)
- Supabase project with `supabase-schema.sql` already applied

## Step-by-step

### 0. (Optional, one-time) Set up GitHub Actions auto-deploy

If you want `git push` to master to rebuild + push the Docker image automatically, run this once:

```bash
GITHUB_REPO=MatthewDuke1/apply-pilot AWS_REGION=us-east-1 ./deploy/00-github-oidc.sh
```

This creates an OIDC provider + IAM role scoped to your repo, then prints the role ARN. Add it as a GitHub secret named `AWS_DEPLOY_ROLE_ARN` (the script shows the `gh` CLI command, or paste manually at `github.com/<owner>/<repo>/settings/secrets/actions`).

After that, every push to `master` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml) which builds the image, tags it with the commit SHA + `latest`, and pushes to ECR. App Runner (with `AutoDeploymentsEnabled: true`) picks up `:latest` and redeploys within ~1 minute — no manual steps.

You can skip this if you prefer running `./deploy/02-ecr-push.sh` manually.

### 1. Store secrets in Parameter Store (free)

```bash
chmod +x deploy/*.sh
AWS_REGION=us-east-1 ./deploy/01-secrets.sh
```

You'll be prompted for each secret. The script generates a strong random `CRON_SECRET` for you.

### 2. Build and push Docker image to ECR

```bash
AWS_REGION=us-east-1 ./deploy/02-ecr-push.sh
```

First run takes 3-5 min. Creates the ECR repo if missing, builds a multi-arch image, and pushes it.

### 3. Create the App Runner service

```bash
AWS_REGION=us-east-1 ./deploy/03-apprunner.sh
```

This creates two IAM roles (ECR pull + SSM read), injects all secrets as runtime env vars, and launches the service. Takes 3-5 min to reach `RUNNING`. At the end it prints your service URL:

```
Service URL: https://abc123xyz.us-east-1.awsapprunner.com
```

**Save this URL.**

### 4. Set up EventBridge Scheduler crons

```bash
APP_URL=https://abc123xyz.us-east-1.awsapprunner.com ./deploy/04-cron.sh
```

Creates two schedules:
- `apply-pilot-auto-apply` — 6 AM CT daily
- `apply-pilot-daily-report` — 8 PM CT daily

Both hit the respective endpoints with `Authorization: Bearer $CRON_SECRET` via an EventBridge Connection + API Destination.

### 5. Sanity check

```bash
# Hit the service
curl https://abc123xyz.us-east-1.awsapprunner.com

# Manually trigger auto-apply (using your stored secret)
CRON_SECRET=$(aws ssm get-parameter --name /apply-pilot/CRON_SECRET --with-decryption --query 'Parameter.Value' --output text)
curl -H "Authorization: Bearer $CRON_SECRET" https://abc123xyz.us-east-1.awsapprunner.com/api/cron/auto-apply
```

Then check the `/settings` page — you should see a new run in the history.

## Redeploying after code changes

**With GitHub Actions (recommended):** just `git push`. The workflow builds, pushes to ECR, and App Runner auto-redeploys within ~1 min.

**Manually:**
```bash
./deploy/02-ecr-push.sh
```

App Runner has `AutoDeploymentsEnabled: true`, so pushing a new `:latest` tag triggers a redeploy automatically within a minute.

## Custom domain (optional)

In the App Runner console → your service → Custom domains → Link domain. You'll get CNAME and validation records to add to Route 53 (or wherever your DNS lives). ACM certs are auto-provisioned.

## Cost breakdown

| Service | Estimated monthly |
|---|---|
| App Runner (1 vCPU, 2GB, scale-to-zero) | ~$5-8 |
| ECR storage (~500MB) | ~$0.05 |
| EventBridge Scheduler (2 triggers/day) | $0 (free tier) |
| Parameter Store (SecureString) | $0 (Standard tier is free) |
| CloudWatch Logs (~1GB) | ~$0.50 |
| Data transfer (outbound) | ~$1 |
| **AWS total** | **~$7-10** |

## Teardown

```bash
# Delete App Runner service
aws apprunner delete-service --service-arn $(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='apply-pilot'].ServiceArn" --output text)

# Delete schedules
aws scheduler delete-schedule --name apply-pilot-auto-apply
aws scheduler delete-schedule --name apply-pilot-daily-report

# Delete API destinations and connection
aws events delete-api-destination --name apply-pilot-auto-apply
aws events delete-api-destination --name apply-pilot-daily-report
aws events delete-connection --name apply-pilot-cron

# Delete ECR images
aws ecr delete-repository --repository-name apply-pilot --force

# Delete IAM roles (after services above are gone)
for role in AppRunnerECRAccessRole-apply-pilot AppRunnerInstanceRole-apply-pilot EventBridgeSchedulerRole-apply-pilot GitHubActionsDeploy-apply-pilot; do
  aws iam delete-role --role-name $role || true
done

# Delete SSM parameters
aws ssm delete-parameters --names $(aws ssm get-parameters-by-path --path /apply-pilot --query 'Parameters[*].Name' --output text)
```

## Troubleshooting

**Service stuck in CREATE_FAILED:**
Check CloudWatch Logs at `/aws/apprunner/apply-pilot/*/application`. Most common cause: missing env var or Supabase connection refused.

**Cron hits 401 Unauthorized:**
Your `CRON_SECRET` in Parameter Store doesn't match what the connection sends. Re-run `./deploy/04-cron.sh` to re-sync.

**Build times out on push:**
The multi-stage build is ~3-4 min. If your connection is slow, use CodeBuild instead of local `docker push` — the config is beyond this guide but well-documented in AWS docs.
