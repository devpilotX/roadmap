/**
 * links.ts | writing progress against a library resource or a week link.
 *
 * When a week link maps to a library row, both rows are written in one
 * transaction, so /weeks and /library can never disagree about whether
 * something has been read.
 */

import { transaction, type SqlParam } from './pool';
import { nowDateTime } from '../dates';

export interface LinkProgressPatch {
  status?: 'todo' | 'reading' | 'done';
  minutes?: number;
  rating?: number | null;
  notes?: string | null;
}

export interface WriteLinkProgressArgs {
  resourceId?: number | null;
  weekLinkId?: number | null;
  patch: LinkProgressPatch;
}

export async function writeLinkProgress(
  userId: number,
  { resourceId = null, weekLinkId = null, patch }: WriteLinkProgressArgs
) {
  return transaction(async (tx) => {
    const now = nowDateTime();
    const status = patch.status;
    const setStarted = status === 'reading' || status === 'done';
    const setDone = status === 'done';

    if (resourceId) {
      await tx.run(
        'INSERT INTO resource_progress (user_id, resource_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE resource_id = VALUES(resource_id)',
        [userId, resourceId]
      );
      const sets: string[] = [];
      const params: SqlParam[] = [];
      if (status) {
        sets.push('status = ?');
        params.push(status);
      }
      if (patch.minutes !== undefined) {
        sets.push('minutes = ?');
        params.push(patch.minutes);
      }
      if (patch.rating !== undefined) {
        sets.push('rating = ?');
        params.push(patch.rating);
      }
      if (patch.notes !== undefined) {
        sets.push('notes = ?');
        params.push(patch.notes);
      }
      if (setStarted) {
        sets.push('started_at = COALESCE(started_at, ?)');
        params.push(now);
      }
      if (status) {
        sets.push('completed_at = ?');
        params.push(setDone ? now : null);
      }
      if (sets.length) {
        params.push(userId, resourceId);
        await tx.run(
          `UPDATE resource_progress SET ${sets.join(', ')} WHERE user_id = ? AND resource_id = ?`,
          params
        );
      }
    }

    if (weekLinkId) {
      await tx.run(
        'INSERT INTO week_link_progress (user_id, week_link_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE week_link_id = VALUES(week_link_id)',
        [userId, weekLinkId]
      );
      const sets: string[] = [];
      const params: SqlParam[] = [];
      if (status) {
        sets.push('status = ?');
        params.push(status);
      }
      if (patch.minutes !== undefined) {
        sets.push('minutes = ?');
        params.push(patch.minutes);
      }
      if (patch.notes !== undefined) {
        sets.push('notes = ?');
        params.push(patch.notes);
      }
      if (setStarted) {
        sets.push('started_at = COALESCE(started_at, ?)');
        params.push(now);
      }
      if (status) {
        sets.push('completed_at = ?');
        params.push(setDone ? now : null);
      }
      if (sets.length) {
        params.push(userId, weekLinkId);
        await tx.run(
          `UPDATE week_link_progress SET ${sets.join(', ')} WHERE user_id = ? AND week_link_id = ?`,
          params
        );
      }
    }

    return {
      resource_id: resourceId,
      week_link_id: weekLinkId,
      status: status ?? null,
      synced_both: Boolean(resourceId && weekLinkId),
    };
  });
}
