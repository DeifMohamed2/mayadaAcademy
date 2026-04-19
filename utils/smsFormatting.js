/**
 * Mayada Academy — SMS body shaping (segment-aware, inspired by Elkably smsSender structure:
 * clean → fit length → optional split). Content stays Mayada/Arabic/English from notifications;
 * this module only formats and limits length for billing-friendly SMS.
 *
 * GSM-7: 160 chars per segment (single), 153 per part when concatenated (multi-part).
 * UCS-2 (Arabic/emojis): 70 / 67 per part — used when text is not GSM-7-safe.
 */

function isGsm7String(str) {
  if (!str) return true;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 0x7f) return false;
  }
  return true;
}

const GSM_SINGLE = 160;
const GSM_MULTI = 153;
const UCS2_SINGLE = 70;
const UCS2_MULTI = 67;

function getCharsPerSegment(text) {
  return isGsm7String(text) ? GSM_SINGLE : UCS2_SINGLE;
}

function getCharsPerPartConcat(text) {
  return isGsm7String(text) ? GSM_MULTI : UCS2_MULTI;
}

function estimateSmsSegments(text) {
  if (!text || text.length === 0) {
    return { segments: 0, encoding: 'empty', charsPerPart: 0 };
  }
  const gsm = isGsm7String(text);
  const encoding = gsm ? 'GSM-7' : 'UCS-2';
  const first = gsm ? GSM_SINGLE : UCS2_SINGLE;
  const rest = gsm ? GSM_MULTI : UCS2_MULTI;
  const len = text.length;
  if (len <= first) {
    return { segments: 1, encoding, charsPerPart: first };
  }
  const remaining = len - first;
  const extra = Math.ceil(remaining / rest);
  return { segments: 1 + extra, encoding, charsPerPart: first };
}

