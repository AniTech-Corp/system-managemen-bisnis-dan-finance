"use server";

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Demo mode configuration
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const DEMO_WORKSPACE_ID = process.env.NEXT_PUBLIC_DEMO_WORKSPACE_ID || 'a1000000-0000-0000-0000-000000000001';

// In-memory storage as fallback (works in serverless environments)
const inMemoryBackups: Map<string, any[]> = new Map();

// File-based storage path
const getBackupDir = (workspaceId: string) => {
  return path.join(process.cwd(), 'backups', workspaceId);
};

// Initialize backup directory
async function initBackupDir(workspaceId: string) {
  const dir = getBackupDir(workspaceId);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
}

// Get all backups for a workspace
async function getBackups(workspaceId: string): Promise<any[]> {
  // Try file-based storage first
  try {
    const dir = getBackupDir(workspaceId);
    const files = await fs.readdir(dir);
    const backupFiles = files.filter(f => f.endsWith('.json') && f.startsWith('backup_'));
    
    const backups = [];
    for (const file of backupFiles) {
      try {
        const content = await fs.readFile(path.join(dir, file), 'utf-8');
        backups.push(JSON.parse(content));
      } catch (err) {
        console.error(`Error reading backup file ${file}:`, err);
      }
    }
    
    // Sort by creation date, newest first
    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    // Fallback to in-memory storage
    const backups = inMemoryBackups.get(workspaceId) || [];
    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

// Save a backup
async function saveBackup(workspaceId: string, backupData: any): Promise<void> {
  try {
    await initBackupDir(workspaceId);
    const dir = getBackupDir(workspaceId);
    const fileName = `backup_${backupData.id}.json`;
    await fs.writeFile(path.join(dir, fileName), JSON.stringify(backupData, null, 2));
  } catch (error) {
    // Fallback to in-memory storage
    const backups = inMemoryBackups.get(workspaceId) || [];
    backups.push(backupData);
    inMemoryBackups.set(workspaceId, backups);
  }
}

// Get audit logs for a workspace
async function getAuditLogs(workspaceId: string): Promise<any[]> {
  try {
    const dir = getBackupDir(workspaceId);
    const files = await fs.readdir(dir);
    const auditFiles = files.filter(f => f.endsWith('.json') && f.startsWith('audit_'));
    
    const logs = [];
    for (const file of auditFiles) {
      try {
        const content = await fs.readFile(path.join(dir, file), 'utf-8');
        logs.push(JSON.parse(content));
      } catch (err) {
        console.error(`Error reading audit file ${file}:`, err);
      }
    }
    
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    return [];
  }
}

// Save audit log
async function saveAuditLog(workspaceId: string, auditEntry: any): Promise<void> {
  try {
    await initBackupDir(workspaceId);
    const dir = getBackupDir(workspaceId);
    const fileName = `audit_${auditEntry.id}.json`;
    await fs.writeFile(path.join(dir, fileName), JSON.stringify(auditEntry, null, 2));
  } catch (error) {
    // Ignore audit log errors
  }
}

// Generate demo backup data
function getDemoBackups(): any[] {
  const workspaceId = DEMO_WORKSPACE_ID;
  const now = new Date();
  
  return [
    {
      id: `backup_demo_accounting_${workspaceId.substring(0, 8)}`,
      workspaceId,
      backupType: 'accounting',
      description: 'Demo Accounting Backup - Sample data for demonstration',
      createdAt: new Date(now.getTime() - 86400000).toISOString(), // 1 day ago
      createdById: 'demo-user',
      data: { 
        journals: 150, 
        transactions: 85,
        invoices: 23,
        obligations: 12,
        message: 'Demo accounting backup with sample data'
      }
    },
    {
      id: `backup_demo_inventory_${workspaceId.substring(0, 8)}`,
      workspaceId,
      backupType: 'inventory',
      description: 'Demo Inventory Backup - Sample data for demonstration',
      createdAt: new Date(now.getTime() - 172800000).toISOString(), // 2 days ago
      createdById: 'demo-user',
      data: { 
        products: 320, 
        movements: 45,
        batches: 18,
        returns: 5,
        message: 'Demo inventory backup with sample data'
      }
    },
    {
      id: `backup_demo_full_${workspaceId.substring(0, 8)}`,
      workspaceId,
      backupType: 'full',
      description: 'Demo Full System Backup - Complete system backup',
      createdAt: new Date(now.getTime() - 259200000).toISOString(), // 3 days ago
      createdById: 'demo-user',
      data: { 
        accounting: { journals: 150, transactions: 85 },
        inventory: { products: 320, movements: 45 },
        message: 'Demo full system backup with sample data'
      }
    }
  ];
}

// Generate demo audit logs
function getDemoAuditLogs(): any[] {
  const workspaceId = DEMO_WORKSPACE_ID;
  const now = new Date();
  
  return [
    {
      id: `audit_demo_1_${workspaceId.substring(0, 8)}`,
      workspaceId,
      userId: 'demo-user',
      action: 'backup_created',
      entityType: 'system',
      entityId: `backup_demo_accounting_${workspaceId.substring(0, 8)}`,
      changes: { backupData: 'accounting' },
      metadata: { backupType: 'accounting' },
      timestamp: new Date(now.getTime() - 86400000).toISOString()
    },
    {
      id: `audit_demo_2_${workspaceId.substring(0, 8)}`,
      workspaceId,
      userId: 'demo-user',
      action: 'backup_created',
      entityType: 'system',
      entityId: `backup_demo_inventory_${workspaceId.substring(0, 8)}`,
      changes: { backupData: 'inventory' },
      metadata: { backupType: 'inventory' },
      timestamp: new Date(now.getTime() - 172800000).toISOString()
    },
    {
      id: `audit_demo_3_${workspaceId.substring(0, 8)}`,
      workspaceId,
      userId: 'demo-user',
      action: 'backup_created',
      entityType: 'system',
      entityId: `backup_demo_full_${workspaceId.substring(0, 8)}`,
      changes: { backupData: 'full' },
      metadata: { backupType: 'full' },
      timestamp: new Date(now.getTime() - 259200000).toISOString()
    }
  ];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const workspaceId = searchParams.get('workspaceId') || DEMO_WORKSPACE_ID;
    
    // Demo mode: bypass authentication, return demo data
    if (DEMO_MODE) {
      console.log('[DEMO MODE] Returning demo data');
      
      switch (action) {
        case 'list-backups':
        default:
          return NextResponse.json(getDemoBackups(), { status: 200 });
        
        case 'get-audit-logs':
          return NextResponse.json(getDemoAuditLogs(), { status: 200 });
      }
    }
    
    // Normal mode: require workspaceId
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' }, 
        { status: 400 }
      );
    }

    switch (action) {
      case 'list-backups':
        const backups = await getBackups(workspaceId);
        return NextResponse.json(backups, { status: 200 });
      
      case 'get-audit-logs':
        const logs = await getAuditLogs(workspaceId);
        return NextResponse.json(logs, { status: 200 });
      
      default:
        // Default: list backups
        const defaultBackups = await getBackups(workspaceId);
        return NextResponse.json(defaultBackups, { status: 200 });
    }
  } catch (error) {
    console.error('Get backup API error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve backups' }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, workspaceId, userId, description } = await request.json();
    
    // Demo mode: allow creating backups without strict auth
    if (DEMO_MODE) {
      console.log('[DEMO MODE] Creating demo backup');
      
      // Use demo workspace if not provided
      const demoWorkspaceId = workspaceId || DEMO_WORKSPACE_ID;
      const demoUserId = userId || 'demo-user';
      
      // Create a backup record
      const timestamp = Date.now();
      const backupId = `${action}_${timestamp}_${demoWorkspaceId.substring(0, 8)}`;
      
      const backupData = {
        id: backupId,
        workspaceId: demoWorkspaceId,
        backupType: action.replace('create-', '').replace('-backup', ''),
        description: description || `${action.replace('create-', '')} backup created at ${new Date().toLocaleString()}`,
        createdAt: new Date().toISOString(),
        createdById: demoUserId,
        data: {
          timestamp: timestamp,
          action: action,
          workspaceId: demoWorkspaceId,
          message: `Simple ${action.replace('create-', '')} backup created successfully`
        }
      };
      
      // Save backup
      await saveBackup(demoWorkspaceId, backupData);
      
      // Create and save audit log entry
      const auditEntry = {
        id: `audit_${timestamp}_${demoWorkspaceId.substring(0, 8)}`,
        workspaceId: demoWorkspaceId,
        userId: demoUserId,
        action: 'backup_created',
        entityType: 'system',
        entityId: backupId,
        changes: { backupData: backupData.backupType },
        metadata: { backupType: backupData.backupType },
        timestamp: new Date().toISOString()
      };
      
      await saveAuditLog(demoWorkspaceId, auditEntry);

      return NextResponse.json({
        backupId: backupId,
        message: `Simple ${action.replace('create-', '')} backup created successfully`,
        backup: backupData
      }, { status: 200 });
    }
    
    // Normal mode: require all fields
    if (!action || !workspaceId || !userId) {
      return NextResponse.json(
        { error: 'action, workspaceId, and userId are required' }, 
        { status: 400 }
      );
    }
    
    // Create a backup record
    const timestamp = Date.now();
    const backupId = `${action}_${timestamp}_${workspaceId.substring(0, 8)}`;
    
    const backupData = {
      id: backupId,
      workspaceId,
      backupType: action.replace('create-', '').replace('-backup', ''),
      description: description || `${action.replace('create-', '')} backup created at ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      createdById: userId,
      data: {
        timestamp: timestamp,
        action: action,
        workspaceId: workspaceId,
        message: `Simple ${action.replace('create-', '')} backup created successfully`
      }
    };
    
    // Save backup
    await saveBackup(workspaceId, backupData);
    
    // Create and save audit log entry
    const auditEntry = {
      id: `audit_${timestamp}_${workspaceId.substring(0, 8)}`,
      workspaceId,
      userId,
      action: 'backup_created',
      entityType: 'system',
      entityId: backupId,
      changes: { backupData: backupData.backupType },
      metadata: { backupType: backupData.backupType },
      timestamp: new Date().toISOString()
    };
    
    await saveAuditLog(workspaceId, auditEntry);

    return NextResponse.json({
      backupId: backupId,
      message: `Simple ${action.replace('create-', '')} backup created successfully`,
      backup: backupData
    }, { status: 200 });
  } catch (error) {
    console.error('Simple backup API error:', error);
    return NextResponse.json(
      { error: 'Failed to create backup' }, 
      { status: 500 }
    );
  }
}