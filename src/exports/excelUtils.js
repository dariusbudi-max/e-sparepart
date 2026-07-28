import * as XLSX from "https://cdn.jsdelivr.net/npm/xlsx/+esm";

export const getTimestamp = () =>
    new Date().toLocaleDateString("id-ID").replace(/\//g, "-");

export const createWorkbook = (sheet, sheetName, fileName) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, sheetName);
    XLSX.writeFile(wb, fileName);
};

export { XLSX };