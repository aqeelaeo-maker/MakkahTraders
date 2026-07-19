export type Role = 'admin' | 'accountant' | 'viewer';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface SubUser {
  id: string; // 'user1' or 'user2'
  username: string;
  password?: string;
  role: 'owner' | 'staff';
}

export interface CompanyProfile {
  id?: string;
  userId?: string;
  name: string;
  companyCode?: string;
  logoUrl?: string;
  ntn: string;
  strn: string;
  address: string;
  phone: string;
  phone2?: string;
  email: string;
  website: string;
  bankDetails: string;
  printOnLetterPad?: boolean;
  headerLength?: number;
  subUsers?: SubUser[];
}

export interface Customer {
  id: string;
  userId?: string;
  name: string;
  customerId: string;
  isSchool?: boolean;
  emisCode?: string;
  customerType?: 'school' | 'college' | 'health_unit' | 'other';
  institutionCode?: string;
  healthUnitCode?: string;
  ntn: string;
  strn: string;
  phone: string;
  email: string;
  address: string;
  city: string;
}

export interface Product {
  id: string;
  userId?: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: number;
  salePrice: number;
  taxPercentage: number;
  currentStock: number;
  minimumStock: number;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  taxPercentage: number;
  total: number;
  tax: number;
  grandTotal: number;
}

export interface Invoice {
  id: string;
  userId?: string;
  invoiceNumber: string;
  date: number; // timestamp
  customerId: string;
  customerName: string;
  customerType?: 'school' | 'college' | 'health_unit' | 'other';
  customerNtn?: string;
  customerStrn?: string;
  customerEmisCode?: string;
  customerInstitutionCode?: string;
  customerHealthUnitCode?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  netTotal: number;
  createdBy: string;
  status: 'Draft' | 'Paid' | 'Unpaid' | 'Cancelled';
  fbrStatus?: 'Pending' | 'Submitted' | 'Failed';
  fbrInvoiceNo?: string;
  fbrResponse?: any;
}

export interface StockTransaction {
  id: string;
  userId?: string;
  productId: string;
  type: 'In' | 'Out';
  qty: number;
  date: number;
  reference: string; // Invoice number or Purchase Order
  remarks?: string;
}
