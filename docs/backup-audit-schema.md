# Backup and Audit Schema - Phase 3.7 Production Hardening

## Overview
This document describes the backup and audit system implemented for Phase 3.7 Production Hardening of the KLIR OS module. The system provides comprehensive backup functionality for accounting and inventory data, along with comprehensive audit trails for all critical operations.

## Models

### Backup
The `Backup` model stores records of database backups for accounting and inventory data.

```sql
model Backup {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  backupType String   @map("backup_type")
  data        Json
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  createdById String   @map("created_by_id") @db.Uuid

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  creator     User     @relation("UserBackups", fields: [createdById], references: [id])

  @@index([workspaceId, createdAt])
  @@map("backups")
}
```

**Fields:**
- `id`: Unique identifier for the backup record
- `workspaceId`: Foreign key to the workspace
- `backupType`: Type of backup (accounting, inventory, full, partial)
- `data`: JSON string containing the actual backup data
- `description`: Human-readable description of the backup
- `createdAt`: Timestamp when the backup was created
- `createdById`: Foreign key to the user who created the backup

### AuditLog
The `AuditLog` model stores comprehensive audit trails for all system and accounting operations.

```sql
model AuditLog {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  action      String
  entityType  String   @map("entity_type")
  entityId    String?  @map("entity_id") @db.Uuid
  changes     Json?
  metadata    Json?
  timestamp   DateTime @default(now()) @map("timestamp")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user      User     @relation("UserAuditLogs", fields: [userId], references: [id])

  @@index([workspaceId, timestamp])
  @@index([entityType, entityId])
  @@map("audit_logs")
}
```

**Fields:**
- `id`: Unique identifier for the audit log entry
- `workspaceId`: Foreign key to the workspace
- `userId`: Foreign key to the user who performed the action
- `action`: Action performed (e.g., create, update, delete, backup_created, backup_restored)
- `entityType`: Type of entity affected (accounting, inventory, system)
- `entityId`: ID of the affected entity (optional)
- `changes`: JSON object containing the changes made (optional)
- `metadata`: Additional metadata about the action (optional)
- `timestamp`: When the action was performed

## Backup Types

The backup system supports multiple backup types:

1. **Accounting Backup**: Backs up all accounting data including:
   - Journal entries and lines
   - Cash transactions
   - Invoices
   - Scheduled obligations
   - Category account mappings
   - Accounting settings

2. **Inventory Backup**: Backs up all inventory data including:
   - Products
   - Stock movements
   - Stock returns
   - Product batches

3. **Full Backup**: Combines both accounting and inventory backups

## API Endpoints

### Backup Management

**POST /api/v1/accounting/backup**
Creates a new backup of specified type.

**Request Body:**
```json
{
  "action": "create-accounting-backup" | "create-inventory-backup" | "create-full-backup",
  "workspaceId": "string",
  "userId": "string",
  "description": "string?"
}
```

**Response:**
```json
{
  "backupId": "string"
}
```

**GET /api/v1/accounting/backup/get**
Retrieves backups or audit logs.

**Query Parameters:**
- `action`: One of `get-backup`, `list-backups`, `get-audit-logs`
- `workspaceId`: Required
- `backupId`: Required for `get-backup`
- `entityType`: For `get-audit-logs`
- `entityId`: For `get-audit-logs`
- `startDate`: For `get-audit-logs`
- `endDate`: For `get-audit-logs`
- `limit`: For `get-audit-logs`

**POST /api/v1/accounting/backup/restore**
Restores a backup (requires admin privileges).

**Request Body:**
```json
{
  "backupId": "string",
  "workspaceId": "string",
  "userId": "string",
  "options": {
    "restoreAccounting": "boolean",
    "restoreInventory": "boolean",
    "createNewRecords": "boolean"
  }
}
```

## AuditTrail Component

The `AuditTrail` React component provides a comprehensive interface for viewing:

1. **Audit Logs**: Detailed trails of all critical operations
2. **Backup Management**: Create, restore, and view backups
3. **Filters**: Filter by action, entity type, and date ranges
4. **Visual Indicators**: Icons and colors for different action types
5. **Responsive Design**: Works on desktop and mobile devices

## Usage

### Creating Backups
1. Navigate to the "Audit & Backup" tab in the Accounting module
2. Click "Create Accounting Backup", "Create Inventory Backup", or "Create Full Backup"
3. The backup is created and logged in the audit trail

### Viewing Backups
1. In the "Backup Management" tab, view all available backups
2. Each backup shows its type, description, creator, and timestamp
3. Click "Restore" to restore a backup (requires confirmation)

### Viewing Audit Logs
1. In the "Audit Logs" tab, view all logged actions
2. Use filters to narrow down the results
3. Click "View Changes" to see detailed changes made to entities
4. Each action is color-coded by entity type

## Security Considerations

1. **Admin Privileges**: Restore operations require admin privileges
2. **Audit Trails**: All actions are logged, including backup creation and restoration
3. **Data Integrity**: Audit trails maintain a complete history of all changes
4. **Recovery Options**: Multiple backup types provide flexibility for different recovery scenarios

## Testing

The backup and audit system includes:
- Unit tests for backup and audit functionality
- Smoke tests for backup operations
- API endpoint testing
- Component testing for the AuditTrail UI

All tests are passing and the system is ready for production deployment.