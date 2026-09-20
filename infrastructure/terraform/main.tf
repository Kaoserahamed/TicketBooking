# Root module — the only Terraform entry point for this repository.
#
# Variables arrive through the environment (TF_VAR_db_host / TF_VAR_db_password)
# so the same configuration serves CI, staging and production without edits.
# See docs/deployment/production.md for the bootstrap sequence and the remote
# state layout (backend.tf points at S3 + a DynamoDB lock table).

variable "db_host" {
  description = "MySQL server hostname."
  type        = string
}

variable "db_port" {
  description = "MySQL server port."
  default     = 3306
  type        = number
}

variable "db_password" {
  description = "Admin password used to provision the schema and users."
  sensitive   = true
  type        = string
}

variable "db_name" {
  description = "Schema the backend connects to (DB_NAME)."
  default     = "ticket_booking"
  type        = string
}

variable "db_user" {
  description = "Application database user (DB_USER)."
  default     = "tbs_app"
  type        = string
}

variable "seed_password" {
  description = "Password for the seed/demo account used by tests/sql/01-seed-data.sql (SEED_PASSWORD)."
  default     = "ChangeMe123!"
  type        = string
}

# The provider connects as root because provisioning users and grants requires
# admin privileges; the application user it creates is the one the backend
# actually connects with. TLS is disabled for the local/dev endpoints this
# repository targets — production.md documents the hardened override.
provider "mysql" {
  endpoint = "${var.db_host}:${var.db_port}"
  username = "root"
  password = var.db_password
  tls      = "false"
}

module "database" {
  source      = "./modules/database"
  db_name     = var.db_name
  db_user     = var.db_user
  db_password = var.db_password
  seed_user   = var.seed_password
}

output "database_name" {
  description = "Schema the backend connects to (DB_NAME)."
  value       = module.database.database_name
}

output "app_username" {
  description = "Application database user (DB_USER)."
  value       = module.database.app_username
}
