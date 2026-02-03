import { mysqlService } from "../services/mysql.service";
import { sheetsService } from "../services/sheets.service";

export async function initializeSheetHeader(tableName: string = "users") {
  console.log(`🚀 Initializing Google Sheets header for table: ${tableName}`);

  try {
    // Get table schema from MySQL
    const columns = await mysqlService.getTableSchema(tableName);
    console.log(`📋 Table columns:`, columns);

    // Update the header row in Google Sheets
    await sheetsService.updateHeaderRow(columns);

    console.log(`✅ Google Sheets header initialized successfully`);
  } catch (error) {
    console.error(`❌ Failed to initialize Google Sheets header:`, error);
    throw error;
  }
}
