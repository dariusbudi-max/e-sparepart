import { cleanKode } from "../utils/cleaner.js";

export const isStockInsufficient = (item, inventory, txType) => {
    if (txType !== 'KELUAR') return false;
    const invArray = Array.isArray(inventory) ? inventory : (inventory.value || []);
    const master = invArray.find(i => cleanKode(i.kode) === cleanKode(item.kode));
    if (!master) return false;
    return Number(item.qty || 0) > Number(master.stok || 0);
};

export const getMasterStock = (kode, inventory) => {
    const invArray = Array.isArray(inventory) ? inventory : (inventory.value || []);
    const item = invArray.find(i => cleanKode(i.kode) === cleanKode(kode));
    return item ? item.stok : 0;
};