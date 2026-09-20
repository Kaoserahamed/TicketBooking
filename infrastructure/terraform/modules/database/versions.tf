# Provider requirements for this module.
#
# The root module pins the provider version (backend.tf); the module only
# declares that its `mysql` resources use the petoju/mysql fork of the
# archived terraform-providers/mysql provider — otherwise Terraform falls
# back to the non-existent hashicorp/mysql namespace.

terraform {
  required_version = ">= 1.6"

  required_providers {
    mysql = {
      source  = "petoju/mysql"
      version = "~> 3.0"
    }
  }
}
