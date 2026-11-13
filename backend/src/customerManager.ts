/**
 * Customer Management Engine
 * Aggregates customer profiles, lifetime order values, commercial license ownership, and active devices.
 */

export interface AdminCustomerSummary {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  totalOrders: number;
  paidOrders: number;
  totalSpentInr: number;
  totalSpentUsd: number;
  activeLicensesCount: number;
  createdAt: string;
}

export async function listAdminCustomers(
  db: D1Database,
  limit: number = 50,
  offset: number = 0,
  searchQuery?: string
): Promise<{
  customers: AdminCustomerSummary[];
  totalCount: number;
}> {
  let countSql = 'SELECT COUNT(*) as count FROM customers';
  let querySql = `
    SELECT 
      c.id, c.email, c.full_name, c.phone, c.created_at,
      COUNT(DISTINCT o.id) as total_orders,
      COUNT(DISTINCT CASE WHEN o.status = 'PAID' THEN o.id END) as paid_orders,
      COALESCE(SUM(CASE WHEN o.status = 'PAID' AND o.currency = 'INR' THEN o.final_amount_inr ELSE 0 END), 0) as total_spent_inr,
      COALESCE(SUM(CASE WHEN o.status = 'PAID' AND o.currency = 'USD' THEN o.final_amount_inr ELSE 0 END), 0) as total_spent_usd,
      COUNT(DISTINCT CASE WHEN l.is_active = 1 THEN l.id END) as active_licenses_count
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id
    LEFT JOIN licenses l ON c.id = l.customer_id
  `;

  const params: any[] = [];
  if (searchQuery && searchQuery.trim()) {
    const term = `%${searchQuery.trim().toLowerCase()}%`;
    const filter = ' WHERE LOWER(c.email) LIKE ? OR LOWER(c.full_name) LIKE ? OR c.phone LIKE ?';
    countSql += filter;
    querySql += filter;
    params.push(term, term, term);
  }

  querySql += ' GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?';

  const totalRow = await (params.length > 0
    ? db.prepare(countSql).bind(...params).first<{ count: number }>()
    : db.prepare(countSql).first<{ count: number }>());

  const rows = await db
    .prepare(querySql)
    .bind(...params, limit, offset)
    .all<{
      id: string;
      email: string;
      full_name: string;
      phone: string | null;
      created_at: string;
      total_orders: number;
      paid_orders: number;
      total_spent_inr: number;
      total_spent_usd: number;
      active_licenses_count: number;
    }>();

  const customers: AdminCustomerSummary[] = (rows.results || []).map(r => ({
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    phone: r.phone,
    totalOrders: r.total_orders,
    paidOrders: r.paid_orders,
    totalSpentInr: Number((r.total_spent_inr / 100).toFixed(2)),
    totalSpentUsd: Number((r.total_spent_usd / 100).toFixed(2)),
    activeLicensesCount: r.active_licenses_count,
    createdAt: r.created_at,
  }));

  return {
    customers,
    totalCount: totalRow ? totalRow.count : 0,
  };
}

export async function getAdminCustomerDetail(
  db: D1Database,
  customerId: string
): Promise<{
  customer: any;
  orders: any[];
  licenses: any[];
  activations: any[];
} | null> {
  const customer = await db
    .prepare('SELECT * FROM customers WHERE id = ?')
    .bind(customerId)
    .first<any>();

  if (!customer) return null;

  // Orders
  const orders = await db
    .prepare(
      `SELECT o.*, p.name as product_name
       FROM orders o
       LEFT JOIN products p ON o.product_id = p.id
       WHERE o.customer_id = ?
       ORDER BY o.created_at DESC`
    )
    .bind(customerId)
    .all<any>();

  const ordersList = orders.results || [];
  const paidOrders = ordersList.filter((o: any) => o.status === 'PAID');
  const totalSpentInr = paidOrders
    .filter((o: any) => o.currency === 'INR' || !o.currency)
    .reduce((acc: number, o: any) => acc + (o.final_amount_inr || 0), 0) / 100;
  const totalSpentUsd = paidOrders
    .filter((o: any) => o.currency === 'USD')
    .reduce((acc: number, o: any) => acc + (o.final_amount_inr || 0), 0) / 100;

  // Licenses
  const licenses = await db
    .prepare(
      `SELECT l.*, p.name as product_name
       FROM licenses l
       LEFT JOIN products p ON l.product_id = p.id
       WHERE l.customer_id = ?
       ORDER BY l.created_at DESC`
    )
    .bind(customerId)
    .all<any>();

  const licensesList = licenses.results || [];

  // Device Activations across customer licenses
  const activations = await db
    .prepare(
      `SELECT a.*, l.license_key
       FROM license_activations a
       JOIN licenses l ON a.license_key = l.license_key
       WHERE l.customer_id = ?
       ORDER BY a.activated_at DESC`
    )
    .bind(customerId)
    .all<any>();

  return {
    customer: {
      ...customer,
      totalOrders: ordersList.length,
      paidOrders: paidOrders.length,
      totalSpentInr: Number(totalSpentInr.toFixed(2)),
      totalSpentUsd: Number(totalSpentUsd.toFixed(2)),
      activeLicensesCount: licensesList.filter((l: any) => l.is_active === 1).length,
    },
    orders: ordersList,
    licenses: licensesList,
    activations: activations.results || [],
  };
}
