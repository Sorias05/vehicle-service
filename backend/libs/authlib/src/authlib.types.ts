export interface AuthenticatedUser {
  id: number;
}

export interface ValidateSessionResponse {
  authenticated: boolean;
  userId?: string;
}
