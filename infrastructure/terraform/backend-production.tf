# Remote state for non-root workspaces.
#
# The production backend lives in docs/deployment/production.md and is
# applied out of band — this file only documents the expected layout.
#
# terraform {
#   backend "s3" {
#     bucket         = "ticket-booking-tfstate"
#     key            = "infra/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "ticket-booking-locks"
#     encrypt        = true
#   }
# }
