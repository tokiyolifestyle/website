/**
 * TOKIYO LIFESTYLE — Google Apps Script for Automated Form Data Collection
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open Google Sheets (https://sheets.new)
 * 2. Name your spreadsheet: "Tokiyo Lifestyle — Form Responses & Applications"
 * 3. In the top menu, click: Extensions -> Apps Script
 * 4. Delete any code in the editor and PASTE this entire script.
 * 5. Click "Save" (Floppy icon)
 * 6. Click "Deploy" (blue button at top right) -> "New deployment"
 * 7. Click the Gear icon (Select type) -> "Web app"
 * 8. Set the following options:
 *    - Description: "Tokiyo Website Forms Receiver"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone" (VERY IMPORTANT)
 * 9. Click "Deploy", authorize permissions when prompted.
 * 10. Copy the "Web app URL" (looks like: https://script.google.com/macros/s/AKfy.../exec)
 * 11. Paste this URL into Shopify Admin -> Online Store -> Themes -> Customize -> Theme settings -> Google Sheets Integration.
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = data.sheet_tab || getSheetNameByFormType(data.form_type);
    var sheet = ss.getSheetByName(sheetName);

    // If sheet tab doesn't exist, create it with headers
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      setupHeaders(sheet, data.form_type);
    }

    // Append row based on form type
    var rowData = formatRowData(data);
    sheet.appendRow(rowData);

    // Format row styling
    sheet.autoResizeColumns(1, rowData.length);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", message: "Data appended to " + sheetName }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "active", message: "Tokiyo Lifestyle Webhook Receiver is LIVE" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetNameByFormType(type) {
  switch (type) {
    case 'partner_application': return 'Partner_Applications';
    case 'b2b_inquiry': return 'B2B_Inquiries';
    case 'contact_message': return 'Contact_Messages';
    case 'newsletter': return 'Newsletter_Subscribers';
    default: return 'All_Submissions';
  }
}

function setupHeaders(sheet, formType) {
  var headers = [];

  if (formType === 'partner_application') {
    headers = [
      'Timestamp (IST)',
      'Brand / Business Name',
      'Category',
      'Contact Person',
      'Phone / WhatsApp',
      'Email',
      'City & Area',
      'Proposed VIP Offer / Discount',
      'Social / Website Link',
      'Message / Notes',
      'Page URL'
    ];
  } else if (formType === 'b2b_inquiry') {
    headers = [
      'Timestamp (IST)',
      'Contact Name',
      'Company Name',
      'Email',
      'Phone / WhatsApp',
      'Expected Quantity',
      'Styles / Requirements',
      'Message'
    ];
  } else if (formType === 'contact_message') {
    headers = [
      'Timestamp (IST)',
      'Customer Name',
      'Email',
      'Phone',
      'Message'
    ];
  } else if (formType === 'newsletter') {
    headers = [
      'Timestamp (IST)',
      'Subscriber Email',
      'Signup Source'
    ];
  } else {
    headers = ['Timestamp (IST)', 'Form Type', 'Raw Data'];
  }

  sheet.appendRow(headers);

  // Style header row (Dark theme with bold text)
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#111111');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
}

function formatRowData(data) {
  var ts = data.timestamp || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  if (data.form_type === 'partner_application') {
    return [
      ts,
      data.brand_name || '',
      data.category || '',
      data.contact_person || '',
      data.phone || '',
      data.email || '',
      data.location || '',
      data.vip_offer || '',
      data.social_link || '',
      data.message || '',
      data.page_url || ''
    ];
  } else if (data.form_type === 'b2b_inquiry') {
    return [
      ts,
      data.name || '',
      data.company || '',
      data.email || '',
      data.phone || '',
      data.quantity || '',
      data.styles || '',
      data.message || ''
    ];
  } else if (data.form_type === 'contact_message') {
    return [
      ts,
      data.name || '',
      data.email || '',
      data.phone || '',
      data.message || ''
    ];
  } else if (data.form_type === 'newsletter') {
    return [
      ts,
      data.email || '',
      data.source || 'Website'
    ];
  }

  return [ts, data.form_type || 'Unknown', JSON.stringify(data)];
}
