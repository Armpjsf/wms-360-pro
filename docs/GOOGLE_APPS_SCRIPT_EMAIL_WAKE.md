# Google Apps Script Email Wake

Use this Apps Script as a lightweight Gmail watcher. It checks for unread order
emails and wakes the WMS automation endpoint only when a matching email exists.
When no matching email is found, it exits silently and does not send warning
emails.

## Script Properties

In Apps Script, open **Project Settings** > **Script Properties** and add:

```text
WMS_AUTOMATION_URL=https://YOUR-APP.vercel.app/api/cron/email-orders
CRON_SECRET=the-same-value-used-in-vercel
```

## Apps Script

```javascript
function checkOrderEmailAndWakeWms() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;

  try {
    const query = 'is:unread from:formica.com has:attachment';
    const threads = GmailApp.search(query, 0, 1);

    if (threads.length === 0) {
      return;
    }

    const props = PropertiesService.getScriptProperties();
    const lastWake = Number(props.getProperty('LAST_WAKE_AT') || '0');
    const now = Date.now();

    // Avoid repeated wake calls while Gmail/Vercel/Sheets are still processing.
    if (now - lastWake < 60 * 1000) {
      return;
    }

    const url = props.getProperty('WMS_AUTOMATION_URL');
    const cronSecret = props.getProperty('CRON_SECRET');

    if (!url || !cronSecret) {
      console.error('Missing WMS_AUTOMATION_URL or CRON_SECRET script property.');
      return;
    }

    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + cronSecret,
      },
    });

    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      props.setProperty('LAST_WAKE_AT', String(now));
      console.log('WMS automation wake sent successfully.');
      return;
    }

    console.error('WMS automation wake failed: ' + code + ' ' + response.getContentText());
  } finally {
    lock.releaseLock();
  }
}
```

## Trigger Setup

1. In Apps Script, open **Triggers**.
2. Add a trigger for `checkOrderEmailAndWakeWms`.
3. Event source: **Time-driven**.
4. Type: **Minutes timer**.
5. Interval: **Every minute**.

The `/api/cron/email-orders` endpoint is intentionally callable by Apps Script
even when it is not listed in `vercel.json`. Vercel Hobby projects only support
daily cron schedules, so Apps Script is the fast wake-up path for this workflow.

