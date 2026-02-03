declare module "@rodrigogs/mysql-events" {
  export const STATEMENTS: {
    ALL: "ALL";
    INSERT: "INSERT";
    UPDATE: "UPDATE";
    DELETE: "DELETE";
  };

  interface MySQLEventsOptions {
    startAtEnd?: boolean;
    excludedSchemas?: {
      mysql?: boolean;
      information_schema?: boolean;
      performance_schema?: boolean;
      sys?: boolean;
    };
  }

  interface ConnectionConfig {
    host?: string;
    user?: string;
    password?: string;
    port?: number;
  }

  interface AddTriggerOptions {
    name: string;
    expression: string;
    statement: "INSERT" | "UPDATE" | "DELETE" | "ALL";
    onEvent: (event: any) => void;
  }

  export default class MySQLEvents {
    constructor(connection: ConnectionConfig, options?: MySQLEventsOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    addTrigger(options: AddTriggerOptions): void;
  }
}
