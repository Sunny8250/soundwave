/**
 * Offline Action Queue
 * Queues admin actions (delete, approve, etc.) when offline
 * Automatically syncs when connection returns
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

export type AdminActionType =
  | "DELETE_TRACK"
  | "TAKEDOWN_TRACK"
  | "APPROVE_TRACK"
  | "REJECT_TRACK"
  | "DELETE_ALBUM"
  | "TOGGLE_ALBUM"
  | "DELETE_ARTIST"
  | "VERIFY_ARTIST";

export interface QueuedAction {
  id: string;
  type: AdminActionType;
  payload: Record<string, any>;
  timestamp: number;
  retries: number;
}

const QUEUE_STORAGE_KEY = "admin_action_queue";
const MAX_QUEUE_RETRIES = 5;

class OfflineQueue {
  private queue: QueuedAction[] = [];
  private syncing = false;

  async init() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      this.queue = stored ? JSON.parse(stored) : [];
      console.log(`[OfflineQueue] Loaded ${this.queue.length} queued actions`);
    } catch (error) {
      console.error("[OfflineQueue] Failed to load queue:", error);
      this.queue = [];
    }
  }

  async add(type: AdminActionType, payload: Record<string, any>) {
    const action: QueuedAction = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(action);
    await this.persist();
    console.log(`[OfflineQueue] Added action: ${type}`);
    return action.id;
  }

  async remove(actionId: string) {
    this.queue = this.queue.filter((a) => a.id !== actionId);
    await this.persist();
  }

  async retry(actionId: string) {
    const action = this.queue.find((a) => a.id === actionId);
    if (action) {
      action.retries++;
      await this.persist();
    }
  }

  async clear() {
    this.queue = [];
    await this.persist();
  }

  getQueue() {
    return [...this.queue];
  }

  getPending() {
    return this.queue.length;
  }

  private async persist() {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error("[OfflineQueue] Failed to persist queue:", error);
    }
  }
}

export const offlineQueue = new OfflineQueue();

/**
 * Hook to monitor offline queue and sync when online
 */
export function useOfflineSync(onSync?: () => Promise<void>) {
  const isOnline = useNetworkStatus();

  React.useEffect(() => {
    if (isOnline && offlineQueue.getPending() > 0) {
      onSync?.().catch((error) => {
        console.error("[OfflineSync] Sync failed:", error);
      });
    }
  }, [isOnline, onSync]);

  return {
    pending: offlineQueue.getPending(),
    queue: offlineQueue.getQueue(),
  };
}
