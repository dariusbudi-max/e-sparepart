import { cleanKode } from "./cleaner.js";
import { searchInventory } from "../services/inventoryService.js";

export const validateRows = async (rows, inventory) => {
    const invArray = Array.isArray(inventory) ? inventory : (inventory?.value || []);
    const map = new Map(invArray.map((i) => [cleanKode(i.kode), i]));
    const validated = [];

    for (const row of rows) {
        const cleanedTarget = cleanKode(row.kode);
        let item = map.get(cleanedTarget);

        if (!item) {
            try {
                const results = await searchInventory(cleanedTarget, false);
                item = results.find((i) => cleanKode(i.kode) === cleanedTarget);

                if (item) {
                    map.set(cleanedTarget, item);
                }
            } catch (err) {
                console.error("Server validation error:", err);
            }
        }

        let error = null;

        if (!row.kode) {
            error = "Kode kosong";
        } else if (!item) {
            error = `Kode [${row.kode}] tidak terdaftar`;
        } else if (item.status !== "AKTIF") {
            error = "Barang NONAKTIF";
        } else if (isNaN(row.qty) || row.qty === null) {
            error = "Qty tidak valid";
        } else if (row.qty <= 0 && row.jenis !== "OPNAME") {
            error = "Qty harus > 0";
        } else if (!["MASUK", "KELUAR", "OPNAME", "RETURN"].includes(row.jenis)) {
            error = "Jenis tidak valid";
        } else if (row.jenis === "KELUAR" && Number(row.qty) > Number(item.stok)) {
            error = `Stok tidak cukup (Sisa: ${item.stok})`;
        } else if (row.jenis === "OPNAME" && Number(row.qty) === Number(item.stok)) {
            error = "Data Opname sama dengan stok saat ini";
        } else if (row.jenis !== "OPNAME" && !row.dept) {
            error = "Dept kosong";
        }

        validated.push({
            ...row,
            valid: !error,
            error
        });
    }

    return validated;
};

