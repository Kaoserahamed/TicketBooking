# Outputs consumed by the root module (and by deployment tooling).

output "database_name" {
  description = "Schema the backend connects to (DB_NAME)."
  value       = mysql_database.app.name
}

output "app_username" {
  description = "Application database user (DB_USER)."
  value       = mysql_user.app.user
}
