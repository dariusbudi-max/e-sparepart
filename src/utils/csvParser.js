import { cleanKode, cleanQty, cleanText } from "./cleaner.js";

export const parseCSV = (text) => {
    return text
        .split(/\r?\n/)
        .filter(line => line.trim())
        .map((line, idx) => {
            const cols = line.split(/[\t;]+|\s{2,}/);
            return {
                row: idx + 1,
                kode: cleanKode(cols[0]),
                qty: cleanQty(cols[1]),
                jenis: cleanText(cols[2]),
                dept: cleanText(cols[3]),
                keterangan: cleanText(cols[4])
            };
        });
};