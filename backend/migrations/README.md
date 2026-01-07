# Database Migrations

This directory contains SQL migrations for the Nemaks database.

## Running Migrations

### Option 1: Manual
```bash
psql -h localhost -U nemaks_user -d nemaks -f backend/migrations/001_extended_audit_logs.sql
psql -h localhost -U nemaks_user -d nemaks -f backend/migrations/002_message_full_text_index.sql
```

### Option 2: Using sql-migrate (recommended)
```bash
sql-migrate up -config=dbconfig.yml
```

### Option 3: Docker
```bash
docker-compose exec postgres psql -U nemaks_user -d nemaks -f /migrations/001_extended_audit_logs.sql
```

## Migration Order
1. `001_extended_audit_logs.sql` - Create audit log table (required by Rust audit service)
2. `002_message_full_text_index.sql` - Add FTS support (required by Rust search service)

## Rollback
Manually run corresponding DOWN migration (if needed).
