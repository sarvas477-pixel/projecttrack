
import { google } from 'googleapis';
import path from 'node:path';

const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE
  ? path.resolve(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE)
  : '';

const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

export type SheetRow = {
  responseKey: string;
  submittedAt?: string;
  rowReference: string;
  values: Record<string, string | undefined>;
};

export async function readRegistrationSheet(
  spreadsheetId: string,
  worksheetName?: string,
): Promise<SheetRow[]> {
  if (!keyFile) {
    throw new Error('Google service-account key path is not configured.');
  }

  if (!spreadsheetId.trim()) {
    throw new Error('Spreadsheet ID is missing.');
  }

  const range = worksheetName
    ? `'${worksheetName.replace(/'/g, "''")}'!A:Z`
    : 'A:Z';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const rows = response.data.values ?? [];

  if (rows.length === 0) {
    throw new Error('The response worksheet has no header row.');
  }

  const headers = rows[0].map((header) =>
    String(header ?? '').trim(),
  );

  if (headers.every((header) => !header)) {
    throw new Error('The response worksheet has a blank header row.');
  }

  return rows.slice(1).flatMap((row, index) => {
    const values: Record<string, string | undefined> = {};

    headers.forEach((header, columnIndex) => {
      if (header) {
        values[header] = String(row[columnIndex] ?? '').trim();
      }
    });

    if (Object.values(values).every((value) => !value)) {
      return [];
    }

    const timestamp = values.Timestamp;

    return [{
      responseKey: `row-${index + 2}`,
      submittedAt: timestamp || undefined,
      rowReference: `Row ${index + 2}`,
      values,
    }];
  });
}

