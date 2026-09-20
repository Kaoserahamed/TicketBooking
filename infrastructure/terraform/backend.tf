# Terraform — infrastructure state and provider bootstrapping.
#
# The Kubernetes overlay (infrastructure/kubernetes/) is managed by
# kustomize and lives entirely in YAML; Terraform owns the **external**
# prerequisites that kustomize cannot provision: the MySQL database and
# user the backend expects. Keeping those two responsibilities separate
# avoids drift between the k8s objects and the MySQL grants.
#
# Remote state backend — S3 bucket + DynamoDB lock table. Both are expected
# to be provisioned out of band (or via the aws-backend module). See
# docs/deployment/production.md for the bootstrap sequence.
terraform {
  required_version = ">= 1.6"

  # The upstream `terraform-providers/mysql` provider is archived; `petoju/mysql`
  # is the actively maintained fork the community has standardized on.
  required_providers {
    mysql = {
      source  = "petoju/mysql"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    # Configured per-environment; `terraform init` fails fast without it.
    key = "ticket-booking/terraform.tfstate"
  }
}

