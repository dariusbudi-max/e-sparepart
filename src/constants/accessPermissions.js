import { PERMISSION } from "./permissions.js";

export const ACCESS_PERMISSIONS = [
    {
        key: PERMISSION.DASHBOARD,
        label: "View Dashboard",
        icon: "fa-chart-line"
    },
    {
        key: PERMISSION.ANALYTICS,
        label: "View Analytics",
        icon: "fa-chart-line"
    },
    {
        key: PERMISSION.TRANSAKSI,
        label: "Access Transaksi",
        icon: "fa-cart-flatbed"
    },
    {
        key: PERMISSION.INVENTORY,
        label: "Access Stock Holding",
        icon: "fa-boxes-stacked"
    },
    {
        key: PERMISSION.RESERVASI,
        label: "Reservasi / Bon Suku Cadang",
        icon: "fa-file-invoice"
    },
    {
        key: PERMISSION.MONITORING_LOGS,
        label: "Monitoring & Audit Temuan",
        icon: "fa-clipboard-check"
    },
    {
        key: PERMISSION.MONITORING_LOGS_DELETE,
        label: "Delete Monitoring Log",
        icon: "fa-trash"
    },
    {
        key: PERMISSION.CATALOG,
        label: "Access Catalog",
        icon: "fa-folder-tree"
    },
    {
        key: PERMISSION.SCRAP,
        label: "Access Scrap Monitoring",
        icon: "fa-recycle"
    },
    {
        key: PERMISSION.SPP,
        label: "Access SPP",
        icon: "fa-file-signature"
    },
    {
        key: PERMISSION.PRINT_BARCODE,
        label: "Print Barcode",
        icon: "fa-barcode"
    },
    {
        key: PERMISSION.MASTER_BARANG,
        label: "Access Master Data",
        icon: "fa-database"
    },
    {
        key: PERMISSION.CANCEL_TX,
        label: "Cancel Transaction",
        icon: "fa-ban"
    },
    {
        key: PERMISSION.USER_MANAGEMENT,
        label: "User Management",
        icon: "fa-users-gear"
    },
    {
        key: PERMISSION.CATALOG_FOLDER_MANAGE,
        label: "Manage Catalog Folder",
        icon: "fa-folder-tree"
    },
    {
        key: PERMISSION.SCRAP_EDIT,
        label: "Edit Scrap",
        icon: "fa-pen"
    },
    {
        key: PERMISSION.SCRAP_DELETE,
        label: "Delete Scrap",
        icon: "fa-trash"
    },
    {
        key: PERMISSION.PHOTO_UPDATE,
        label: "Update Photo",
        icon: "fa-image"
    },
    {
        key: PERMISSION.PHOTO_PREVIEW,
        label: "Preview Photo",
        icon: "fa-image"
    },
    {
        key: PERMISSION.EXPORT_EXCEL,
        label: "Export Excel",
        icon: "fa-file-excel"
    },
    {
        key: PERMISSION.VIEW_STOCK,
        label: "View Stock",
        icon: "fa-box"
    },
    {
        key: PERMISSION.RESERVASI_APPROVE,
        label: "Approve Permintaan Barang",
        icon: "fa-circle-check"
    },
    {
        key: PERMISSION.APPROVE_RESERVASI_L1,
        label: "Approve Reservasi Level 1",
        icon: "fa-user-check"
    },
    {
        key: PERMISSION.APPROVE_RESERVASI_L2,
        label: "Approve Reservasi Level 2",
        icon: "fa-user-shield"
    },
    {
        key: PERMISSION.APPROVE_RESERVASI_L3,
        label: "Approve Reservasi Level 3",
        icon: "fa-user-tie"
    },
    {
        key: PERMISSION.REJECT_RESERVASI_L1,
        label: "Reject Reservasi Level 1",
        icon: "fa-user-xmark"
    },
    {
        key: PERMISSION.REJECT_RESERVASI_L2,
        label: "Reject Reservasi Level 2",
        icon: "fa-user-xmark"
    },
    {
        key: PERMISSION.REJECT_RESERVASI_L3,
        label: "Reject Reservasi Level 3",
        icon: "fa-user-xmark"
    }
];