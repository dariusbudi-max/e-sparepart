import { PERMISSION } from "./permissions.js";

export const PAGE_PERMISSION = Object.freeze({
    dashboard: PERMISSION.DASHBOARD,
    analytics: PERMISSION.ANALYTICS,
    transaksi: PERMISSION.TRANSAKSI,
    inventory: PERMISSION.INVENTORY,
    reservasi: PERMISSION.RESERVASI,
    catalog_menu: PERMISSION.CATALOG,
    scrap_monitoring: PERMISSION.SCRAP,
    spp: PERMISSION.SPP,
    master_barang: PERMISSION.MASTER_BARANG,
    cancel_tx: PERMISSION.CANCEL_TX,
    user_management: PERMISSION.USER_MANAGEMENT,
    print_barcode: PERMISSION.PRINT_BARCODE,
});

export function canAccessPage(page, can) {
    const permission = PAGE_PERMISSION[page];
    if (!permission) return false;
    return can(permission);
}
