import test from "node:test";
import assert from "node:assert/strict";
import { File } from "node:buffer";
import * as XLSX from "xlsx";
import { createExcelImportValidationService } from "../../src/modules/import/excel-validation.ts";

const createXlsxFile = (rows: Array<Record<string, unknown>>, fileName = "dataset.xlsx") => {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
};

test("excel validation should detect missing fields, duplicate studentNo and illegal values for enrollment", async () => {
  const service = createExcelImportValidationService();

  const file = createXlsxFile([
    { studentNo: "S001", name: "Alice", score: 620, admissionYear: 2024 },
    { studentNo: "S002", name: "", score: 600, admissionYear: 2024 },
    { studentNo: "S001", name: "Repeat", score: 610, admissionYear: 2024 },
    { studentNo: "S004", name: "BadScore", score: 900, admissionYear: 2024 },
    { studentNo: "S005", name: "BadYear", score: 580, admissionYear: 1900 }
  ]);

  const result = await service.validateExcelImport({
    datasetType: "enrollment",
    file
  });

  assert.equal(result.total, 5);
  assert.equal(result.success, 1);
  assert.equal(result.failed, 4);
  assert.ok(result.errors.some((error) => error.field === "name" && error.reason === "missing required field"));
  assert.ok(result.errors.some((error) => error.field === "studentNo" && error.reason === "duplicate studentNo"));
  assert.ok(result.errors.some((error) => error.field === "score" && error.reason === "invalid value"));
  assert.ok(result.errors.some((error) => error.field === "admissionYear" && error.reason === "invalid value"));
});

test("excel validation should detect illegal employment status", async () => {
  const service = createExcelImportValidationService();

  const file = createXlsxFile([
    { studentNo: "E001", name: "Bob", status: "employed", salary: 6000 },
    { studentNo: "E002", name: "Tom", status: "unknown", salary: 4000 }
  ]);

  const result = await service.validateExcelImport({
    datasetType: "employment",
    file
  });

  assert.equal(result.total, 2);
  assert.equal(result.success, 1);
  assert.equal(result.failed, 1);
  assert.ok(result.errors.some((error) => error.field === "status" && error.reason === "invalid value"));
});
