import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { AttendanceStatus } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';
import { getWibDayRange } from '@/lib/time-series-engine';

// GET: Ambil data presensi hari ini
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;

      const { startDate: startOfToday, endDate: endOfToday } = getWibDayRange();
      const todayWhere = { workspaceId, checkInTime: { gte: startOfToday, lte: endOfToday } };
      const [records, totalAttendance, aggregates] = await Promise.all([
        prisma.attendanceRecord.findMany({
          where: todayWhere,
          orderBy: { checkInTime: 'desc' },
          take: 30,
        }),
        prisma.attendanceRecord.count({ where: todayWhere }),
        prisma.attendanceRecord.groupBy({ by: ['status'], where: todayWhere, _count: { id: true } }),
      ]);

      const countByStatus = new Map(aggregates.map((aggregate) => [aggregate.status, aggregate._count.id || 0]));
      const onTimeCount = countByStatus.get(AttendanceStatus.HADIR_TEPAT_WAKTU) || 0;
      const lateCount = countByStatus.get(AttendanceStatus.TERLAMBAT) || 0;
      const leaveCount = (countByStatus.get(AttendanceStatus.IZIN) || 0) + (countByStatus.get(AttendanceStatus.CUTI) || 0);

      return NextResponse.json({
        summary: {
          totalAttendance,
          onTimeCount,
          lateCount,
          leaveCount,
          punctualityRate: totalAttendance > 0 ? `${Math.round((onTimeCount / totalAttendance) * 100)}%` : '100%',
        },
        records,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat data presensi hari ini.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Catat Absensi Staf (Check-In)
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { employeeName, shift = 'PAGI', status = 'HADIR_TEPAT_WAKTU', location = 'Lokasi belum diverifikasi', notes } = await req.json();

      if (!employeeName || !employeeName.trim()) {
        return NextResponse.json({ message: 'Nama staf wajib diisi.' }, { status: 400 });
      }

      if (!Object.values(AttendanceStatus).includes(status as AttendanceStatus)) {
        return NextResponse.json({ message: 'Status presensi tidak valid.' }, { status: 400 });
      }

      const record = await prisma.attendanceRecord.create({
        data: {
          workspaceId: auth.workspace.id,
          employeeName: employeeName.trim(),
          shift,
          status: status as AttendanceStatus,
          location: typeof location === 'string' && location.trim() ? location.trim().slice(0, 100) : 'Lokasi belum diverifikasi',
          notes: notes?.trim(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Presensi staf '${record.employeeName}' shift ${record.shift} berhasil dicatat!`,
        record,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Presensi gagal dicatat.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