function stripEmojisForSms(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[✅❌⚠️📍📊📅📝]/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

function truncateAtBoundary(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  let t = text.slice(0, maxLen);
  const lastSpace = t.lastIndexOf(' ');
  const lastNl = t.lastIndexOf('\n');
  const br = Math.max(lastSpace, lastNl);
  if (br > maxLen * 0.5) t = t.slice(0, br);
  return t.replace(/[\s\n]+$/g, '');
}

function buildMayadaSmsPlainText(title, body) {
  const head = 'Mayada Academy';
  const t = stripEmojisForSms(title || '').replace(/\s+/g, ' ').trim();
  const b = (body || '').replace(/\r\n/g, '\n').trim();
  return `${head}\n${t}\n${b}`;
}

function splitIntoSmsParts(text, maxCharsPerPart) {
  if (!text) return [];
  if (text.length <= maxCharsPerPart) return [text];

  const parts = [];
  let rest = text;

  while (rest.length > 0) {
    if (rest.length <= maxCharsPerPart) {
      parts.push(rest.trim());
      break;
    }
    let chunk = rest.slice(0, maxCharsPerPart);
    const lastNl = chunk.lastIndexOf('\n');
    const lastSp = chunk.lastIndexOf(' ');
    let cut = maxCharsPerPart;
    if (lastNl > maxCharsPerPart * 0.4) cut = lastNl + 1;
    else if (lastSp > maxCharsPerPart * 0.5) cut = lastSp;

    chunk = chunk.slice(0, cut);
    chunk = truncateAtBoundary(chunk, chunk.length);
    parts.push(chunk.trim());
    rest = rest.slice(cut).trim();
  }

  return parts.filter(Boolean);
}

function prepareAttendanceSmsParts(notification, opts = {}) {
  const maxSegments = opts.maxSegments ?? 3;
  const full = buildMayadaSmsPlainText(notification.title, notification.body);
  const est = estimateSmsSegments(full);

  const partLimit = getCharsPerPartConcat(full);
  if (est.segments <= 1 || full.length <= getCharsPerSegment(full)) {
    return {
      parts: [full],
      estimate: est,
      truncated: false,
    };
  }

  if (est.segments > maxSegments) {
    const maxChars = getCharsPerSegment(full) * maxSegments;
    const one = truncateAtBoundary(full, maxChars);
    return {
      parts: [one],
      estimate: estimateSmsSegments(one),
      truncated: true,
    };
  }

  const parts = splitIntoSmsParts(full, partLimit);
  const prefixParts = parts.map((p, i) =>
    parts.length > 1 ? `( ${i + 1}/${parts.length} )\n${p}` : p,
  );

  return {
    parts: prefixParts,
    estimate: est,
    truncated: false,
  };
}



/**
 * Short homework line for SMS only (no emojis). Prefer over push hwLine.
 */
function homeworkSmsLine(homeworkStatus, language) {
  const lang = ['EN', 'AR'].includes(language) ? language : 'EN';
  const map = {
    done: { EN: 'HW: Done', AR: 'الواجب: تم' },
    not_done: { EN: 'HW: Not done', AR: 'الواجب: لم يتم' },
    not_specified: { EN: '', AR: '' },
  };
  return map[homeworkStatus]?.[lang] || '';
}

/**
 * Compact attendance SMS: same facts as push, different wording; no emojis; no title/body duplication.
 */
function buildCompactAttendanceSms(attendanceType, data, language) {
  const lang = ['EN', 'AR'].includes(language) ? language : 'EN';
  const head = 'Mayada Academy';
  const student = stripEmojisForSms(data.studentName || '').trim();
  const group = stripEmojisForSms(data.group || '').trim();
  const absences =
    data.absences !== undefined && data.absences !== null
      ? String(data.absences).trim()
      : '';

  if (attendanceType === 'present') {
    let hw = '';
    if (data.homeworkStatus) {
      hw = homeworkSmsLine(data.homeworkStatus, lang);
    } else if (data.hwLine) {
      hw = stripEmojisForSms(String(data.hwLine)).replace(/\s+/g, ' ').trim();
    }
    if (lang === 'AR') {
      const lines = [
        head,
        `حضور: ${student}`,
        hw || null,
        `المجموعة: ${group}`,
        `إجمالي الغياب: ${absences}`,
      ].filter(Boolean);
      return lines.join('\n');
    }
    const lines = [
      head,
      `Present: ${student}`,
      hw || null,
      `Group: ${group}`,
      `Total Absent: ${absences}`,
    ].filter(Boolean);
    return lines.join('\n');
  }

  if (attendanceType === 'late') {
    if (lang === 'AR') {
      return [
        head,
        `تأخر: ${student}`,
        `المجموعة: ${group}`,
        `إجمالي الغياب: ${absences}`,
      ].join('\n');
    }
    return [
      head,
      `Late: ${student}`,
      `Group: ${group}`,
      `Total Absent: ${absences}`,
    ].join('\n');
  }

  if (attendanceType === 'absent') {
    const extra = stripEmojisForSms(data.warningMessage || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (lang === 'AR') {
      const base = [
        head,
        `غياب: ${student}`,
        `المجموعة: ${group}`,
        `إجمالي الغياب: ${absences}`,
      ];
      if (extra) base.push(extra);
      return base.join('\n');
    }
    const base = [
      head,
      `Absent: ${student}`,
      `Group: ${group}`,
      `Total Absent: ${absences}`,
    ];
    if (extra) base.push(extra);
    return base.join('\n');
  }

  if (attendanceType === 'absenceWarning') {
    const warn = stripEmojisForSms(data.warningMessage || '').trim();
    if (lang === 'AR') {
      return [
        head,
        `تنبيه غياب: ${student}`,
        `إجمالي الغياب: ${absences}`,
        `المجموعة: ${group}`,
        warn ? warn : null,
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      head,
      `Absence alert: ${student}`,
      `Total Absent: ${absences}`,
      `Group: ${group}`,
      warn ? warn : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return buildMayadaSmsPlainText(data.title || '', data.body || '');
}

/**
 * Keep a single SMS segment when possible (GSM-7: 160, UCS-2: 70).
 */
function fitAttendanceSmsSingleSegment(text) {
  if (!text) return '';
  const max = isGsm7String(text) ? GSM_SINGLE : UCS2_SINGLE;
  if (text.length <= max) return text;
  return truncateAtBoundary(text, max);
}


module.exports = {
  isGsm7String,
  getCharsPerSegment,
  getCharsPerPartConcat,
  estimateSmsSegments,
  stripEmojisForSms,
  truncateAtBoundary,
  buildMayadaSmsPlainText,
  splitIntoSmsParts,
  prepareAttendanceSmsParts,
  homeworkSmsLine,
  buildCompactAttendanceSms,
  fitAttendanceSmsSingleSegment,
  GSM_SINGLE,
  GSM_MULTI,
  UCS2_SINGLE,
  UCS2_MULTI,
};
