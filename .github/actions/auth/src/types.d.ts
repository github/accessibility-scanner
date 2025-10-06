export type Cookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
};

export type LocalStorage = {
  [origin: string]: {
    [key: string]: string;
  };
};

export type AuthContextOutput = {
  username?: string;
  password?: string;
  cookies?: Cookie[];
  localStorage?: LocalStorage;
};
