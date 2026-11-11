/**
 * License Management Engine
 * Handles verification, hardware device activation/deactivation, and order-verified key claiming.
 */

import { Env, LicenseRecord } from './types';
import { issueLicenseForOrder, createDownloadTokenForOrder } from './db';

export async function verifyLicenseKey(
  db: D1Database,
  licenseKey: string
): Promise<{
  valid: boolean;
  active: boolean;
  message?: string;
  license?: LicenseRecord;
  activeDevices?: number;
  maxDevices?: number;
}> {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return { valid: false, active: false, message: 'Invalid license key format.' };
  }

  const cleanKey = licenseKey.trim().toUpperCase();
  const license = await db
    .prepare('SELECT * FROM licenses WHERE license_key = ?')
    .bind(cleanKey)
    .first<LicenseRecord>();

  if (!license) {
    return { valid: false, active: false, message: 'License key does not exist.' };
  }

  if (!license.is_active) {
    return {
      valid: true,
      active: false,
      message: license.revocation_reason || 'License key has been revoked.',
    };
  }

  // Count active devices
  const activeCountRow = await db
    .prepare('SELECT count(*) as count FROM license_activations WHERE license_key = ? AND is_active = 1')
    .bind(cleanKey)
    .first<{ count: number }>();

  const activeDevices = activeCountRow ? activeCountRow.count : 0;

  return {
    valid: true,
    active: true,
    license,
    activeDevices,
    maxDevices: license.max_devices,
  };
}

export async function activateDevice(
  db: D1Database,
  params: {
    licenseKey: string;
    machineId: string;
    machineName?: string;
    os?: string;
    appVersion?: string;
  }
): Promise<{
  success: boolean;
  code?: string;
  message: string;
  activeDevices?: number;
  maxDevices?: number;
  activatedAt?: string;
}> {
  const { licenseKey, machineId, machineName, os, appVersion } = params;

  if (!licenseKey || !machineId) {
    return {
      success: false,
      code: 'MISSING_PARAMS',
      message: 'Both licenseKey and machineId are required for device activation.',
    };
  }

  const cleanKey = licenseKey.trim().toUpperCase();
  const cleanMachineId = machineId.trim();

  // Verify license existence and active state
  const verification = await verifyLicenseKey(db, cleanKey);
  if (!verification.valid || !verification.active || !verification.license) {
    return {
      success: false,
      code: 'INVALID_LICENSE',
      message: verification.message || 'License key is invalid or inactive.',
    };
  }

  const license = verification.license;
  const maxDevices = license.max_devices;

  // Check if this machine is ALREADY active on this key
  const existingActivation = await db
    .prepare('SELECT id, is_active FROM license_activations WHERE license_key = ? AND machine_id = ? AND is_active = 1')
    .bind(cleanKey, cleanMachineId)
    .first<{ id: string; is_active: number }>();

  if (existingActivation) {
    await db
      .prepare('UPDATE license_activations SET activated_at = datetime(\'now\') WHERE id = ?')
      .bind(existingActivation.id)
      .run();

    return {
      success: true,
      code: 'ALREADY_ACTIVE',
      message: 'Device is already activated on this license.',
      activeDevices: verification.activeDevices,
      maxDevices,
      activatedAt: new Date().toISOString(),
    };
  }

  // Count current active devices
  const currentCount = verification.activeDevices || 0;
  if (currentCount >= maxDevices) {
    return {
      success: false,
      code: 'DEVICE_LIMIT_REACHED',
      message: `Maximum allowed devices (${maxDevices} PC commercial limit) already active. Please deactivate an old machine first or contact support.`,
      activeDevices: currentCount,
      maxDevices,
    };
  }

  // Insert new active device record
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO license_activations (
        id, license_key, machine_id, machine_name, os, app_version, is_active, activated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
    )
    .bind(id, cleanKey, cleanMachineId, machineName || 'PC / Workstation', os || 'Desktop', appVersion || 'After Effects', now)
    .run();

  return {
    success: true,
    code: 'ACTIVATED',
    message: `Machine successfully activated (${currentCount + 1}/${maxDevices} devices active).`,
    activeDevices: currentCount + 1,
    maxDevices,
    activatedAt: now,
  };
}

