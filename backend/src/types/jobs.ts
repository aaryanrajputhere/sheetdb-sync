export interface UserRecord {
  id: string;
  name: string;
  age: number;
  version: number;
  source: "sheet" | "db" | "manual";
  last_modified_at: Date | string;
}

export interface DbToSheetJobData {
  action: "insert" | "update" | "delete";
  source: "db";
  table: string;
  recordId: string;
  data: {
    name: string;
    age: number;
  };
  version: number;
  lastModifiedAt: Date | string;
}

export interface SheetToDbJobData {
  action: "insert" | "update" | "delete";
  source: "sheet";
  rowId: string;
  data: {
    id?: string;
    name: string;
    age: number;
  };
  version: number;
  lastModifiedAt: Date | string;
}
