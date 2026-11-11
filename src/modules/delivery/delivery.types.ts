export interface DeliveryOrder {
  id: string;
  status: string;
  totalAmount: number;
  deliveryAddress: string;
  deliveryPhone?: string | null;
  deliveryEmail?: string | null;
  customerId: string;
  storeId: string;
  deliveryPartnerId?: string | null;
  createdAt: string;
  items?: any[];
  store?: any;
  customer?: any;
}

