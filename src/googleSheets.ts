/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Target spreadsheet for auto-sync attendance data
const ATTENDANCE_SPREADSHEET_ID = '1y2LsZUg56C5pDMA-V2lzHmfv3TBjT_HCes0960RcSnQ';

/**
 * Appends a single attendance record row to the shared spreadsheet.
 * Called automatically every time a user checks in/out.
 */
export async function appendAttendanceToSheet(
  record: {
    tanggal: string;
    nip: string;
    nama: string;
    masuk: string;
    keluar?: string;
    status: string;
    lokasi?: string;
    keterangan?: string;
  },
  accessToken: string
): Promise<boolean> {
  try {
    const row = [
      record.tanggal,
      record.nip,
      record.nama,
      record.masuk,
      record.keluar || '',
      record.status,
      record.lokasi || '',
      record.keterangan || '',
      new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) // timestamp sync
    ];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ATTENDANCE_SPREADSHEET_ID}/values/Sheet1!A:I:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      console.error('Gagal sync ke Spreadsheet:', errorData.error?.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error append to sheet:', err);
    return false;
  }
}

/**
 * Updates an existing row (for checkout) by finding matching date+NIP and updating keluar column.
 * Uses a search-then-update approach.
 */
export async function updateAttendanceCheckout(
  nip: string,
  tanggal: string,
  keluar: string,
  accessToken: string
): Promise<boolean> {
  try {
    // 1. Read all data to find the row
    const readRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ATTENDANCE_SPREADSHEET_ID}/values/Sheet1!A:I`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!readRes.ok) return false;

    const data = await readRes.json();
    const rows = data.values || [];

    // 2. Find the row with matching tanggal (col A) and NIP (col B) where keluar (col E) is empty
    let targetRow = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === tanggal && rows[i][1] === nip && (!rows[i][4] || rows[i][4] === '')) {
        targetRow = i + 1; // Sheets is 1-indexed
        break;
      }
    }

    if (targetRow === -1) {
      console.warn('Row not found for checkout update, appending instead.');
      return false;
    }

    // 3. Update the keluar column (E) and timestamp (I)
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ATTENDANCE_SPREADSHEET_ID}/values/Sheet1!E${targetRow}:I${targetRow}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[keluar, '', '', '', new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })]],
        }),
      }
    );

    return updateRes.ok;
  } catch (err) {
    console.error('Error updating checkout:', err);
    return false;
  }
}

/**
 * Ensures the spreadsheet has proper headers on first row.
 * Call once on app init or when admin sets up.
 */
export async function ensureSheetHeaders(accessToken: string): Promise<void> {
  try {
    // Check if first row has headers
    const readRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ATTENDANCE_SPREADSHEET_ID}/values/Sheet1!A1:I1`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!readRes.ok) return;

    const data = await readRes.json();
    const firstRow = data.values?.[0];

    // If no headers, write them
    if (!firstRow || firstRow[0] !== 'Tanggal') {
      const headers = ['Tanggal', 'NIP', 'Nama', 'Masuk', 'Keluar', 'Status', 'Lokasi', 'Keterangan', 'Timestamp Sync'];
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${ATTENDANCE_SPREADSHEET_ID}/values/Sheet1!A1:I1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [headers] }),
        }
      );
    }
  } catch (err) {
    console.error('Error ensuring headers:', err);
  }
}

/**
 * Creates a new Google Sheet and populates it with headers and row data.
 * Applies clean styling to the header row and auto-resizes columns.
 */
export async function createAndPopulateSpreadsheet(
  title: string,
  headers: string[],
  rows: any[][],
  accessToken: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Create the spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title,
      },
    }),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json();
    throw new Error(errorData.error?.message || 'Gagal membuat spreadsheet baru');
  }

  const spreadsheet = await createRes.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const spreadsheetUrl = spreadsheet.spreadsheetUrl;

  // 2. Write the data
  const data = [headers, ...rows];
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: 'Sheet1!A1',
        majorDimension: 'ROWS',
        values: data,
      }),
    }
  );

  if (!writeRes.ok) {
    const errorData = await writeRes.json();
    throw new Error(errorData.error?.message || 'Gagal menulis data ke spreadsheet');
  }

  // 3. Format the spreadsheet beautifully via batchUpdate
  try {
    const batchUpdateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            // Format header row
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: headers.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.0,
                      green: 0.35,
                      blue: 0.74, // #0058bc
                    },
                    textFormat: {
                      foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                      bold: true,
                      fontSize: 11,
                    },
                    alignment: 'CENTER',
                    verticalAlignment: 'MIDDLE',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,alignment,verticalAlignment)',
              },
            },
            // Enable borders for the entire populated range
            {
              updateBorders: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: data.length,
                  startColumnIndex: 0,
                  endColumnIndex: headers.length,
                },
                top: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                bottom: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                left: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                right: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
                innerHorizontal: { style: 'SOLID', width: 1, color: { red: 0.9, green: 0.9, blue: 0.9 } },
                innerVertical: { style: 'SOLID', width: 1, color: { red: 0.9, green: 0.9, blue: 0.9 } },
              },
            },
            // Align data cells
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 1,
                  endRowIndex: data.length,
                  startColumnIndex: 0,
                  endColumnIndex: headers.length,
                },
                cell: {
                  userEnteredFormat: {
                    verticalAlignment: 'MIDDLE',
                  },
                },
                fields: 'userEnteredFormat(verticalAlignment)',
              },
            },
            // Auto resize column widths to prevent cut off values
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: 0,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: headers.length,
                },
              },
            },
          ],
        }),
      }
    );

    if (!batchUpdateRes.ok) {
      console.warn('Formatting was not fully applied, but data was saved successfully.');
    }
  } catch (fmtError) {
    console.error('Failed to apply formatting:', fmtError);
  }

  return { spreadsheetId, spreadsheetUrl };
}
