/**
 * Notification Translations Utility
 * 
 * This module provides bilingual notification messages (English/Arabic)
 * for all system notifications including attendance, homework, payments, etc.
 * 
 * Default language: English (EN)
 * Supported languages: EN, AR
 */

const translations = {
  // ==================== Attendance Notifications ====================
  attendance: {
    present: {
      title: {
        EN: '✅ Attendance Confirmed',
        AR: '✅ تأكيد الحضور',
      },
      body: {
        EN: (data) => `${data.studentName} has been marked present today.${data.hwLine}\n\n📍 Group: ${data.group}\n📊 Absences: ${data.absences}\n📅 Date: ${data.date}`,
        AR: (data) => `تم تسجيل حضور ${data.studentName} بنجاح.${data.hwLine}\n\n📍 المجموعة: ${data.group}\n📊 عدد مرات الغياب: ${data.absences}\n📅 التاريخ: ${data.date}`,
      },
    },
    late: {
      title: {
        EN: '⚠️ Late Attendance',
        AR: '⚠️ تأخر في الحضور',
      },
      body: {
        EN: (data) => `${data.studentName} has been marked late today.\n\n📍 Group: ${data.group}\n📊 Absences: ${data.absences}\n📅 Date: ${data.date}\n\nPlease ensure punctuality.`,
        AR: (data) => `تم تسجيل حضور ${data.studentName} متأخرًا اليوم.\n\n📍 المجموعة: ${data.group}\n📊 عدد مرات الغياب: ${data.absences}\n📅 التاريخ: ${data.date}\n\nيرجى الانتباه لمواعيد الحضور.`,
      },
    },
    absent: {
      title: {
        EN: '❌ Absence Recorded',
        AR: '❌ تسجيل غياب',
      },
      body: {
        EN: (data) => `${data.studentName} was absent today.\n\n📍 Group: ${data.group}\n📊 Total Absences: ${data.absences}\n📅 Date: ${data.date}\n\nPlease contact us if there's an issue.`,
        AR: (data) => `تم تسجيل غياب ${data.studentName} اليوم.\n\n📍 المجموعة: ${data.group}\n📊 إجمالي الغياب: ${data.absences}\n📅 التاريخ: ${data.date}\n\nيرجى التواصل معنا إذا كان هناك أي مشكلة.`,
      },
    },
    absenceWarning: {
      title: {
        EN: '⚠️ Absence Warning',
        AR: '⚠️ تحذير غياب',
      },
      body: {
        EN: (data) => `${data.studentName} has ${data.absences} absences.\n\n📍 Group: ${data.group}\n📅 Date: ${data.date}\n\n⚠️ ${data.warningMessage}`,
        AR: (data) => `${data.studentName} لديه ${data.absences} حالات غياب.\n\n📍 المجموعة: ${data.group}\n📅 التاريخ: ${data.date}\n\n⚠️ ${data.warningMessage}`,
      },
    },
  },

  // ==================== Homework Notifications ====================
  homework: {
    status: {
      done: {
        EN: '\n✅ Homework: Completed',
        AR: '\n✅ الواجب: تم حل الواجب',
      },
      not_done: {
        EN: '\n❌ Homework: Not completed',
        AR: '\n❌ الواجب: لم يحل الواجب',
      },
      not_specified: {
        EN: '',
        AR: '',
      },
    },
    statusLabel: {
      done: {
        EN: 'Completed',
        AR: 'تم الحل',
      },
      not_done: {
        EN: 'Not completed',
        AR: 'لم يحل',
      },
      not_specified: {
        EN: 'Not specified',
        AR: 'لم يحدد',
      },
    },
    notification: {
      title: {
        EN: '📝 Homework Status',
        AR: '📝 حالة الواجب',
      },
      body: {
        EN: (data) => `Hello, parent of ${data.studentName}\nHomework Status: ${data.hwStatus}${data.solvText}`,
        AR: (data) => `مرحباً ولي أمر الطالب ${data.studentName}\nحالة الواجب: ${data.hwStatus}${data.solvText}`,
      },
    },
  },

  // ==================== Payment Notifications ====================
  payment: {
    reminder: {
      title: {
        EN: '💰 Payment Reminder',
        AR: '💰 تذكير بالدفع',
      },
      body: {
        EN: (data) => `Student: ${data.studentName}\nBalance: ${data.balance}\nAmount Remaining: ${data.amountRemaining}`,
        AR: (data) => `الطالب: ${data.studentName}\nالرصيد: ${data.balance}\nالمبلغ المتبقي: ${data.amountRemaining}`,
      },
    },
  },

  // ==================== Quiz/Grade Notifications ====================
  quiz: {
    result: {
      title: {
        EN: '📊 Quiz Results',
        AR: '📊 نتيجة الامتحان',
      },
      body: {
        EN: (data) => `Hello, parent of ${data.studentName}\nQuiz: ${data.quizName}\nGrade: ${data.grade}/${data.maxGrade}`,
        AR: (data) => `مرحباً ولي أمر الطالب ${data.studentName}\nنتيجة امتحان: ${data.quizName}\nالدرجة: ${data.grade}/${data.maxGrade}`,
      },
    },
  },

  // ==================== Registration Notification ====================
  registration: {
    welcome: {
      title: {
        EN: '🎉 Welcome to Mayada Academy',
        AR: '🎉 مرحباً بك في أكاديمية ميادة',
      },
      body: {
        EN: (data) => `Welcome to Mayada Academy!\nYour account has been created successfully.\n\nStudent Code: ${data.studentCode}\nStudent: ${data.studentName}\nGrade: ${data.grade}`,
        AR: (data) => `مرحباً بك في أكاديمية ميادة!\nتم إنشاء حسابك بنجاح.\n\nكود الطالب: ${data.studentCode}\nالطالب: ${data.studentName}\nالصف: ${data.grade}`,
      },
    },
  },

  // ==================== Block/Unblock Notifications ====================
  block: {
    blocked: {
      title: {
        EN: '🚫 Account Blocked',
        AR: '🚫 تم حظر الحساب',
      },
      body: {
        EN: (data) => `Student ${data.studentName}'s account has been blocked.\nReason: ${data.reason || 'Contact administration'}\n\nPlease contact the academy for more information.`,
        AR: (data) => `تم حظر حساب الطالب ${data.studentName}.\nالسبب: ${data.reason || 'تواصل مع الإدارة'}\n\nيرجى التواصل مع الأكاديمية للمزيد من المعلومات.`,
      },
    },
    unblocked: {
      title: {
        EN: '✅ Account Unblocked',
        AR: '✅ تم إلغاء الحظر',
      },
      body: {
        EN: (data) => `Student ${data.studentName}'s account has been unblocked.\nYou can now access all services.`,
        AR: (data) => `تم إلغاء حظر حساب الطالب ${data.studentName}.\nيمكنك الآن الوصول إلى جميع الخدمات.`,
      },
    },
  },

  // ==================== General/Custom Notifications ====================
  general: {
    default: {
      title: {
        EN: 'Mayada Academy',
        AR: 'أكاديمية ميادة',
      },
    },
  },

  // ==================== Warning Messages ====================
  warnings: {
    twoAbsences: {
      EN: 'The student has 2 absences and 1 remaining before suspension.',
      AR: 'الطالب لديه حالتين غياب ومتبقي حالة واحدة قبل الإيقاف.',
    },
    threeAbsences: {
      EN: 'The student has exceeded the allowed absences and may be suspended.',
      AR: 'الطالب تجاوز الحد المسموح من الغياب وقد يتم إيقافه.',
    },
  },
};

