export type RoleType = 'SUPER_ADMIN' | 'PRINCIPAL' | 'ACCOUNTANT' | 'ADMISSION_STAFF' | 'STAFF';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'ALUMNI' | 'SUSPENDED' | 'WITHDRAWN';
export type FeeStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' | 'WAIVED';
export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE';
export type PaymentStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type FeeFrequency = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface UserPayload {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: RoleType;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errorCode?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
