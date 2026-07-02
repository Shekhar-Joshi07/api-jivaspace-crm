import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const uploadDirectory = path.resolve(currentDirectory, '../../uploads');
mkdirSync(uploadDirectory, { recursive: true });

const safeFileName = fileName => path
  .basename(fileName)
  .replace(/[^a-zA-Z0-9._-]/g, '-')
  .slice(-120);

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${uniquePrefix}-${safeFileName(file.originalname)}`);
  }
});

const fileFilter = (_req, file, callback) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    return callback(new ApiError(415, 'Unsupported file type'));
  }
  return callback(null, true);
};

export const uploadFile = multer({
  storage,
  fileFilter,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024, files: 1 }
});

export const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(extension)) {
      return callback(new ApiError(415, 'Upload an XLSX, XLS, or CSV file'));
    }
    return callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});
