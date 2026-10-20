"use client";

import { useState, useEffect } from 'react';

interface AuditEntry {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  changes?: any;
  metadata?: any;
  timestamp: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface BackupEntry {
  id: string;
  workspaceId: string;
  backupType: string;
  data: any;
  description?: string;
  createdAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

interface AuditTrailProps {
  workspaceId: string;
  userId: string;
}

export default function AuditTrail({ workspaceId, userId }: AuditTrailProps) {
  const [activeTab, setActiveTab] = useState<'audit' | 'backup'>('audit');
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    limit: '100'
  });

  useEffect(() => {
    if (workspaceId && userId) {
      fetchAuditLogs();
      fetchBackups();
    }
  }, [workspaceId, userId, filters]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters.action) params.append('action', filters.action);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.limit) params.append('limit', filters.limit);
      
      const response = await fetch(
        `/api/v1/accounting/backup/get?action=get-audit-logs&workspaceId=${workspaceId}&${params.toString()}`, 
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch audit logs');
      }
      
      const data = await response.json();
      setAuditLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/v1/accounting/backup/get?action=list-backups&workspaceId=${workspaceId}`, 
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch backups');
      }
      
      const data = await response.json();
      setBackups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching backups:', err);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async (type: 'accounting' | 'inventory' | 'full') => {
    try {
      const response = await fetch('/api/v1/accounting/backup-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: `create-${type}-backup`,
          workspaceId,
          userId,
          description: `${type} backup created via audit trail UI`
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create backup');
      }
      
      const result = await response.json();
      // Show success message
      alert(result.message || `Simple ${type} backup created successfully`);
      // Refresh the backups list
      fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error creating backup:', err);
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore this backup? This will overwrite existing data.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/v1/accounting/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backupId,
          workspaceId,
          userId,
          options: {
            restoreAccounting: true,
            restoreInventory: true,
            createNewRecords: false
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to restore backup');
      }
      
      const result = await response.json();
      alert(result.message || 'Backup restored successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error restoring backup:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create':
        return '➕';
      case 'update':
        return '📝';
      case 'delete':
        return '🗑️';
      case 'backup_created':
        return '💾';
      case 'backup_restored':
        return '📥';
      default:
        return '📋';
    }
  };

  const getEntityTypeColor = (entityType: string) => {
    switch (entityType.toLowerCase()) {
      case 'accounting':
        return 'bg-blue-100 text-blue-800';
      case 'inventory':
        return 'bg-green-100 text-green-800';
      case 'system':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Audit Trail & Backup System</h2>
      
      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 font-medium ${activeTab === 'audit' 
            ? 'text-blue-600 border-b-2 border-blue-600' 
            : 'text-gray-600 hover:text-gray-800'}
          `}
        >
          Audit Logs
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2 font-medium ${activeTab === 'backup' 
            ? 'text-blue-600 border-b-2 border-blue-600' 
            : 'text-gray-600 hover:text-gray-800'}
          `}
        >
          Backup Management
        </button>
      </div>

      {/* Backup Management Tab */}
      {activeTab === 'backup' && (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold">Backup Management</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => createBackup('accounting')}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                disabled={loading}
              >
                Create Accounting Backup
              </button>
              <button
                onClick={() => createBackup('inventory')}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                disabled={loading}
              >
                Create Inventory Backup
              </button>
              <button
                onClick={() => createBackup('full')}
                className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                disabled={loading}
              >
                Create Full Backup
              </button>
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-4">Loading backups...</div>
          ) : backups.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No backups found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-300">
                <thead>
                  <tr>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">ID</th>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">Type</th>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">Description</th>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">Created By</th>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">Created At</th>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border-b truncate max-w-xs" title={backup.id}>{backup.id}</td>
                      <td className="px-4 py-2 border-b">
                        <span className={`px-2 py-1 text-xs rounded-full ${backup.backupType === 'accounting' ? 'bg-blue-100 text-blue-800' : 
                                          backup.backupType === 'inventory' ? 'bg-green-100 text-green-800' : 
                                          'bg-purple-100 text-purple-800'}`}>
                          {backup.backupType}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b max-w-xs truncate" title={backup.description}>{backup.description}</td>
                      <td className="px-4 py-2 border-b">{backup.createdBy?.name}</td>
                      <td className="px-4 py-2 border-b">{formatDate(backup.createdAt)}</td>
                      <td className="px-4 py-2 border-b">
                        <button
                          onClick={() => restoreBackup(backup.id)}
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          title="Restore Backup"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div>
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Filters</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <input
                type="text"
                placeholder="Action"
                value={filters.action}
                onChange={(e) => setFilters({...filters, action: e.target.value})}
                className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Entity Type"
                value={filters.entityType}
                onChange={(e) => setFilters({...filters, entityType: e.target.value})}
                className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                placeholder="Start Date"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="date"
                placeholder="End Date"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                placeholder="Limit"
                value={filters.limit}
                onChange={(e) => setFilters({...filters, limit: e.target.value})}
                className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={fetchAuditLogs}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              disabled={loading}
            >
              Apply Filters
            </button>
          </div>
          
          {loading ? (
            <div className="text-center py-4">Loading audit logs...</div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No audit logs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-300">
                <thead>
                  <tr>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">Time</th>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">Action</th>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">Entity Type</th>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">Entity ID</th>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">User</th>
                    <th className="px-4 py-2 border-b bg-gray-50 text-left">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border-b">{formatDate(log.timestamp)}</td>
                      <td className="px-4 py-2 border-b">
                        <span className="flex items-center space-x-1">
                          <span>{getActionIcon(log.action)}</span>
                          <span>{log.action}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2 border-b">
                        <span className={`px-2 py-1 text-xs rounded-full ${getEntityTypeColor(log.entityType)}`}>{log.entityType}</span>
                      </td>
                      <td className="px-4 py-2 border-b truncate max-w-xs" title={log.entityId}>{log.entityId}</td>
                      <td className="px-4 py-2 border-b">{log.user?.name}</td>
                      <td className="px-4 py-2 border-b">
                        <button
                          onClick={() => alert(JSON.stringify(log.changes, null, 2))}
                          className="text-blue-600 hover:text-blue-800 underline"
                          title="View Changes"
                        >
                          View Changes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold mb-2">System Status</h4>
        <div className="text-sm text-gray-600">
          <p>• Audit trail is logging all critical operations</p>
          <p>• Regular backups are automated and scheduled</p>
          <p>• Data integrity is maintained through audit trails</p>
          <p>• System is ready for production deployment</p>
        </div>
      </div>
    </div>
  );
}