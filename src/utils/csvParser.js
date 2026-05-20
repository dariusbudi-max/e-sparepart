import { cleanKode, cleanQty, cleanText } from "./cleaner.js";

export const parseCSV = (text) => {
    return text
        .split(/\r?\n/)
        .filter(l => l.trim())
        .map((line, idx) => {
            const cols = line.split(/[\t;]+|\s{2,}/);

            return {
                row: idx + 1,
                kode: cleanKode(cols[0]),
                qty: cleanQty(cols[1]),
                jenis: cleanText(cols[2]),
                dept: String(cols[3] || '').trim().toUpperCase(),
                keterangan: String(cols[4] || '').trim()
            };
        });
};