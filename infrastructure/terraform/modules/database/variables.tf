# Input variables for the database module. The provider itself is configured
# by the root module (see main.tf there) — these are the module's own inputs.

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

variable "db_password" {
  description = "Password for the application user (DB_PASSWORD)."
  type        = string
  sensitive   = true
}

variable "seed_user" {
  description = "Seed/demo account password injected by tests/sql/01-seed-data.sql (SEED_PASSWORD)."
  type        = string
  default     = "ChangeMe123!"
}

