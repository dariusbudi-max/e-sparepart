import { cleanKode, cleanText } from "./cleaner.js";
import { searchInventory } from "../services/inventoryService.js";

const ALLOWED_JENIS = ["MASUK", "KELUAR", "OPNAME", "RETURN"];

export const validateRows = async (rows, inventory) => {
    const invArray = Array.isArray(inventory) ? inventory : (inventory?.value || []);

    const inventoryMap = new Map(
        invArray.map((item) => [cleanKode(item.kode), item])
    );

    const virtualStockMap = new Map(
        invArray.map((item) => [cleanKode(item.kode), Number(item.stok ?? 0)])
    );

    const validated = [];

    for (const row of rows) {
        const cleanedTarget = cleanKode(row.kode);
        let item = inventoryMap.get(cleanedTarget);

        if (!item && cleanedTarget) {
            try {
                const { data = [] } = await searchInventory(cleanedTarget);

                item = data.find(
                    (i) => cleanKode(i.kode) === cleanedTarget
                );

                if (item) {
                    inventoryMap.set(cleanedTarget, item);

                    if (!virtualStockMap.has(cleanedTarget)) {
                        virtualStockMap.set(
                            cleanedTarget,
                            Number(item.stok ?? 0)
                        );
                    }
                }
            } catch (err) {
                console.error(
                    `Server validation error for kode ${cleanedTarget}:`,
                    err
                );
            }
        }

        const inputQty = Number(row.qty);
        const currentVirtualStock = virtualStockMap.get(cleanedTarget) ?? 0;
        let error = null;

        if (!cleanedTarget) {
            error = "Kode kosong";
        } else if (!item) {
            error = `Kode [${row.kode}] tidak terdaftar`;
        } else if (
            String(item.status || "")
                .trim()
                .toUpperCase() !== "AKTIF"
        ) {
            error = "Barang NONAKTIF";
        } else if (!Number.isFinite(inputQty)) {
            error = "Qty tidak valid";
        } else if (row.jenis !== "OPNAME" && inputQty <= 0) {
            error = "Qty harus > 0";
        } else if (!ALLOWED_JENIS.includes(row.jenis)) {
            error = "Jenis tidak valid";
        } else if (row.jenis !== "OPNAME" && !String(row.dept || "").trim()) {
            error = "Dept kosong";
        } else if (row.jenis === "KELUAR" && inputQty > currentVirtualStock) {
            error = `Stok tidak cukup (Sisa internal: ${currentVirtualStock})`;
        } else if (row.jenis === "OPNAME" && inputQty < 0) {
            error = "Qty opname tidak boleh minus";
        }

        if (!error) {
            switch (row.jenis) {
                case "MASUK":
                case "RETURN":
                    virtualStockMap.set(cleanedTarget, currentVirtualStock + inputQty);
                    break;
                case "KELUAR":
                    virtualStockMap.set(cleanedTarget, currentVirtualStock - inputQty);
                    break;
                case "OPNAME":
                    virtualStockMap.set(cleanedTarget, inputQty);
                    break;
            }
        }

        validated.push({
            ...row,
            qty: Number.isFinite(inputQty) ? inputQty : row.qty,
            valid: !error,
            error,
            currentStock: currentVirtualStock,
            nextStock: !error ? virtualStockMap.get(cleanedTarget) : currentVirtualStock,
            status: !error ? "VALID" : "ERROR",
            failedKode: error ? cleanedTarget : null
        });
    }

    return validated;
};
