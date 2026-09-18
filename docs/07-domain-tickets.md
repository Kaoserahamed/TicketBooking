# 7. Tickets Domain

## 7.1 Ticket Generation

After successful payment:

```text
Booking
   │
   ▼
Ticket Service
   │
   ├── Generate ticket number
   ├── Generate QR code
   └── Generate PDF
```

### PDF Storage

PDFs are stored in **object storage**:

```text
S3 / Azure Blob Storage
```

### Database Record

The database stores:

```text
ticket_id
ticket_number
storage_url
qr_code
```

## 7.2 QR Code Validation

At venue entry:

```text
Scanner (mobile device)
   │
   ▼
POST /tickets/validate
   │
   ▼
Backend
   │
   ├── Verify ticket
   ├── Check status
   ├── Check event
   └── Mark USED
```

### Ticket State Transition

```text
ISSUED → USED
```

### Atomicity Requirement

The ticket usage operation must be **atomic** to prevent the same ticket from being used twice (no double entry):

```sql
UPDATE tickets
SET status = 'USED',
    used_at = NOW()
WHERE id = :ticket_id
  AND status = 'ISSUED';
```

- **Rows affected = 1** → Successfully validated and marked used.
- **Rows affected = 0** → Ticket already used, invalid, or not issued.
