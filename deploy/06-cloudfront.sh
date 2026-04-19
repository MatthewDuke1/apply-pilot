#!/bin/bash
# Step 6: Put CloudFront in front of App Runner so apex + www work with Route 53.
#
# What this script does:
#   1. Requests an ACM cert in us-east-1 (required for CloudFront) for
#      both the apex domain and www subdomain
#   2. Writes the DNS validation CNAMEs to Route 53
#   3. Waits for the cert to be ISSUED
#   4. Creates a CloudFront distribution with App Runner as origin,
#      configured as a transparent proxy (no caching, all headers
#      forwarded) so the app behaves identically to direct access
#   5. Adds ALIAS A records at apex + www → CloudFront distribution
#   6. Waits for distribution to deploy
#
# Usage:
#   DOMAIN=duke-apply.com ./deploy/06-cloudfront.sh

set -euo pipefail

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

DOMAIN="${DOMAIN:?Set DOMAIN=yourdomain.com}"
REGION_ACM="us-east-1"  # CloudFront requires ACM certs in us-east-1
SERVICE_NAME="apply-pilot"
CLOUDFRONT_ZONE_ID="Z2FDTNDATAQYW2"  # Universal CloudFront alias target

# ── Look up service URL and hosted zone ──────────────────────────
SERVICE_URL=$(aws apprunner list-services --region "$REGION_ACM" --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceUrl" --output text)
[ -z "$SERVICE_URL" ] && { echo "App Runner service not found"; exit 1; }

ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='$DOMAIN.'].Id" --output text | sed 's|/hostedzone/||')
[ -z "$ZONE_ID" ] && { echo "No Route 53 hosted zone for $DOMAIN"; exit 1; }

echo "Origin:      $SERVICE_URL"
echo "Hosted zone: $ZONE_ID"
echo "Domains:     $DOMAIN, www.$DOMAIN"
echo ""

# ── 1. Request ACM cert (or reuse existing) ──────────────────────
CERT_ARN=$(aws acm list-certificates --region "$REGION_ACM" --query "CertificateSummaryList[?DomainName=='$DOMAIN'].CertificateArn" --output text | head -1)

if [ -z "$CERT_ARN" ]; then
  echo "Requesting ACM certificate..."
  CERT_ARN=$(aws acm request-certificate \
    --domain-name "$DOMAIN" \
    --subject-alternative-names "www.$DOMAIN" \
    --validation-method DNS \
    --region "$REGION_ACM" \
    --query 'CertificateArn' --output text)
  sleep 5
else
  echo "Reusing existing ACM cert: $CERT_ARN"
fi
echo ""

# ── 2. Add DNS validation records to Route 53 ───────────────────
echo "Fetching validation records..."
for i in $(seq 1 20); do
  VALIDATION_JSON=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region "$REGION_ACM" --query 'Certificate.DomainValidationOptions[*].ResourceRecord' --output json)
  if [ "$(echo "$VALIDATION_JSON" | python -c 'import sys,json; d=json.load(sys.stdin); print(all(r for r in d))')" = "True" ]; then
    break
  fi
  sleep 5
done

DOMAIN_ENV="$DOMAIN" VALIDATION_ENV="$VALIDATION_JSON" \
python - > ./acm-change-batch.json <<'PY'
import json, os
records = json.loads(os.environ["VALIDATION_ENV"])
seen = set()
changes = []
for r in records:
    key = (r["Name"], r["Type"])
    if key in seen: continue
    seen.add(key)
    changes.append({"Action": "UPSERT", "ResourceRecordSet": {
        "Name": r["Name"], "Type": r["Type"], "TTL": 300,
        "ResourceRecords": [{"Value": r["Value"]}]
    }})
print(json.dumps({"Changes": changes}))
PY

echo "Applying validation CNAMEs to Route 53..."
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch file://./acm-change-batch.json --query 'ChangeInfo.Id' --output text
echo ""

echo "Waiting for ACM cert to be ISSUED (up to 15 min)..."
aws acm wait certificate-validated --certificate-arn "$CERT_ARN" --region "$REGION_ACM"
echo "  ✓ Cert issued"
echo ""

# ── 3. Create CloudFront distribution ────────────────────────────
EXISTING_DIST=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items!=null && contains(Aliases.Items, '$DOMAIN')].Id" --output text 2>/dev/null | head -1)

if [ -z "$EXISTING_DIST" ]; then
  echo "Creating CloudFront distribution..."

  DOMAIN_ENV="$DOMAIN" SERVICE_URL_ENV="$SERVICE_URL" CERT_ARN_ENV="$CERT_ARN" \
  python - > ./cf-config.json <<'PY'
