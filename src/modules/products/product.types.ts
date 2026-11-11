export interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  mrp: number;
  currentSellingPrice: number;
  size: string;
  color: string;
  stock: number;
  imageUrl?: string | null;
  storeId: string;
  createdAt?: string;
  updatedAt?: string;
  store?: {
    id: string;
    name: string;
    address: string;
  } | null;
}

