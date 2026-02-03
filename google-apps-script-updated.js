const BACKEND_URL =
  "https://unsad-drearies-vernie.ngrok-free.dev/webhook/sheet";
const SCHEMA_CHANGE_URL =
  "https://unsad-drearies-vernie.ngrok-free.dev/webhook/schema-change";

// Script properties for storing last known header
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
const HEADER_KEY = "LAST_KNOWN_HEADER";

/**
 * MAIN TRIGGER FUNCTION
 */
function onChange(e) {
  if (!e || !e.source) return;

  const sheet = e.source.getActiveSheet();
  
  // Ignore changes to the migration lock cell (AA1)
  const range = sheet.getActiveRange();
  if (range && range.getA1Notation() === "AA1") {
    console.log("⏭️ Ignoring migration lock cell change");
    return;
  }

  // Check if migration is in progress - if so, skip processing
  if (isMigrationInProgress(sheet)) {
    console.log("⏸️ Migration in progress, skipping change event");
    return;
  }

  ensureSystemColumns(sheet);

  // Check if header row was edited (schema change)
  if (
    e.changeType === "EDIT" ||
    e.changeType === "INSERT_GRID" ||
    e.changeType === "REMOVE_GRID"
  ) {
    const range = sheet.getActiveRange();
    if (range && range.getRow() === 1) {
      console.log("Header row changed, checking schema...");
      checkAndNotifySchemaChange(sheet);
      return; // Don't process as data change
    }
  }

  const range = sheet.getActiveRange();
  if (!range) return;

  const validChangeTypes = ["EDIT", "INSERT_ROW", "PASTE"];
  if (!validChangeTypes.includes(e.changeType)) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idCol = headers.indexOf("id") + 1;
  const versionCol = headers.indexOf("version") + 1;
  const modifiedCol = headers.indexOf("last_modified_at") + 1;

  if (!idCol || !versionCol || !modifiedCol) return;

  const startRow = range.getRow();
  const numRows = range.getNumRows();

  for (let r = 0; r < numRows; r++) {
    const row = startRow + r;
    if (row === 1) continue;

    processRow(sheet, row, headers, idCol, versionCol, modifiedCol, range);
  }
}

/**
 * Process a single row change
 */
function processRow(
  sheet,
  row,
  headers,
  idCol,
  versionCol,
  modifiedCol,
  editedRange,
) {
  let rowId = sheet.getRange(row, idCol).getValue();
  const isInsert = !rowId || typeof rowId !== "string" || rowId.length < 10;

  if (isInsert) {
    rowId = Utilities.getUuid();
    sheet.getRange(row, idCol).setValue(rowId);
  }

  let version = parseInt(sheet.getRange(row, versionCol).getValue()) || 0;
  version += 1;

  const timestamp = new Date().toISOString();
  sheet.getRange(row, versionCol).setValue(version);
  sheet.getRange(row, modifiedCol).setValue(timestamp);

  const rowValues = sheet.getRange(row, 1, 1, headers.length).getValues()[0];

  const dataAfter = {};
  const changedFields = [];

  headers.forEach((header, i) => {
    // Exclude 'id', 'version', and 'last_modified_at' from dataAfter
    if (["id", "version", "last_modified_at"].includes(header)) return;

    let value = rowValues[i];
    if (value === "") value = null;

    dataAfter[header] = value;

    // Detect if this column was part of the edited range
    const colIndex = i + 1;
    if (
      editedRange.getRow() <= row &&
      editedRange.getLastRow() >= row &&
      editedRange.getColumn() <= colIndex &&
      editedRange.getLastColumn() >= colIndex
    ) {
      changedFields.push(header);
    }
  });

  // Validate that the data is not all empty/null before sending
  const hasValidData = Object.keys(dataAfter).some((key) => {
    const value = dataAfter[key];
    return value !== null && value !== "" && value !== 0;
  });

  if (!hasValidData && !isInsert) {
    console.log("⏭️ Skipping update - all data fields are empty/null/zero");
    return;
  }

  const payload = {
    eventId: Utilities.getUuid(),
    origin: "sheets",
    source: "sheets",
    table: sheet.getName().toLowerCase(),
    operation: isInsert ? "INSERT" : "UPDATE",
    rowId: rowId,
    version: version,
    timestamp: timestamp,
    dataBefore: null,
    dataAfter: dataAfter,
    changedFields: changedFields,
  };

  sendToBackend(payload);
}

/**
 * Check if the header has changed and notify the webhook
 */
