/**
 * Teacher bulk SMS — same localized copy as push notifications,
 * delivered only via Advansys sendSms (no FCM / no DB notification rows).
 */

const {
  buildHomeworkNotification,
  buildQuizNotification,
} = require('./notificationTranslations');
const { getUserLanguage } = require('./notificationSender');
const { sendSms, generateAdvansysRequestId } = require('./sms');

const DEFAULT_TITLE = 'Mayada Academy';

function hwRawToDisplayText(hwRaw, userLang) {
  const raw = hwRaw != null ? String(hwRaw).trim() : '';
  const lower = raw.toLowerCase();
  const yes =
    lower === 'yes' ||
    lower === 'true' ||
    lower === '1' ||
    raw === 'نعم' ||
    raw === 'تم';
  if (yes) {
    return userLang === 'AR' ? 'حل الواجب ✅' : 'Homework Done ✅';
  }
  return userLang === 'AR' ? 'لم يحل الواجب ❌' : 'Homework Not Done ❌';
}

/**
 * @param {string} phone
 * @param {{ studentName?: string, hwRawCell: string }} data
 * @returns {Promise<string>}
 */
async function buildHwStatusSmsText(phone, data) {
  const lang = await getUserLanguage(phone);
  const hwText = hwRawToDisplayText(data.hwRawCell, lang);
  const notification = buildHomeworkNotification(
    {
      studentName: data.studentName,
      hwStatus: hwText,
      solvText: '',
    },
    lang,
  );
  return `${notification.title}: ${notification.body}`;
}

/**
 * @param {string} phone
 * @param {{ studentName?: string, quizName: string, grade: string, maxGrade: string }} data
 * @returns {Promise<string>}
 */
async function buildGradeSmsText(phone, data) {
  const lang = await getUserLanguage(phone);
  const notification = buildQuizNotification(
    {
      studentName: data.studentName,
      quizName: data.quizName,
      grade: data.grade,
      maxGrade: data.maxGrade,
    },
    lang,
  );
  return `${notification.title}: ${notification.body}`;
}

/** Title + body (body should already have {name} replaced if needed). */
function buildCustomSmsFullText(title, personalizedBody) {
  const t = (title || DEFAULT_TITLE).trim() || DEFAULT_TITLE;
  const b = String(personalizedBody || '').trim();
  return `${t}: ${b}`;
}

/** @param {string} phoneNumber @param {string} message */
async function deliverTeacherSms(phoneNumber, message) {
  return sendSms({
    phoneNumber,
    message,
    requestId: generateAdvansysRequestId(),
  });
}

module.exports = {
  DEFAULT_TITLE,
  hwRawToDisplayText,
  buildHwStatusSmsText,
  buildGradeSmsText,
  buildCustomSmsFullText,
  deliverTeacherSms,
};
