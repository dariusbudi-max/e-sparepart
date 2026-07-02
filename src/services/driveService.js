import { callAPI } from "../api/gas.js";

export const uploadToDrive = async (base64, filename) => {
    if (!base64) {
        throw new Error("File kosong");
    }

    const res = await callAPI("UPLOAD_TO_DRIVE", {
        file: base64,
        filename,
        mimeType: "image/jpeg"
    });

    if (!res || res.status !== "success" || !res.url) {
        throw new Error(res?.message || "Upload gagal");
    }

    return {
        url: res.url,
        fileId: res.fileId
    };
};

export const deleteFromDrive = async (fileId) => {
    if (!fileId) throw new Error("Drive File ID kosong.");

    const res = await callAPI("DELETE_FROM_DRIVE", { fileId });

    if (res?.status !== "success") {
        throw new Error(res?.message || "Gagal menghapus file Drive.");
    }

    return true;
};