function checkAndNotifySchemaChange(sheet) {
  try {
    // Get current header row (non-empty cells only)
    const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    const currentHeaders = headerRange
      .getValues()[0]
      .filter((cell) => cell !== "")
      .map((cell) => String(cell).trim());

    // Get last known header from properties
    const lastHeaderJson = SCRIPT_PROPERTIES.getProperty(HEADER_KEY);
    const lastHeaders = lastHeaderJson ? JSON.parse(lastHeaderJson) : null;

    // If this is the first time, just store it
    if (!lastHeaders) {
      console.log("First time setup - storing header");
      SCRIPT_PROPERTIES.setProperty(HEADER_KEY, JSON.stringify(currentHeaders));
      return;
    }

    // Check if headers have actually changed
    if (JSON.stringify(currentHeaders) === JSON.stringify(lastHeaders)) {
      console.log("No header changes detected");
      return;
    }

    console.log("Schema change detected!");
    console.log("Old headers: " + JSON.stringify(lastHeaders));
    console.log("New headers: " + JSON.stringify(currentHeaders));

    // Get sample data from first data row to help infer types
    const sampleData = {};
    if (sheet.getLastRow() > 1) {
      const dataRange = sheet.getRange(2, 1, 1, currentHeaders.length);
      const dataValues = dataRange.getValues()[0];

      currentHeaders.forEach((header, index) => {
        if (dataValues[index] !== "") {
          sampleData[header] = dataValues[index];
        }
      });
    }

    // Send notification to webhook
    const payload = {
      tableName: sheet.getName().toLowerCase(),
      newHeaders: currentHeaders,
      oldHeaders: lastHeaders,
      sampleData: sampleData,
      timestamp: new Date().toISOString(),
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    console.log("Sending schema change to webhook: " + SCHEMA_CHANGE_URL);
    const response = UrlFetchApp.fetch(SCHEMA_CHANGE_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    console.log("Webhook response: " + responseCode);
    console.log("Response body: " + responseText);

    if (responseCode === 200) {
      // Update stored header only if webhook succeeds
      SCRIPT_PROPERTIES.setProperty(HEADER_KEY, JSON.stringify(currentHeaders));

      // Show success message
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Database schema updated successfully!",
        "Schema Sync ✅",
        3,
      );
    } else {
      // Show error message
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "Failed to update database schema. Check logs.",
        "Schema Sync Error ❌",
        5,
      );
    }
  } catch (error) {
    console.error("Error in checkAndNotifySchemaChange: " + error.toString());
    SpreadsheetApp.getActiveSpreadsheet().toast(
      "Error syncing schema: " + error.toString(),
      "Schema Sync Error ❌",
      5,
    );
  }
}

/**
 * Check if a migration is currently in progress
 */
function isMigrationInProgress(sheet) {
  try {
    // Check the migration lock flag in column AA row 1
    const lockValue = sheet.getRange("AA1").getValue();
    return lockValue === "MIGRATING";
  } catch (error) {
    console.error("Error checking migration lock: " + error.toString());
    return false;
  }
}

/**
 * Ensures required system columns exist
 */
function ensureSystemColumns(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const required = ["id", "version", "last_modified_at"];

  let lastCol = headers.length;

  required.forEach((col) => {
    if (!headers.includes(col)) {
      lastCol++;
      sheet.getRange(1, lastCol).setValue(col);
    }
  });
}

/**
 * Sends payload to backend
 */
function sendToBackend(payload) {
  try {
    UrlFetchApp.fetch(BACKEND_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.error("Failed to send to backend", err);
  }
}

/**
 * Manual function to reset the stored header
 * Run this if you need to re-sync or reset the schema tracking
 */
function resetStoredHeader() {
  SCRIPT_PROPERTIES.deleteProperty(HEADER_KEY);
  console.log("Stored header reset");
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Schema tracking reset. Next header change will be treated as initial setup.",
    "Schema Sync Reset",
    3,
  );
}

/**
 * Manual function to force a schema sync check
 */
function forceSchemaSync() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  checkAndNotifySchemaChange(sheet);
}

/**
 * Manual function to initialize schema for the first time
 */
function initializeSchema() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  ensureSystemColumns(sheet);

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .filter((cell) => cell !== "")
    .map((cell) => String(cell).trim());

  SCRIPT_PROPERTIES.setProperty(HEADER_KEY, JSON.stringify(headers));

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Schema initialized with " + headers.length + " columns",
    "Schema Init ✅",
    3,
  );

  console.log("Initialized schema: " + JSON.stringify(headers));
}
