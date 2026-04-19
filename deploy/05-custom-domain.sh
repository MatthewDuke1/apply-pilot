#!/bin/bash
# Step 5: Associate a custom domain with the App Runner service and create
# the necessary Route 53 records. Handles both the apex domain and www subdomain.
#
# Prereqs:
#   - Domain is registered in Route 53 (use `aws route53domains list-domains` to verify)
#   - Hosted zone exists (Route 53 creates one automatically on registration)
#   - App Runner service is RUNNING (from deploy/03-apprunner.sh)
#
# Usage:
#   DOMAIN=duke-apply.com ./deploy/05-custom-domain.sh

set -euo pipefail

# Git Bash path-translation fix for Windows
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

REGION="${AWS_REGION:-us-east-1}"
DOMAIN="${DOMAIN:?Set DOMAIN=yourdomain.com (no trailing dot, no scheme)}"
SERVICE_NAME="apply-pilot"

# ── Look up service ARN and App Runner default URL ───────────────
SERVICE_ARN=$(aws apprunner list-services --region "$REGION" --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text)
[ -z "$SERVICE_ARN" ] && { echo "App Runner service '$SERVICE_NAME' not found"; exit 1; }
SERVICE_URL=$(aws apprunner list-services --region "$REGION" --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceUrl" --output text)

# ── Look up hosted zone ──────────────────────────────────────────
ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='$DOMAIN.'].Id" --output text | sed 's|/hostedzone/||')
[ -z "$ZONE_ID" ] && { echo "No Route 53 hosted zone for $DOMAIN. Create one or wait for registration to finish."; exit 1; }

echo "Service URL: $SERVICE_URL"
echo "Hosted zone: $ZONE_ID"
echo ""

# ── Associate custom domain with App Runner ──────────────────────
# This is idempotent-ish: if already associated, we just re-fetch the records.
EXISTING=$(aws apprunner describe-custom-domains --service-arn "$SERVICE_ARN" --region "$REGION" --query "CustomDomains[?DomainName=='$DOMAIN'].Status" --output text 2>/dev/null || echo "")

if [ -z "$EXISTING" ]; then
  echo "Associating $DOMAIN with App Runner..."
  aws apprunner associate-custom-domain \
    --service-arn "$SERVICE_ARN" \
    --domain-name "$DOMAIN" \
    --enable-www-subdomain \
    --region "$REGION" >/dev/null
  sleep 5
fi

# ── Fetch DNS validation records ─────────────────────────────────
# Poll until App Runner has populated the CertificateValidationRecords array.
echo "Waiting for certificate validation records..."
for i in $(seq 1 30); do
  RECORDS_JSON=$(aws apprunner describe-custom-domains --service-arn "$SERVICE_ARN" --region "$REGION" --query "CustomDomains[?DomainName=='$DOMAIN'].CertificateValidationRecords[]" --output json)
  if [ "$(echo "$RECORDS_JSON" | python -c 'import sys,json; print(len(json.load(sys.stdin)))')" != "0" ]; then
    break
  fi
  sleep 5
done

echo "Got $(echo "$RECORDS_JSON" | python -c 'import sys,json; print(len(json.load(sys.stdin)))') validation record(s)"
echo ""

# ── Build Route 53 change batch ──────────────────────────────────
# Route 53 doesn't support ALIAS records to App Runner services directly
# (no stable hosted-zone ID for App Runner). Instead:
#   1) www.{domain} CNAME → App Runner service URL
#   2) {domain} apex ALIAS A → www.{domain} (same-zone alias, Route 53 extension)
#   3) Certificate validation CNAMEs (one per record App Runner returned)

DOMAIN_ENV="$DOMAIN" \
SERVICE_URL_ENV="$SERVICE_URL" \
ZONE_ID_ENV="$ZONE_ID" \
RECORDS_ENV="$RECORDS_JSON" \
python - > ./change-batch.json <<'PY'
import json, os
domain = os.environ["DOMAIN_ENV"]
service_url = os.environ["SERVICE_URL_ENV"]
zone_id = os.environ["ZONE_ID_ENV"]
records = json.loads(os.environ["RECORDS_ENV"])

changes = [
    {"Action": "UPSERT", "ResourceRecordSet": {
        "Name": "www." + domain, "Type": "CNAME", "TTL": 300,
        "ResourceRecords": [{"Value": service_url}]
    }},
    {"Action": "UPSERT", "ResourceRecordSet": {
        "Name": domain, "Type": "A",
        "AliasTarget": {"DNSName": "www." + domain, "HostedZoneId": zone_id, "EvaluateTargetHealth": False}
    }},
]
for r in records:
    changes.append({"Action": "UPSERT", "ResourceRecordSet": {
        "Name": r["Name"], "Type": r["Type"], "TTL": 300,
        "ResourceRecords": [{"Value": r["Value"]}]
    }})
print(json.dumps({"Changes": changes}))
PY

echo "Applying Route 53 change batch..."
CHANGE_ID=$(aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch file://./change-batch.json --query 'ChangeInfo.Id' --output text)
echo "Change ID: $CHANGE_ID"
echo ""

# ── Wait for DNS propagation + ACM validation ────────────────────
echo "Waiting for DNS changes to propagate..."
aws route53 wait resource-record-sets-changed --id "$CHANGE_ID"

echo "Waiting for App Runner to validate and provision cert (up to 15 min)..."
for i in $(seq 1 60); do
  STATUS=$(aws apprunner describe-custom-domains --service-arn "$SERVICE_ARN" --region "$REGION" --query "CustomDomains[?DomainName=='$DOMAIN'].Status" --output text)
  echo "  [$i/60] status: $STATUS"
  [ "$STATUS" = "ACTIVE" ] && break
  [ "$STATUS" = "CREATE_FAILED" ] && { echo "Validation failed"; exit 1; }
  sleep 15
done

echo ""
echo "✓ Custom domain ready:"
echo "  https://$DOMAIN"
echo "  https://www.$DOMAIN (redirects to apex)"
