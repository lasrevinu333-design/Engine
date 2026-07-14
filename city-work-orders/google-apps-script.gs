/**
 * Memphis Zoo City Work Order Queue — Gmail Draft Connector
 *
 * Deploy this script from the dedicated Gmail account Jennifer will use.
 * The Supabase Edge Function calls this Web App server-to-server. The shared
 * secret never appears in the public browser application.
 */

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'Memphis Zoo City Work Order Gmail Draft Connector',
    version: '1.0.0'
  });
}

function doPost(event) {
  try {
    const payload = JSON.parse((event && event.postData && event.postData.contents) || '{}');
    const expectedSecret = PropertiesService.getScriptProperties().getProperty('CITY_WO_SECRET') || '';

    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse_({ ok: false, error: 'Unauthorized connector request.' });
    }

    if (payload.action !== 'createDraft') {
      return jsonResponse_({ ok: false, error: 'Unknown connector action.' });
    }

    const to = clean_(payload.to, 500);
    const cc = clean_(payload.cc, 1000);
    const subject = clean_(payload.subject, 500);
    const bodyText = clean_(payload.bodyText, 100000);
    const bodyHtml = String(payload.bodyHtml || '').slice(0, 500000);

    if (!to || !subject || !bodyText) {
      return jsonResponse_({ ok: false, error: 'Recipient, subject, and body are required.' });
    }

    const attachments = [];
    const sourceAttachments = Array.isArray(payload.attachments) ? payload.attachments.slice(0, 25) : [];

    sourceAttachments.forEach(function(item) {
      const url = clean_(item && item.url, 3000);
      const name = clean_(item && item.name, 240) || 'work-order-file';
      if (!url) return;

      const response = UrlFetchApp.fetch(url, {
        method: 'get',
        followRedirects: true,
        muteHttpExceptions: true
      });

      const code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        attachments.push(response.getBlob().setName(name));
      }
    });

    const options = {
      htmlBody: bodyHtml || undefined,
      attachments: attachments
    };
    if (cc) options.cc = cc;

    const draft = GmailApp.createDraft(to, subject, bodyText, options);
    const draftId = draft.getId();

    return jsonResponse_({
      ok: true,
      draftId: draftId,
      draftUrl: 'https://mail.google.com/mail/u/0/#drafts',
      attachmentCount: attachments.length,
      batchCode: clean_(payload.batchCode, 120)
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function clean_(value, maximumLength) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, maximumLength || 10000);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
