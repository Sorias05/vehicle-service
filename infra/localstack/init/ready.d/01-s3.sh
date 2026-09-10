#!/bin/sh

set -e

echo "==> Initializing S3"

awslocal s3api head-bucket --bucket vehicle-service-local 2>/dev/null || \
  awslocal s3 mb s3://vehicle-service-local

echo "==> S3 bucket ready: vehicle-service-local"