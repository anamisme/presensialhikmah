/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