/**
 * Get notification text based on language
 * @param {string} category - Category (attendance, homework, etc.)
 * @param {string} type - Type within category (present, late, etc.)
 * @param {string} field - Field (title, body)
 * @param {string} language - Language code (EN/AR)
 * @param {object} data - Data for template substitution
 * @returns {string} - Translated text
 */
function getNotificationText(category, type, field, language = 'EN', data = {}) {
  const lang = ['EN', 'AR'].includes(language) ? language : 'EN';
  
  try {
    const template = translations[category]?.[type]?.[field]?.[lang];
    
    if (!template) {
      console.warn(`Translation not found: ${category}.${type}.${field}.${lang}`);
      return '';
    }
    
    if (typeof template === 'function') {
      return template(data);
    }
    
    return template;
  } catch (error) {
    console.error('Error getting notification text:', error);
    return '';
  }
}

/**
 * Get homework status line based on language
 * @param {string} status - Homework status (done, not_done, not_specified)
 * @param {string} language - Language code (EN/AR)
 * @returns {string} - Translated homework status line
 */
function getHomeworkStatusLine(status, language = 'EN') {
  const lang = ['EN', 'AR'].includes(language) ? language : 'EN';
  return translations.homework.status[status]?.[lang] || '';
}

/**
 * Get homework status label based on language
 * @param {string} status - Homework status (done, not_done, not_specified)
 * @param {string} language - Language code (EN/AR)
 * @returns {string} - Translated homework status label
 */
function getHomeworkStatusLabel(status, language = 'EN') {
  const lang = ['EN', 'AR'].includes(language) ? language : 'EN';
  return translations.homework.statusLabel[status]?.[lang] || '';
}

/**
 * Get warning message based on language
 * @param {string} type - Warning type (twoAbsences, threeAbsences)
 * @param {string} language - Language code (EN/AR)
 * @returns {string} - Translated warning message
 */
function getWarningMessage(type, language = 'EN') {
  const lang = ['EN', 'AR'].includes(language) ? language : 'EN';
  return translations.warnings[type]?.[lang] || '';
}

/**
 * Build attendance notification in the specified language
 * @param {string} type - Attendance type (present, late, absent)
 * @param {object} data - Notification data
 * @param {string} language - Language code (EN/AR)
 * @returns {object} - { title, body }
 */
function buildAttendanceNotification(type, data, language = 'EN') {
  const lang = ['EN', 'AR'].includes(language) ? language : 'EN';
  
  const title = getNotificationText('attendance', type, 'title', lang);
  const body = getNotificationText('attendance', type, 'body', lang, data);
  
  return { title, body };
}

/**
 * Build homework notification in the specified language
 * @param {object} data - Notification data { studentName, hwStatus, solvText }
 * @param {string} language - Language code (EN/AR)
 * @returns {object} - { title, body }
 */
function buildHomeworkNotification(data, language = 'EN') {
  const lang = ['EN', 'AR'].includes(language) ? language : 'EN';
  
  const title = getNotificationText('homework', 'notification', 'title', lang);
  const body = getNotificationText('homework', 'notification', 'body', lang, data);
  
  return { title, body };
}

/**
 * Build quiz result notification in the specified language
 * @param {object} data - Notification data { studentName, quizName, grade, maxGrade }
 * @param {string} language - Language code (EN/AR)
 * @returns {object} - { title, body }
 */
function buildQuizNotification(data, language = 'EN') {
  const lang = ['EN', 'AR'].includes(language) ? language : 'EN';
  
  const title = getNotificationText('quiz', 'result', 'title', lang);
  const body = getNotificationText('quiz', 'result', 'body', lang, data);
  
  return { title, body };
}

module.exports = {
  translations,
  getNotificationText,
  getHomeworkStatusLine,
  getHomeworkStatusLabel,
  getWarningMessage,
  buildAttendanceNotification,
  buildHomeworkNotification,
  buildQuizNotification,
};
