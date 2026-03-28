#!/usr/bin/env node
/**
 * Advansys SMS debug — matches portal: ForwardBulkSMS uses PhoneNumbers + Message;
 * ForwardSMS uses one-to-one flat JSON. RequestID: random 5 digits (see generateAdvansysRequestId).
 *
 * Usage (from project root):
 *   node script/testAdvansysSms.js 201055200152
 *   node script/testAdvansysSms.js 01055200152 --dashboard
 *   node script/testAdvansysSms.js 01012345678 --try-array
 *   node script/testAdvansysSms.js 01012345678 --all-endpoints
 *   node script/testAdvansysSms.js 01012345678 --forward-only
 *   node script/testAdvansysSms.js 01012345678 --bulk-only
 *
 * Requires .env: SMS_API_TOKEN, SMS_SENDER_NAME
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

process.env.SMS_ENABLED = 'true';

const axios = require('axios');
const sms = require('../utils/sms');

const URL_HUBAPI_BULK =
  'https://hubapi.advansystelecom.com/api/bulkSMS/ForwardBulkSMS';
const URL_HUBAPI_FORWARD =
  'https://hubapi.advansystelecom.com/api/bulkSMS/ForwardSMS';
const URL_LEGACY_PDF_FORWARD =
  'https://hub.advansystelecom.com/generalapiv12/api/bulkSMS/ForwardSMS';

function parseArgs(argv) {
  const args = {
    phone: null,
    tryArray: false,
    forwardOnly: false,
    bulkOnly: false,
    allEndpoints: false,
    dashboard: false,
  };
  for (const a of argv) {
    if (a === '--try-array') args.tryArray = true;
    else if (a === '--forward-only') args.forwardOnly = true;
    else if (a === '--bulk-only') args.bulkOnly = true;
    else if (a === '--all-endpoints') args.allEndpoints = true;
    else if (a === '--dashboard') args.dashboard = true;
    else if (!a.startsWith('-') && /^\d/.test(a)) args.phone = a;
  }
  return args;
}

function printOperatorInfo(intl) {
  const inf = sms.inferOperatorId(intl);
  const res = sms.resolveOperatorId(intl);
  console.log('International:', intl);
  console.log(
    'Carrier code (2 digits after 20):',
    intl.slice(2, 4),
    '→ operatorId:',
    inf.operatorId,
    'prefix3:',
    intl.slice(2, 5),
  );
  console.log('Resolved:', res.operatorId, '(' + res.source + ')');
  console.log(
    'Egypt: 010→Vodafone(1), 011→Etisalat(3), 012→Orange(2), 015→WE(7)',
  );
}

async function postAttempt(label, url, body) {
  const token = sms.getSmsToken();
  const sender = sms.getSenderName();
  console.log('\n==========', label, '==========');
  console.log('URL:', url);
  console.log('SenderName:', sender || '(missing)');
  console.log('Body:', JSON.stringify(body, null, 2));

  if (!token) {
    console.error('ERROR: SMS_API_TOKEN / ADVANSYS_SMS_TOKEN not set in .env');
    return;
  }

  try {
    const res = await axios.post(url, body, {
      headers: {
        Authorization: token,
        'Content-Type': 'application/json; charset=utf-8',
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    const parsed = sms.parseSmsResponseCode(res.data);
    const transportOk = sms.isSmsTransportOk(res.status, parsed.code);
    console.log('HTTP:', res.status, res.statusText);
    console.log('Response data:', JSON.stringify(res.data));

    console.log('Parsed code:', parsed.code);
    console.log('isSmsApiSuccess(code):', sms.isSmsApiSuccess(parsed.code));
    console.log('isSmsTransportOk(status, code):', transportOk);
    console.log(
      'Overall OK (transport + API code):',
      transportOk && sms.isSmsApiSuccess(parsed.code),
    );

    if (!transportOk) {
      console.warn('→ HTTP status and body do not indicate acceptance.');
    } else if (!sms.isSmsApiSuccess(parsed.code)) {
      console.warn('→ Transport OK but API Message/code is not success.');
    } else {
      console.log('→ API reports success (handset delivery is separate).');
    }
  } catch (err) {
    console.error('Axios error message:', err.message);
    if (err.response) {
      console.error('HTTP:', err.response.status, err.response.statusText);
      console.error(
        'Body:',
        typeof err.response.data === 'object'
          ? JSON.stringify(err.response.data)
          : err.response.data,
      );
    }
  }
}

function buildBulkMessagesBody(base) {
  const msg = sms.truncateMessage(String(base.message));
  return {
    SenderName: base.senderName,
    BulkMessages: [
      {
        PhoneNumber: base.intl,
        Message: msg,
        RequestID: String(base.requestId),
        OperatorID: base.operatorId,
      },
    ],
  };
}

async function runDashboardFlow(basePayload) {
  const ridBulk = sms.generateAdvansysRequestId();
  const ridForward = sms.generateAdvansysRequestId();

  console.log('\n--- Portal-style: 5-digit RequestIDs ---');
  console.log('ForwardBulkSMS RequestID:', ridBulk);
  console.log('ForwardSMS RequestID:', ridForward);

  await postAttempt(
    'DASHBOARD: ForwardBulkSMS (PhoneNumbers + Message)',
    URL_HUBAPI_BULK,
    sms.buildSmsApiBody({
      ...basePayload,
      requestId: ridBulk,
      format: 'phoneNumbers',
    }),
  );

  await postAttempt(
    'DASHBOARD: ForwardSMS one-to-one (flat + OperatorID)',
    URL_HUBAPI_FORWARD,
    sms.buildSmsApiBody({
      ...basePayload,
      requestId: ridForward,
      format: 'flat',
    }),
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const { phone, tryArray, forwardOnly, bulkOnly, allEndpoints, dashboard } =
    parseArgs(argv);

  if (!phone) {
    console.error(
      'Usage: node script/testAdvansysSms.js <phone> [--dashboard] [--try-array] [--all-endpoints] [--forward-only] [--bulk-only]',
    );
    process.exit(1);
  }

  const norm = sms.normalizeEgyptInternational(phone);
  if (!norm.ok) {
    console.error('Bad phone:', norm.error);
    process.exit(1);
  }
  const intl = norm.international;

  const senderName = sms.getSenderName();
  const requestId = sms.generateAdvansysRequestId();
  const message =
    'Mayada Academy SMS test ' + new Date().toISOString().slice(0, 19);

  const resolved = sms.resolveOperatorId(intl);
  const operatorId = resolved.operatorId;
  if (!operatorId) {
    console.error(
      'Could not resolve OperatorID. Set SMS_DEFAULT_OPERATOR_ID in .env',
    );
    process.exit(1);
  }

  console.log('=== Advansys SMS debug ===');
  console.log('Primary (production default):', URL_HUBAPI_BULK);
  console.log('Fallback (one-to-one):', URL_HUBAPI_FORWARD);
  console.log('Legacy PDF host:', URL_LEGACY_PDF_FORWARD);
  printOperatorInfo(intl);

  const basePayload = {
    intl,
    message,
    senderName,
    requestId,
    operatorId,
  };

  if (forwardOnly) {
    await postAttempt(
      'hubapi ForwardSMS (flat)',
      URL_HUBAPI_FORWARD,
      sms.buildSmsApiBody({ ...basePayload, format: 'flat' }),
    );
    return;
  }

  if (
    dashboard ||
    (!allEndpoints && !tryArray && !bulkOnly && !forwardOnly)
  ) {
    await runDashboardFlow(basePayload);
    if (!allEndpoints && !tryArray) {
      console.log(
        '\nTip: negative account balance blocks real delivery. Use --all-endpoints for legacy body probes.',
      );
      return;
    }
  }

  if (allEndpoints) {
    const rid1 = sms.generateAdvansysRequestId();
    await postAttempt(
      'MAIN: hubapi ForwardBulkSMS (phoneNumbers — portal)',
      URL_HUBAPI_BULK,
      sms.buildSmsApiBody({
        ...basePayload,
        requestId: rid1,
        format: 'phoneNumbers',
      }),
    );
    await postAttempt(
      'hubapi ForwardBulkSMS (flat legacy)',
      URL_HUBAPI_BULK,
      sms.buildSmsApiBody({ ...basePayload, format: 'flat' }),
    );
    await postAttempt(
      'hubapi ForwardBulkSMS (Messages[])',
      URL_HUBAPI_BULK,
      sms.buildSmsApiBody({ ...basePayload, format: 'messages' }),
    );
    await postAttempt(
      'hubapi ForwardBulkSMS (BulkMessages[])',
      URL_HUBAPI_BULK,
      buildBulkMessagesBody(basePayload),
    );
    await postAttempt(
      'hubapi ForwardSMS (flat)',
      URL_HUBAPI_FORWARD,
      sms.buildSmsApiBody({ ...basePayload, format: 'flat' }),
    );
    await postAttempt(
      'LEGACY PDF: generalapiv12 ForwardSMS (flat)',
      URL_LEGACY_PDF_FORWARD,
      sms.buildSmsApiBody({ ...basePayload, format: 'flat' }),
    );
    console.log('\nDone.');
    return;
  }

  if (!dashboard) {
    await postAttempt(
      'ForwardBulkSMS (phoneNumbers) — main',
      URL_HUBAPI_BULK,
      sms.buildSmsApiBody({ ...basePayload, format: 'phoneNumbers' }),
    );
  }

  if (tryArray) {
    await postAttempt(
      'ForwardBulkSMS (Messages[] wrapper)',
      URL_HUBAPI_BULK,
      sms.buildSmsApiBody({ ...basePayload, format: 'messages' }),
    );
    await postAttempt(
      'ForwardBulkSMS (BulkMessages[])',
      URL_HUBAPI_BULK,
      buildBulkMessagesBody(basePayload),
    );
  }

  if (!bulkOnly && !dashboard) {
    await postAttempt(
      'ForwardSMS hubapi (flat)',
      URL_HUBAPI_FORWARD,
      sms.buildSmsApiBody({ ...basePayload, format: 'flat' }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