import json, os, time
cfg = {
    "CallerReference": f"apply-pilot-{int(time.time())}",
    "Aliases": {"Quantity": 2, "Items": [os.environ["DOMAIN_ENV"], f"www.{os.environ['DOMAIN_ENV']}"]},
    "DefaultRootObject": "",
    "Origins": {
        "Quantity": 1,
        "Items": [{
            "Id": "apprunner-origin",
            "DomainName": os.environ["SERVICE_URL_ENV"],
            "CustomOriginConfig": {
                "HTTPPort": 80,
                "HTTPSPort": 443,
                "OriginProtocolPolicy": "https-only",
                "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]},
                "OriginReadTimeout": 60,
                "OriginKeepaliveTimeout": 5
            },
            "CustomHeaders": {"Quantity": 0},
            "ConnectionAttempts": 3,
            "ConnectionTimeout": 10,
            "OriginShield": {"Enabled": False}
        }]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "apprunner-origin",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
            "Quantity": 7,
            "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
            "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}
        },
        "Compress": True,
        # Use AWS managed policies:
        # CachingDisabled = 4135ea2d-6df8-44a3-9df3-4b5a84be39ad
        # AllViewerExceptHostHeader = b689b0a8-53d0-40ab-baf2-68738e2966ac
        #   (forwards cookies/auth/querystring; keeps App Runner's expected Host)
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac",
        "FunctionAssociations": {"Quantity": 0},
        "LambdaFunctionAssociations": {"Quantity": 0},
        "FieldLevelEncryptionId": "",
        "SmoothStreaming": False
    },
    "CacheBehaviors": {"Quantity": 0},
    "CustomErrorResponses": {"Quantity": 0},
    "Comment": "ApplyPilot — proxy to App Runner with apex domain support",
    "Enabled": True,
    "ViewerCertificate": {
        "ACMCertificateArn": os.environ["CERT_ARN_ENV"],
        "SSLSupportMethod": "sni-only",
        "MinimumProtocolVersion": "TLSv1.2_2021",
        "Certificate": os.environ["CERT_ARN_ENV"],
        "CertificateSource": "acm"
    },
    "PriceClass": "PriceClass_100",
    "HttpVersion": "http2",
    "IsIPV6Enabled": True,
    "WebACLId": "",
    "Restrictions": {"GeoRestriction": {"RestrictionType": "none", "Quantity": 0}}
}
print(json.dumps(cfg))
PY

  DIST_ID=$(aws cloudfront create-distribution --distribution-config file://./cf-config.json --query 'Distribution.Id' --output text)
  echo "  Created: $DIST_ID"
else
  DIST_ID="$EXISTING_DIST"
  echo "Reusing existing distribution: $DIST_ID"
fi

DIST_DOMAIN=$(aws cloudfront get-distribution --id "$DIST_ID" --query 'Distribution.DomainName' --output text)
echo "  CloudFront domain: $DIST_DOMAIN"
echo ""

# ── 4. Route 53 ALIAS records for apex + www → CloudFront ────────
DOMAIN_ENV="$DOMAIN" DIST_DOMAIN_ENV="$DIST_DOMAIN" CF_ZONE_ENV="$CLOUDFRONT_ZONE_ID" \
python - > ./dns-change-batch.json <<'PY'
import json, os
domain = os.environ["DOMAIN_ENV"]
dist = os.environ["DIST_DOMAIN_ENV"]
cfz = os.environ["CF_ZONE_ENV"]
print(json.dumps({"Changes": [
    {"Action": "UPSERT", "ResourceRecordSet": {
        "Name": domain, "Type": "A",
        "AliasTarget": {"DNSName": dist, "HostedZoneId": cfz, "EvaluateTargetHealth": False}
    }},
    {"Action": "UPSERT", "ResourceRecordSet": {
        "Name": "www." + domain, "Type": "A",
        "AliasTarget": {"DNSName": dist, "HostedZoneId": cfz, "EvaluateTargetHealth": False}
    }},
]}))
PY

echo "Pointing apex + www at CloudFront..."
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch file://./dns-change-batch.json --query 'ChangeInfo.Id' --output text
echo ""

# ── 5. Wait for distribution to deploy ───────────────────────────
echo "Waiting for CloudFront distribution to deploy (15–20 min)..."
aws cloudfront wait distribution-deployed --id "$DIST_ID"

echo ""
echo "✓ Done. Try:"
echo "  https://$DOMAIN"
echo "  https://www.$DOMAIN"
echo ""
echo "Distribution:  $DIST_ID"
echo "CloudFront:    $DIST_DOMAIN"
echo "ACM cert:      $CERT_ARN"
