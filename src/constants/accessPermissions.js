import { PERMISSION } from "./permissions.js";

export const ACCESS_PERMISSIONS = [
    {
        key: PERMISSION.DASHBOARD_VIEW,
        label: "View Dashboard",
        icon: "fa-chart-line"
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