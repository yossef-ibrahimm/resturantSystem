declare namespace Express {
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    active: boolean;
  }
}