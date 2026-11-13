/**
 * Cloudflare R2 Admin Upload Manager
 * Streams extension zips, preview images, and assets directly into the private R2 bucket.
 */

import { Env } from './types';

export async function handleAdminR2Upload(
  request: Request,
  env: Env
): Promise<{
  success: boolean;
  objectKey: string;
  sizeBytes: number;
  contentType: string;
}> {
  const contentType = request.headers.get('content-type') || '';

  // 1. Multipart Form Data Upload
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    const folder = (formData.get('folder') as string) || 'uploads';
    const customKey = formData.get('objectKey') as string | null;

    if (!file || typeof file === 'string') {
      throw new Error('No valid file found in multipart upload.');
    }

    const uploadFile = file as File;
    const sanitizedFilename = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = customKey ? customKey.trim() : `${folder.replace(/\/+$/, '')}/${Date.now()}_${sanitizedFilename}`;

    const arrayBuffer = await uploadFile.arrayBuffer();

    await env.PRODUCTS_BUCKET.put(objectKey, arrayBuffer, {
      httpMetadata: {
        contentType: uploadFile.type || 'application/octet-stream',
      },
    });

    return {
      success: true,
      objectKey,
      sizeBytes: arrayBuffer.byteLength,
      contentType: uploadFile.type || 'application/octet-stream',
    };
  }

  // 2. Direct Binary Stream Upload (via X-Filename / X-Folder headers)
  const headerFilename = request.headers.get('x-filename') || `upload_${Date.now()}.bin`;
  const headerFolder = request.headers.get('x-folder') || 'uploads';
  const customKey = request.headers.get('x-object-key');

  const sanitizedFilename = headerFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectKey = customKey ? customKey.trim() : `${headerFolder.replace(/\/+$/, '')}/${Date.now()}_${sanitizedFilename}`;

  const arrayBuffer = await request.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('Upload body is empty.');
  }

  const mimeType = request.headers.get('content-type') || 'application/octet-stream';

  await env.PRODUCTS_BUCKET.put(objectKey, arrayBuffer, {
    httpMetadata: {
      contentType: mimeType,
    },
  });

  return {
    success: true,
    objectKey,
    sizeBytes: arrayBuffer.byteLength,
    contentType: mimeType,
  };
}
