/**
 * ics.mjs | the 150 day calendar as a subscribable ICS file.
 *
 * Written by hand, because the whole file is nine lines of structure and a
 * dependency for that would be a dependency to audit.
 *
 * The five daily blocks become events in Asia/Kolkata. A VTIMEZONE block with the
 * fixed +05:30 offset is included so a phone that has never heard of the zone
 * still places the events correctly. India has no daylight saving, so one
 * STANDARD rule is the whole definition.
 */

const CRLF = '\r\n';

/** The tracked blocks that become calendar events, with their windows. */
const EVENT_BLOCKS = [
  { code: 'DSA', label: 'DSA', start: '063000', end: '090000' },
  { code: 'LEARN', label: 'Learn', start: '093000', end: '123000' },
  { code: 'BUILD', label: 'Build', start: '140000', end: '160000' },
  { code: 'CLOSE', label: 'Close', start: '160000', end: '163000' },
  { code: 'MONEY', label: 'Money hour', start: '170000', end: '180000' },
];

function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 says a content line is folded at 75 octets. */
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const out = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Do not split a multi byte character.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    out.push(bytes.subarray(start, end).toString('utf8'));
    start = end;
    limit = 74; // continuation lines carry a leading space
  }
  return out.join(`${CRLF} `);
}

function stamp() {
  // A fixed DTSTAMP keeps the file byte stable for the same input, which makes
  // a diff meaningful and a re-subscription a no-op.
  return '20260827T000000Z';
}

function uid(date, code, origin) {
  const host = (() => {
    try {
      return new URL(origin).host;
    } catch {
      return 'roadmap.local';
    }
  })();
  return `${date.replace(/-/g, '')}-${code.toLowerCase()}@${host}`;
}

export function buildIcs({ days, origin, timezone = 'Asia/Kolkata', userLabel = '' }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Roadmap Tracker//150 day plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(`Roadmap${userLabel ? `, ${userLabel}` : ''}`)}`,
    `X-WR-TIMEZONE:${timezone}`,
    'X-WR-CALDESC:' +
      escapeText(
        '28 August 2026 to 24 January 2027. Five daily blocks. Tasks are the exact text from the roadmap.'
      ),
    'BEGIN:VTIMEZONE',
    `TZID:${timezone}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0530',
    'TZOFFSETTO:+0530',
    'TZNAME:IST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];

  for (const day of days) {
    const d = day.cal_date.replace(/-/g, '');
    const isRest = day.kind === 'sunday_rest';
    const isSunday = day.kind.startsWith('sunday_');
    const weekLabel = day.week_n ? `W${String(day.week_n).padStart(2, '0')}` : 'LAUNCH';

    if (isSunday) {
      // One event for the whole Sunday, carrying its own text.
      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid(day.cal_date, 'sunday', origin)}`,
        `DTSTAMP:${stamp()}`,
        `DTSTART;TZID=${timezone}:${d}T${isRest ? '090000' : '100000'}`,
        `DTEND;TZID=${timezone}:${d}T${isRest ? '093000' : '160000'}`,
        `SUMMARY:${escapeText(`${weekLabel} ${isRest ? 'Rest Sunday' : day.kind === 'sunday_gate' ? 'Gate audit' : 'Working Sunday'}`)}`,
        `DESCRIPTION:${escapeText(day.learn_task)}\\n\\nMoney: ${escapeText(day.money_task)}`,
        `CATEGORIES:${isRest ? 'REST' : day.kind === 'sunday_gate' ? 'GATE' : 'SUNDAY'}`,
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
      continue;
    }

    for (const block of EVENT_BLOCKS) {
      let description = '';
      if (block.code === 'DSA') description = `Target ${day.dsa_target} problems. Striver A2Z, in JavaScript.`;
      else if (block.code === 'LEARN') description = day.learn_task;
      else if (block.code === 'BUILD') description = day.build_task;
      else if (block.code === 'MONEY') description = day.money_task;
      else description = 'Commit, log.md, tomorrow decided before you stand up.';

      const summaryTask =
        block.code === 'DSA'
          ? `${day.dsa_target} problems`
          : String(description).split(/[.|]/)[0].trim().slice(0, 60);

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid(day.cal_date, block.code, origin)}`,
        `DTSTAMP:${stamp()}`,
        `DTSTART;TZID=${timezone}:${d}T${block.start}`,
        `DTEND;TZID=${timezone}:${d}T${block.end}`,
        `SUMMARY:${escapeText(`${weekLabel} ${block.label}: ${summaryTask}`)}`,
        `DESCRIPTION:${escapeText(description)}`,
        `CATEGORIES:${block.code}`,
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join(CRLF)}${CRLF}`;
}
