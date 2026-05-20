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

    return res.url;
};