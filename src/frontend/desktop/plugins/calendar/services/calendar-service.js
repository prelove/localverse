/**
 * CalendarService - Database service for Calendar plugin
 * Handles events with date-range queries and recurrence expansion
 */
class CalendarService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  async initSchema() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        all_day INTEGER DEFAULT 0,
        color TEXT DEFAULT '#3b82f6',
        recurrence TEXT,
        reminder_minutes INTEGER,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT DEFAULT 'local',
        deleted INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_cal_events_start ON calendar_events(start_time);
      CREATE INDEX IF NOT EXISTS idx_cal_events_end ON calendar_events(end_time);
    `);
  }

  // ==================== Event CRUD ====================

  async getEvents(startDate, endDate) {
    const startTs = startDate instanceof Date ? startDate.getTime() : startDate;
    const endTs = endDate instanceof Date ? endDate.getTime() : endDate;

    const rows = await this.db.query(
      `SELECT * FROM calendar_events
       WHERE deleted = 0
         AND start_time < ? AND end_time >= ?
       ORDER BY start_time`,
      [endTs, startTs]
    );
    const base = rows.map(r => this.deserializeEvent(r));

    // Expand recurring events within the range
    const expanded = [];
    for (const ev of base) {
      if (ev.recurrence) {
        expanded.push(...this.expandRecurring(ev, startTs, endTs));
      } else {
        expanded.push(ev);
      }
    }
    return expanded.sort((a, b) => a.start_time - b.start_time);
  }

  async getEvent(id) {
    const rows = await this.db.query(
      'SELECT * FROM calendar_events WHERE id = ? AND deleted = 0',
      [id]
    );
    return rows[0] ? this.deserializeEvent(rows[0]) : null;
  }

  async createEvent(data) {
    const id = this.generateId('ev');
    const now = Date.now();
    await this.db.exec(
      `INSERT INTO calendar_events (id, title, description, start_time, end_time, all_day, color, recurrence, reminder_minutes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.description || '',
        data.startTime,
        data.endTime,
        data.allDay ? 1 : 0,
        data.color || '#3b82f6',
        data.recurrence ? JSON.stringify(data.recurrence) : null,
        data.reminderMinutes || null,
        data.createdBy || null,
        now,
        now
      ]
    );
    return this.getEvent(id);
  }

  async updateEvent(id, data) {
    const now = Date.now();
    const updates = [];
    const params = [];

    if (data.title !== undefined)           { updates.push('title = ?');            params.push(data.title); }
    if (data.description !== undefined)     { updates.push('description = ?');       params.push(data.description); }
    if (data.startTime !== undefined)       { updates.push('start_time = ?');        params.push(data.startTime); }
    if (data.endTime !== undefined)         { updates.push('end_time = ?');          params.push(data.endTime); }
    if (data.allDay !== undefined)          { updates.push('all_day = ?');           params.push(data.allDay ? 1 : 0); }
    if (data.color !== undefined)           { updates.push('color = ?');             params.push(data.color); }
    if (data.recurrence !== undefined)      { updates.push('recurrence = ?');        params.push(data.recurrence ? JSON.stringify(data.recurrence) : null); }
    if (data.reminderMinutes !== undefined) { updates.push('reminder_minutes = ?');  params.push(data.reminderMinutes); }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await this.db.exec(
      `UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return this.getEvent(id);
  }

  async deleteEvent(id) {
    await this.db.exec(
      'UPDATE calendar_events SET deleted = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    );
  }

  async getUpcomingEvents(limit = 5) {
    const now = Date.now();
    const rows = await this.db.query(
      `SELECT * FROM calendar_events
       WHERE deleted = 0 AND end_time >= ?
       ORDER BY start_time
       LIMIT ?`,
      [now, limit]
    );
    return rows.map(r => this.deserializeEvent(r));
  }

  // ==================== Recurrence Expansion ====================

  /**
   * Expand a recurring event into occurrences within [startTs, endTs)
   * Supports daily, weekly, monthly recurrence types
   */
  expandRecurring(event, startTs, endTs) {
    if (!event.recurrence) return [event];
    const { type, interval = 1, until } = event.recurrence;
    const duration = event.end_time - event.start_time;
    const occurrences = [];
    let current = event.start_time;
    const limitTs = until ? Math.min(until, endTs) : endTs;
    const MAX_ITER = 366; // safety limit
    let iter = 0;

    while (current < limitTs && iter++ < MAX_ITER) {
      const occEnd = current + duration;
      if (current < endTs && occEnd > startTs) {
        occurrences.push({
          ...event,
          id: `${event.id}_r${current}`,
          start_time: current,
          end_time: occEnd,
          isRecurrenceInstance: true
        });
      }
      // Advance by interval
      const d = new Date(current);
      if (type === 'daily')   d.setDate(d.getDate() + interval);
      else if (type === 'weekly')  d.setDate(d.getDate() + 7 * interval);
      else if (type === 'monthly') d.setMonth(d.getMonth() + interval);
      else break;
      const next = d.getTime();
      if (next === current) break; // safety
      current = next;
    }
    return occurrences;
  }

  // ==================== Helpers ====================

  generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  deserializeEvent(row) {
    return {
      ...row,
      allDay: row.all_day === 1 || row.all_day === '1',
      recurrence: row.recurrence ? JSON.parse(row.recurrence) : null
    };
  }
}

export default CalendarService;
