import { PERMISSION } from "./permissions.js";

export const ACCESS_PERMISSIONS = [
    {
        key: PERMISSION.DASHBOARD,
        label: "View Dashboard",
        icon: "fa-chart-line"
    },
    {
        key: PERMISSION.CATALOG,
        label: "Access Catalog",
        icon: "fa-book"
    },
    {
        key: PERMISSION.CATALOG_FOLDER_MANAGE,
        label: "Manage Catalog Folder",
        icon: "fa-folder-tree"
    },
    {
        key: PERMISSION.SCRAP,
        label: "Access Scrap Monitoring",
        icon: "fa-recycle"
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
        key: PERMISSION.CANCEL_TX,
        label: "Cancel Transaction",
        icon: "fa-trash"
    }
];
