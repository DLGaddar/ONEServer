export interface ServerTable {
  id: string;
  nickname: string;
  ip: string;
  port: number;
  username: string;
  password: string | null;
  keyPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseSchema {
  servers: ServerTable;
}
