export interface DashboardSummary {
  totalActiveStores: number;
  totalSalesVolume: number;
  totalOrders: number;
  ordersByStatus: Record<string, number>;
  productsSummary: {
    totalProducts: number;
    totalStockUnits: number;
  };
  usersByRole: Array<{ role: string; count: number }>;
  orders: any[];
}

