const { computed } = Vue;
import { PERMISSION } from "../constants/permissions.js";

const ROLE_PERMISSIONS = {
    ADMIN: ["*"],
    MANAGER: [
        PERMISSION.DASHBOARD,
        PERMISSION.ANALYTICS,
        PERMISSION.INVENTORY,
        PERMISSION.RESERVASI,
        PERMISSION.CATALOG,
        PERMISSION.SCRAP,
        PERMISSION.SCRAP_EDIT,
        PERMISSION.SCRAP_DELETE,
        PERMISSION.SPP,
        PERMISSION.CANCEL_TX,
        PERMISSION.VIEW_STOCK,
        PERMISSION.EXPORT_EXCEL
    ],
    STAFF: [
        PERMISSION.DASHBOARD,
        PERMISSION.TRANSAKSI,
        PERMISSION.INVENTORY,
        PERMISSION.RESERVASI,
        PERMISSION.CATALOG,
        PERMISSION.SCRAP,
        PERMISSION.SPP,
        PERMISSION.MASTER_BARANG,
        PERMISSION.PHOTO_UPDATE,
        PERMISSION.LOCATION_UPDATE
    ],
    VIEWER: [
        PERMISSION.INVENTORY,
        PERMISSION.RESERVASI,
        PERMISSION.SCRAP,
        PERMISSION.CATALOG
    ]
};

export function useAcl(userData) {
    const permissions = computed(() => {
        const user = userData.value;
        if (!user) return [];
        if (user.role === "ADMIN") return ["*"];
        const result = new Set(ROLE_PERMISSIONS[user.role] || []);
        Object.entries(user.permissions || {}).forEach(([permission, enabled]) => {
            if (enabled) {
                result.add(permission);
            } else {
                result.delete(permission);
            }
        });
        return [...result];
    });

    const can = (permission) => {
        const perms = permissions.value;
        return perms.includes("*") || perms.includes(permission);
    };

    const cannot = (permission) => !can(permission);
    const canAny = (...items) => items.some(can);
    const canAll = (...items) => items.every(can);
    const hasRole = (...roles) => roles.includes(userData.value?.role);
    const isAdmin = computed(() => userData.value?.role === "ADMIN");

    return { permissions, can, cannot, hasRole, isAdmin, canAny, canAll };
}