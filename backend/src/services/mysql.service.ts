import { pool } from "../config/database";
import { UserRecord } from "../types";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export interface ColumnInfo {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: any;
  Extra: string;
}

export class MySQLService {
  async getUserById(id: string): Promise<UserRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM users WHERE id = ?",
      [id],
    );
    return rows.length > 0 ? (rows[0] as UserRecord) : null;
  }

  async createUser(
    id: string,
    data: {
      name: string;
      age: number;
      version: number;
      source: string;
    },
  ): Promise<string> {
    await pool.query<ResultSetHeader>(
      `INSERT INTO users (id, name, age, version, source, last_modified_at) 
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, data.name, data.age, data.version, data.source],
    );
    return id;
  }

  async updateUser(
    id: string,
    data: { name: string; age: number; version: number; source: string },
  ): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE users 
       SET name = ?, age = ?, version = ?, source = ?, last_modified_at = NOW() 
       WHERE id = ?`,
      [data.name, data.age, data.version, data.source, id],
    );
    return result.affectedRows > 0;
  }

  async deleteUser(id: string): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM users WHERE id = ?",
      [id],
    );
    return result.affectedRows > 0;
  }

  async createUserDynamic(
    tableName: string,
    id: string,
    data: Record<string, any>,
    version: number,
    source: string,
  ): Promise<string> {
    // Get all columns except system columns that are auto-managed
    const columns = [
      "id",
      ...Object.keys(data),
      "version",
      "source",
      "last_modified_at",
    ];
    const values = [id, ...Object.values(data), version, source, new Date()];

    const placeholders = columns.map(() => "?").join(", ");
    const columnNames = columns.join(", ");

    await pool.query<ResultSetHeader>(
      `INSERT INTO ?? (${columnNames}) VALUES (${placeholders})`,
      [tableName, ...values],
    );
    return id;
  }

  async updateUserDynamic(
    tableName: string,
    id: string,
    data: Record<string, any>,
    version: number,
    source: string,
  ): Promise<boolean> {
    const updateFields = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(data), version, source, id];

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE ?? SET ${updateFields}, version = ?, source = ?, last_modified_at = NOW() WHERE id = ?`,
      [tableName, ...values],
    );
    return result.affectedRows > 0;
  }

  async getUserByVersion(
    id: string,
    version: number,
  ): Promise<UserRecord | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM users WHERE id = ? AND version = ?",
      [id, version],
    );
    return rows.length > 0 ? (rows[0] as UserRecord) : null;
  }

  async getTableSchema(tableName: string): Promise<string[]> {
    const [columns] = await pool.query<RowDataPacket[]>("DESCRIBE ??", [
      tableName,
    ]);
    return (columns as ColumnInfo[]).map((col) => col.Field);
  }

  async getTableSchemaDetails(tableName: string): Promise<ColumnInfo[]> {
    const [columns] = await pool.query<RowDataPacket[]>("DESCRIBE ??", [
      tableName,
    ]);
    return columns as ColumnInfo[];
  }

  inferMySQLType(sampleValue: any): string {
    if (
      sampleValue === null ||
      sampleValue === undefined ||
      sampleValue === ""
    ) {
      return "VARCHAR(255)";
    }

    // Check if it's a number
    const num = Number(sampleValue);
    if (!isNaN(num)) {
      // Check if integer
      if (Number.isInteger(num)) {
        return "INT";
      }
      return "DECIMAL(10,2)";
    }

    // Check if it's a date
    const date = new Date(sampleValue);
    if (
      !isNaN(date.getTime()) &&
      typeof sampleValue === "string" &&
      sampleValue.match(/\d{4}-\d{2}-\d{2}/)
    ) {
      return "DATETIME";
    }

    // Check if it's boolean
    if (
      sampleValue === "true" ||
      sampleValue === "false" ||
      typeof sampleValue === "boolean"
    ) {
      return "BOOLEAN";
    }

    // Default to VARCHAR with appropriate length
    const length = String(sampleValue).length;
    if (length > 255) {
      return "TEXT";
    }
    return "VARCHAR(255)";
  }

  async addColumn(
    tableName: string,
    columnName: string,
    columnType: string = "VARCHAR(255)",
  ): Promise<void> {
    console.log(
      `➕ Adding column '${columnName}' (${columnType}) to table '${tableName}'`,
    );

    // Sanitize column name to be MySQL-safe
    const safeColumnName = columnName
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .toLowerCase();

    await pool.query(`ALTER TABLE ?? ADD COLUMN ?? ${columnType} NULL`, [
      tableName,
      safeColumnName,
    ]);

    console.log(`✅ Column '${safeColumnName}' added successfully`);
  }

  async dropColumn(tableName: string, columnName: string): Promise<void> {
    console.log(`➖ Dropping column '${columnName}' from table '${tableName}'`);

    // Don't allow dropping critical columns
    const protectedColumns = ["id", "version", "source", "last_modified_at"];
    if (protectedColumns.includes(columnName.toLowerCase())) {
      console.warn(`⚠️ Cannot drop protected column '${columnName}'`);
      throw new Error(`Cannot drop protected column: ${columnName}`);
    }

    await pool.query(`ALTER TABLE ?? DROP COLUMN ??`, [tableName, columnName]);

    console.log(`✅ Column '${columnName}' dropped successfully`);
  }

  async renameColumn(
    tableName: string,
    oldColumnName: string,
    newColumnName: string,
  ): Promise<void> {
    console.log(
      `🔄 Renaming column '${oldColumnName}' to '${newColumnName}' in table '${tableName}'`,
    );

    // Get the column definition first
    const [columns] = await pool.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM ?? WHERE Field = ?",
      [tableName, oldColumnName],
    );

    if (columns.length === 0) {
      throw new Error(
        `Column '${oldColumnName}' not found in table '${tableName}'`,
      );
    }

    const columnInfo = columns[0] as any;
    const columnType = columnInfo.Type;
    const nullable = columnInfo.Null === "YES" ? "NULL" : "NOT NULL";
    const defaultValue = columnInfo.Default
      ? `DEFAULT '${columnInfo.Default}'`
      : "";

    // Sanitize new column name
    const safeNewColumnName = newColumnName
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .toLowerCase();

    await pool.query(
      `ALTER TABLE ?? CHANGE COLUMN ?? ?? ${columnType} ${nullable} ${defaultValue}`,
      [tableName, oldColumnName, safeNewColumnName],
    );

    console.log(`✅ Column renamed successfully to '${safeNewColumnName}'`);
  }
}

export const mysqlService = new MySQLService();
