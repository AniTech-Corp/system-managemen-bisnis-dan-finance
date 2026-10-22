'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Role } from '@prisma/client';

interface ExpenseNotificationPayload {
  pendingApprovals: number;
  financeReviewNeeded: number;
  userRequests: Array<{
    id: string;
    status: string;
    updatedAt: string;
  }>;
}

interface UseExpenseNotificationsReturn {
  pendingApprovals: number;
  financeReviewNeeded: number;
  userRequests: ExpenseNotificationPayload['userRequests'];
  isConnected: boolean;
  lastUpdate: Date | null;
}

export function useExpenseNotifications(
  workspaceId: string,
  userRole: Role,
  userId: string,
  enabled: boolean = true
): UseExpenseNotificationsReturn {
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [financeReviewNeeded, setFinanceReviewNeeded] = useState(0);
  const [userRequests, setUserRequests] = useState<ExpenseNotificationPayload['userRequests']>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (!enabled || !workspaceId) return;
    
    try {
      const eventSource = new EventSource(`/api/v1/expense-requests/events`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'update' && data.payload) {
            setPendingApprovals(data.payload.pendingApprovals || 0);
            setFinanceReviewNeeded(data.payload.financeReviewNeeded || 0);
            setUserRequests(data.payload.userRequests || []);
            setLastUpdate(new Date(data.timestamp));
          }
        } catch (err) {
          console.error('[ExpenseNotifications] Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        
        // Exponential backoff reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      console.error('[ExpenseNotifications] Failed to create EventSource:', err);
      setIsConnected(false);
    }
  }, [enabled, workspaceId]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    pendingApprovals,
    financeReviewNeeded,
    userRequests,
    isConnected,
    lastUpdate,
  };
}

// Fallback polling hook for browsers that don't support SSE
export function useExpenseNotificationsPolling(
  workspaceId: string,
  userRole: Role,
  userId: string,
  interval: number = 30000
): UseExpenseNotificationsReturn {
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [financeReviewNeeded, setFinanceReviewNeeded] = useState(0);
  const [userRequests, setUserRequests] = useState<ExpenseNotificationPayload['userRequests']>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchUpdates = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/expense-requests/stats`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setPendingApprovals(data.stats.myPending || 0);
        setFinanceReviewNeeded(
          ['FINANCE', 'ADMIN', 'OWNER'].includes(userRole) 
            ? (data.stats.byStatus.FINANCE_REVIEW || 0) 
            : 0
        );
        setUserRequests(data.stats.recentRequests || []);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('[ExpenseNotificationsPolling] Failed to fetch:', err);
    }
  }, [userRole]);

  useEffect(() => {
    fetchUpdates();
    const intervalId = setInterval(fetchUpdates, interval);
    return () => clearInterval(intervalId);
  }, [fetchUpdates, interval]);

  return {
    pendingApprovals,
    financeReviewNeeded,
    userRequests,
    isConnected: true,
    lastUpdate,
  };
}