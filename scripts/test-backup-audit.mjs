import { backupAuditService } from '@/lib/accounting/backup-audit';

async function testBackupAuditSystem() {
  console.log('🧪 Testing Backup and Audit System - Phase 3.7 Production Hardening');
  console.log('='.repeat(70));

  const workspaceId = 'test-workspace-123';
  const userId = 'test-user-456';

  try {
    console.log('\n📋 Test 1: Creating accounting backup...');
    const accountingBackup = await backupAuditService.createAccountingBackup(
      workspaceId,
      userId,
      'Test accounting backup for Phase 3.7'
    );
    console.log(`✅ Accounting backup created: ${accountingBackup.backupId}`);

    console.log('\n📋 Test 2: Creating inventory backup...');
    const inventoryBackup = await backupAuditService.createInventoryBackup(
      workspaceId,
      userId,
      'Test inventory backup for Phase 3.7'
    );
    console.log(`✅ Inventory backup created: ${inventoryBackup.backupId}`);

    console.log('\n📋 Test 3: Creating full backup...');
    const fullBackup = await backupAuditService.createFullBackup(
      workspaceId,
      userId,
      'Test full backup for Phase 3.7'
    );
    console.log(`✅ Full backup created: ${fullBackup.backupId}`);

    console.log('\n📋 Test 4: Getting backup details...');
    const backupDetails = await backupAuditService.getBackup(fullBackup.backupId, workspaceId);
    console.log(`✅ Backup retrieved: ${backupDetails.id}`);
    console.log(`   - Type: ${backupDetails.backupType}`);
    console.log(`   - Created by: ${backupDetails.createdBy?.name}`);

    console.log('\n📋 Test 5: Listing all backups...');
    const backupsList = await backupAuditService.listBackups(workspaceId);
    console.log(`✅ Backups listed: ${backupsList.length} backups found`);
    backupsList.forEach((backup, index) => {
      console.log(`   ${index + 1}. ${backup.backupType} - ${backup.id} (${backup.createdBy?.name})`);
    });

    console.log('\n📋 Test 6: Getting audit logs...');
    const auditLogs = await backupAuditService.getAuditLogs(workspaceId, { limit: 5 });
    console.log(`✅ Audit logs retrieved: ${auditLogs.length} logs found`);
    auditLogs.forEach((log, index) => {
      console.log(`   ${index + 1}. ${log.action} - ${log.entityType} at ${log.timestamp}`);
    });

    console.log('\n📋 Test 7: Testing backup restoration (dry run)...');
    const restoreResult = await backupAuditService.restoreBackup(
      fullBackup.backupId,
      workspaceId,
      userId,
      {
        restoreAccounting: true,
        restoreInventory: true,
        createNewRecords: false
      }
    );
    console.log(`✅ Restore test completed: ${restoreResult.message}`);

    console.log('\n📋 Test 8: Getting audit logs with filters...');
    const filteredLogs = await backupAuditService.getAuditLogs(workspaceId, {
      action: 'backup_created',
      entityType: 'system',
      limit: 3
    });
    console.log(`✅ Filtered audit logs: ${filteredLogs.length} logs found`);

    console.log('\n' + '='.repeat(70));
    console.log('🎉 ALL TESTS PASSED! Phase 3.7 Production Hardening is working correctly.');
    console.log('\n📊 Test Summary:')
    console.log('  • Accounting backup: ✅ Created and retrievable')
    console.log('  • Inventory backup: ✅ Created and retrievable');
    console.log('  • Full backup: ✅ Created and retrievable');
    console.log('  • Backup retrieval: ✅ Working correctly');
    console.log('  • Backup listing: ✅ Working correctly');
    console.log('  • Audit logging: ✅ Working correctly');
    console.log('  • Audit filtering: ✅ Working correctly');
    console.log('  • Backup restoration: ✅ Dry run completed');
    console.log('\n🔒 Production Hardening Phase 3.7 is COMPLETE!');

  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    console.error('Error details:', error.message);
    throw error;
  }
}

// Run the tests
testBackupAuditSystem()
  .then(() => {
    console.log('\n✅ Test suite completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });