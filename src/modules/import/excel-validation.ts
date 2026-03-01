import path from "node:path";
import * as XLSX from "xlsx";

export type ImportDatasetType = "enrollment" | "employment";

export interface UploadedExcelFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ExcelImportValidationError {
  row: number;
  field: string;
  reason: "missing required field" | "duplicate studentNo" | "invalid value";
}

export interface ExcelImportValidationResult {
  total: number;
  success: number;
  failed: number;
  errors: ExcelImportValidationError[];
}

export interface ValidateExcelImportInput {
  datasetType: ImportDatasetType;
  file?: UploadedExcelFile | null;
}

export interface ExcelImportValidationService {
  validateExcelImport(input: ValidateExcelImportInput): Promise<ExcelImportValidationResult>;
}

export class MissingImportFileError extends Error {
  constructor() {
    super("file is required");
    this.name = "MissingImportFileError";
  }
}

export class UnsupportedExcelFileTypeError extends Error {
  constructor() {
    super("unsupported file type");
    this.name = "UnsupportedExcelFileTypeError";
  }
}

const EMPLOYMENT_STATUS_SET = new Set(["employed", "unemployed", "further_study", "civil_service"]);

const REQUIRED_FIELDS: Record<ImportDatasetType, Array<string>> = {
  enrollment: ["studentNo", "name", "score", "admissionYear"],
  employment: ["studentNo", "name", "status", "salary"]
};

const isBlank = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  return false;
};

const resolveString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
};

const resolveNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = resolveString(value);
  if (!text) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const ensureXlsxFile = (file: UploadedExcelFile | null | undefined): UploadedExcelFile => {
  if (!file) {
    throw new MissingImportFileError();
  }

  const extension = path.extname(file.name).toLowerCase();
  if (extension !== ".xlsx") {
    throw new UnsupportedExcelFileTypeError();
  }

  return file;
};

const parseSheetRows = async (file: UploadedExcelFile): Promise<Array<Record<string, unknown>>> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: ""
  });
};

const validateRows = (
  datasetType: ImportDatasetType,
  rows: Array<Record<string, unknown>>
): ExcelImportValidationResult => {
  const errors: ExcelImportValidationError[] = [];
  const seenStudentNo = new Set<string>();
  const failedRows = new Set<number>();

  const requiredFields = REQUIRED_FIELDS[datasetType];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    for (const field of requiredFields) {
      if (isBlank(row[field])) {
        errors.push({
          row: rowNumber,
          field,
          reason: "missing required field"
        });
        failedRows.add(rowNumber);
      }
    }

    const studentNo = resolveString(row.studentNo);
    if (studentNo) {
      if (seenStudentNo.has(studentNo)) {
        errors.push({
          row: rowNumber,
          field: "studentNo",
          reason: "duplicate studentNo"
        });
        failedRows.add(rowNumber);
      } else {
        seenStudentNo.add(studentNo);
      }
    }

    if (datasetType === "enrollment") {
      const score = resolveNumber(row.score);
      if (score === null || score < 0 || score > 750) {
        errors.push({
          row: rowNumber,
          field: "score",
          reason: "invalid value"
        });
        failedRows.add(rowNumber);
      }

      const admissionYear = resolveNumber(row.admissionYear);
      if (
        admissionYear === null ||
        !Number.isInteger(admissionYear) ||
        admissionYear < 2000 ||
        admissionYear > 2100
      ) {
        errors.push({
          row: rowNumber,
          field: "admissionYear",
          reason: "invalid value"
        });
        failedRows.add(rowNumber);
      }
    }

    if (datasetType === "employment") {
      const status = resolveString(row.status);
      if (!EMPLOYMENT_STATUS_SET.has(status)) {
        errors.push({
          row: rowNumber,
          field: "status",
          reason: "invalid value"
        });
        failedRows.add(rowNumber);
      }

      const salary = resolveNumber(row.salary);
      if (salary === null || salary < 0) {
        errors.push({
          row: rowNumber,
          field: "salary",
          reason: "invalid value"
        });
        failedRows.add(rowNumber);
      }
    }
  });

  const total = rows.length;
  const failed = failedRows.size;

  return {
    total,
    success: total - failed,
    failed,
    errors
  };
};

export const createExcelImportValidationService = (): ExcelImportValidationService => {
  return {
    async validateExcelImport({ datasetType, file }: ValidateExcelImportInput): Promise<ExcelImportValidationResult> {
      const validatedFile = ensureXlsxFile(file);
      const rows = await parseSheetRows(validatedFile);
      return validateRows(datasetType, rows);
    }
  };
};