export async function deactivateDevice(
  db: D1Database,
  params: {
    licenseKey: string;
    machineId: string;
  }
): Promise<{
  success: boolean;
  code?: string;
  message: string;
  remainingActiveDevices?: number;
  maxDevices?: number;
}> {
  const { licenseKey, machineId } = params;

  if (!licenseKey || !machineId) {
    return {
      success: false,
      code: 'MISSING_PARAMS',
      message: 'Both licenseKey and machineId are required for deactivation.',
    };
  }

  const cleanKey = licenseKey.trim().toUpperCase();
  const cleanMachineId = machineId.trim();

  // Check if device is active
  const activation = await db
    .prepare('SELECT id FROM license_activations WHERE license_key = ? AND machine_id = ? AND is_active = 1')
    .bind(cleanKey, cleanMachineId)
    .first<{ id: string }>();

  if (!activation) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: 'Device is not currently active on this license.',
    };
  }

  // Deactivate
  await db
    .prepare('UPDATE license_activations SET is_active = 0, deactivated_at = datetime(\'now\') WHERE id = ?')
    .bind(activation.id)
    .run();

  // Count remaining active devices
  const remainingRow = await db
    .prepare('SELECT count(*) as count FROM license_activations WHERE license_key = ? AND is_active = 1')
    .bind(cleanKey)
    .first<{ count: number }>();

  return {
    success: true,
    code: 'DEACTIVATED',
    message: 'Device deactivated successfully. Activation slot freed for a new machine.',
    remainingActiveDevices: remainingRow ? remainingRow.count : 0,
    maxDevices: 2,
  };
}

export async function claimLicenseByOrder(
  db: D1Database,
  host: string,
  params: {
    orderId: string;
    email: string;
  }
): Promise<{
  success: boolean;
  code?: string;
  message: string;
  orderId?: string;
  licenseKey?: string;
  productName?: string;
  customerName?: string;
  maxDevices?: number;
  downloadUrl?: string;
}> {
  const { orderId, email } = params;

  if (!orderId || !email) {
    return {
      success: false,
      code: 'MISSING_PARAMS',
      message: 'Both Order ID and Buyer Email are required.',
    };
  }

  const cleanOrderId = orderId.trim();
  const cleanEmail = email.trim().toLowerCase();

  // Query order joined with customer and product
  const record = await db
    .prepare(
      `SELECT 
        o.id as order_uuid, o.order_id, o.status as order_status, o.customer_id, o.product_id,
        c.email as customer_email, c.full_name as customer_name,
        p.name as product_name, p.r2_object_key, p.has_license, p.max_devices
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN products p ON o.product_id = p.id
       WHERE o.order_id = ?`
    )
    .bind(cleanOrderId)
    .first<{
      order_uuid: string;
      order_id: string;
      order_status: string;
      customer_id: string;
      product_id: string;
      customer_email: string;
      customer_name: string;
      product_name: string;
      r2_object_key: string | null;
      has_license: number;
      max_devices: number;
    }>();

  if (!record) {
    return {
      success: false,
      code: 'ORDER_NOT_FOUND',
      message: 'No order found matching this Order ID. Please check your receipt or contact support.',
    };
  }

  if (record.order_status !== 'PAID') {
    return {
      success: false,
      code: 'PAYMENT_PENDING',
      message: `Order status is ${record.order_status}. A verified paid order is required to claim a license.`,
    };
  }

  if (record.customer_email.toLowerCase() !== cleanEmail) {
    return {
      success: false,
      code: 'EMAIL_MISMATCH',
      message: 'The email provided does not match the billing email registered for this order.',
    };
  }

  // Retrieve or issue license
  let licenseKey = 'N/A';
  if (record.has_license) {
    const lic = await issueLicenseForOrder(db, record.order_id, record.customer_id, record.product_id);
    licenseKey = lic.license_key;
  }

  // Retrieve or create download token
  let downloadUrl = `https://${host}/updates.html`;
  if (record.r2_object_key) {
    const tok = await createDownloadTokenForOrder(db, record.order_id, record.r2_object_key);
    downloadUrl = `https://${host}/api/download/${tok.token}`;
  }

  return {
    success: true,
    code: 'CLAIMED',
    message: 'Order verified successfully. License key issued.',
    orderId: record.order_id,
    licenseKey,
    productName: record.product_name,
    customerName: record.customer_name,
    maxDevices: record.max_devices || 2,
    downloadUrl,
  };
}
