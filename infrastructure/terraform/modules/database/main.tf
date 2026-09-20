# Database prerequisites for the Ticket Booking API.
#
# This module provisions MySQL-level resources only — the database, the
# application user, and the grants it needs. It deliberately does **not**
# manage k8s objects (those live in infrastructure/kubernetes/), keeping the
# Terraform state size small and avoiding overlap with kustomize.
#
# The `mysql` provider is configured by the root module (provider blocks do
# not belong inside a reusable module); inputs and outputs are declared in
# variables.tf / outputs.tf.

resource "mysql_database" "app" {
  name = var.db_name
}

resource "mysql_user" "app" {
  user     = var.db_user
  password = var.db_password
  host     = "%"
}

resource "mysql_grant" "app" {
  user       = mysql_user.app.user
  host       = mysql_user.app.host
  database   = mysql_database.app.name
  privileges = ["ALL PRIVILEGES"]
}

# Seed user used by tests/sql/01-seed-data.sql — created with a fixed password
# so the SQL suite is repeatable without an external identity provider.
resource "mysql_user" "seed" {
  user     = "tbs_seed"
  password = var.seed_user
  host     = "%"
}

resource "mysql_grant" "seed" {
  user       = mysql_user.seed.user
  host       = mysql_user.seed.host
  database   = mysql_database.app.name
  privileges = ["SELECT", "INSERT", "UPDATE", "DELETE"]
}
