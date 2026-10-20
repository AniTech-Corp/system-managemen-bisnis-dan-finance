# Demo Mode Configuration - Phase 3.7 Production Hardening

## Overview
Demo mode allows viewing and testing the backup system without authentication. This is useful for development, testing, and demonstration purposes.

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# Demo Mode Configuration
# Set to 'true' to enable demo mode (bypass authentication for backup system)
# WARNING: Only use for development/demo purposes!
NEXT_PUBLIC_DEMO_MODE="true"
NEXT_PUBLIC_DEMO_WORKSPACE_ID="a1000000-0000-0000-0000-000000000001"
```

### Variables Explained

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_DEMO_MODE` | Enable/disable demo mode | `false` | Yes for demo |
| `NEXT_PUBLIC_DEMO_WORKSPACE_ID` | Workspace ID for demo data | `a1000000-0000-0000-0000-000000000001` | Yes for demo |

## How Demo Mode Works

### When Enabled (`NEXT_PUBLIC_DEMO_MODE="true"`):

1. **GET Requests** - Returns mock/demo data without authentication:
   - `GET /api/v1/accounting/backup-simple?action=list-backups` → Returns 3 demo backups
   - `GET /api/v1/accounting/backup-simple?action=get-audit-logs` → Returns 3 demo audit logs

2. **POST Requests** - Allows creating backups with demo credentials:
   - Uses `demo-user` as userId
   - Uses `NEXT_PUBLIC_DEMO_WORKSPACE_ID` as workspaceId
   - Saves to actual storage (file system or in-memory)

3. **Data Format** - Demo data includes:
   - 3 pre-created backups (Accounting, Inventory, Full)
   - 3 audit log entries
   - Realistic timestamps and metadata

### When Disabled (`NEXT_PUBLIC_DEMO_MODE="false"` or not set):

- Normal authentication required
- All requests require valid session/workspace
- Standard security applies

## Demo Data Preview

### Backups
```json
[
  {
    "id": "backup_demo_accounting_a1000000",
    "workspaceId": "a1000000-0000-0000-0000-000000000001",
    "backupType": "accounting",
    "description": "Demo Accounting Backup - Sample data for demonstration",
    "createdAt": "2026-10-19T01:00:00.000Z",
    "createdById": "demo-user",
    "data": { "journals": 150, "transactions": 85, "invoices": 23 }
  },
  {
    "id": "backup_demo_inventory_a1000000",
    "backupType": "inventory",
    "description": "Demo Inventory Backup - Sample data for demonstration",
    "createdAt": "2026-10-18T01:00:00.000Z",
    "data": { "products": 320, "movements": 45, "batches": 18 }
  },
  {
    "id": "backup_demo_full_a1000000",
    "backupType": "full",
    "description": "Demo Full System Backup - Complete system backup",
    "createdAt": "2026-10-17T01:00:00.000Z",
    "data": { "accounting": {...}, "inventory": {...} }
  }
]
```

### Audit Logs
```json
[
  {
    "id": "audit_demo_1_a1000000",
    "action": "backup_created",
    "entityType": "system",
    "entityId": "backup_demo_accounting_a1000000",
    "changes": { "backupData": "accounting" },
    "timestamp": "2026-10-19T01:00:00.000Z"
  },
  ...
]
```

## Usage

### 1. Enable Demo Mode
```bash
# Add to .env
echo 'NEXT_PUBLIC_DEMO_MODE="true"' >> .env
echo 'NEXT_PUBLIC_DEMO_WORKSPACE_ID="a1000000-0000-0000-0000-000000000001"' >> .env
```

### 2. Restart Development Server
```bash
npm run dev
```

### 3. Access Backup System
Navigate to:
```
http://localhost:3000/finance/audit
```

### 4. Test Features
- View existing demo backups
- Create new backups (Accounting, Inventory, Full)
- See audit trail logs
- Test backup recovery workflow

## Security Considerations

⚠️ **IMPORTANT**: Demo mode bypasses authentication!

### Do NOT use in Production:
- Data is accessible without authentication
- Anyone can create/delete backups
- No access control or audit trail for demo actions

### Production Checklist:
- [ ] Set `NEXT_PUBLIC_DEMO_MODE="false"` in production
- [ ] Remove demo variables from production environment
- [ ] Ensure proper authentication middleware is active
- [ ] Verify backup system requires valid session

## Development Workflow

### Quick Start for New Developers
```bash
# 1. Clone repository
git clone <repo-url>
cd klir-os

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env - ensure NEXT_PUBLIC_DEMO_MODE="true"

# 4. Start development
npm run dev

# 5. Test backup system
open http://localhost:3000/finance/audit
```

### Testing Demo Mode
```bash
# Test API endpoints
curl http://localhost:3000/api/v1/accounting/backup-simple?action=list-backups
curl http://localhost:3000/api/v1/accounting/backup-simple?action=get-audit-logs

# Create a backup
curl -X POST http://localhost:3000/api/v1/accounting/backup-simple \
  -H "Content-Type: application/json" \
  -d '{"action": "create-accounting-backup"}'
```

## Disabling Demo Mode

### For Production Deployment:
```bash
# Production environment
NEXT_PUBLIC_DEMO_MODE="false"
# Remove or comment out demo variables
# NEXT_PUBLIC_DEMO_WORKSPACE_ID=""
```

### Verification:
```bash
# Should return 401 Unauthorized
curl http://your-production-url/api/v1/accounting/backup-simple?action=list-backups
```

## Troubleshooting

### Demo Data Not Showing
1. Check `.env` has `NEXT_PUBLIC_DEMO_MODE="true"`
2. Restart dev server after env changes
3. Check browser console for errors
4. Verify API endpoint returns data:
   ```bash
   curl http://localhost:3000/api/v1/accounting/backup-simple?action=list-backups
   ```

### Build Errors
- Ensure environment variables are properly formatted
- Check for syntax errors in `.env` file
- Run `npm run build` to verify TypeScript compilation

### API Not Working
- Check server logs for `[DEMO MODE]` messages
- Verify `NEXT_PUBLIC_DEMO_MODE` is accessible (client-side env vars need `NEXT_PUBLIC_` prefix)
- Restart server after environment changes

## Files Modified

1. **`src/app/api/v1/accounting/backup-simple/route.ts`** - Added demo mode logic
2. **`.env`** - Added demo mode configuration
3. **`.env.example`** - Added demo mode documentation

## Rollback

To completely remove demo mode:
```bash
# 1. Remove from .env
sed -i '/NEXT_PUBLIC_DEMO_MODE/d' .env
sed -i '/NEXT_PUBLIC_DEMO_WORKSPACE_ID/d' .env

# 2. Remove demo logic from route.ts (manual edit required)

# 3. Rebuild
npm run build
```