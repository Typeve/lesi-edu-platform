import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MAX_CERTIFICATE_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const SUPPORTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "pdf", "doc", "docx"]);

export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface PersistCertificateFileInput {
  fileId: string;
  studentId: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: Date;
}

export interface CertificateFileRepository {
  createCertificateFile(input: PersistCertificateFileInput): Promise<void>;
}

export interface UploadCertificateInput {
  studentId: number;
  file?: UploadedFile | null;
}

export interface UploadCertificateResult {
  fileId: string;
}

export interface CertificateUploadService {
  uploadCertificate(input: UploadCertificateInput): Promise<UploadCertificateResult>;
}

export interface CreateCertificateUploadServiceInput {
  certificateFileRepo: CertificateFileRepository;
  uploadDir: string;
  maxSizeBytes?: number;
}

export class MissingUploadFileError extends Error {
  constructor() {
    super("file is required");
    this.name = "MissingUploadFileError";
  }
}

export class InvalidFileTypeError extends Error {
  constructor() {
    super("unsupported file type");
    this.name = "InvalidFileTypeError";
  }
}

export class FileTooLargeError extends Error {
  constructor() {
    super("file too large");
    this.name = "FileTooLargeError";
  }
}

const getFileExtension = (fileName: string): string | null => {
  const extension = path.extname(fileName).replace(".", "").trim().toLowerCase();
  return extension.length > 0 ? extension : null;
};

const ensureValidFile = (file: UploadedFile | null | undefined, maxSizeBytes: number): UploadedFile => {
  if (!file) {
    throw new MissingUploadFileError();
  }

  const extension = getFileExtension(file.name);
  if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
    throw new InvalidFileTypeError();
  }

  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > maxSizeBytes) {
    throw new FileTooLargeError();
  }

  return file;
};

const createFileId = (): string => {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  return `cert_${Date.now()}_${suffix}`;
};

export const createCertificateUploadService = ({
  certificateFileRepo,
  uploadDir,
  maxSizeBytes = DEFAULT_MAX_CERTIFICATE_FILE_SIZE_BYTES
}: CreateCertificateUploadServiceInput): CertificateUploadService => {
  return {
    async uploadCertificate({ studentId, file }: UploadCertificateInput): Promise<UploadCertificateResult> {
      const validatedFile = ensureValidFile(file, maxSizeBytes);
      const extension = getFileExtension(validatedFile.name) as string;
      const fileId = createFileId();

      await mkdir(uploadDir, { recursive: true });

      const storedFileName = `${fileId}.${extension}`;
      const storagePath = path.join(uploadDir, storedFileName);
      let writtenToDisk = false;

      try {
        const buffer = Buffer.from(await validatedFile.arrayBuffer());
        await writeFile(storagePath, buffer);
        writtenToDisk = true;

        await certificateFileRepo.createCertificateFile({
          fileId,
          studentId,
          originalName: validatedFile.name,
          mimeType: validatedFile.type,
          sizeBytes: validatedFile.size,
          storagePath,
          createdAt: new Date()
        });

        return { fileId };
      } catch (error) {
        if (writtenToDisk) {
          await unlink(storagePath).catch(() => undefined);
        }

        throw error;
      }
    }
  };
};
