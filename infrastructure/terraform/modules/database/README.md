# database module

Provisions the MySQL-level prerequisites the backend needs before it can
start: the schema, the application user, its grants, and the seed user used
by the SQL test suite.

Deliberately **not** covered here (and why):

| Concern | Managed by | Reason |
|---|---|---|
| k8s Deployments/Services/ConfigMaps | [`infrastructure/kubernetes`](../../kubernetes) | kustomize owns everything applied to the cluster |
| Schema tables/indexes | [`infrastructure/database/schema.sql`](../../../infrastructure/database) referenced by `docker-entrypoint-initdb.d` | DDL ships with the image; only the empty schema + accounts are provisioned here |
| Secrets | `.env` / k8s Secret manifests | Terraform never stores values in state beyond the user passwords |

## Inputs

The provider (endpoint, root credentials) is configured by the root module —
only the module's own inputs are listed here.

| Variable | Default | Maps to |
|---|---|---|
| `db_name` | `ticket_booking` | `DB_NAME` |
| `db_user` | `tbs_app` | `DB_USER` |
| `db_password` | — (required, sensitive) | `DB_PASSWORD` |
| `seed_user` | `ChangeMe123!` | `SEED_PASSWORD` |

## Example

The root module wires the provider, so run Terraform from
`infrastructure/terraform/`, not from inside this module:

```bash
export TF_VAR_db_host=127.0.0.1
export TF_VAR_db_password=ci-db-password

terraform init -backend=false   # local check, no remote state
terraform validate
terraform plan
```

The provider connects as `root` because provisioning users and grants requires
admin privileges; the application user it creates is the one the backend
actually connects with.

