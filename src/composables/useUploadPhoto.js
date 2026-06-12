import { compressImage } from "../utils/imageUtils.js";
import { uploadToDrive } from "../services/driveService.js";
import { updatePhoto } from "../services/inventoryService.js";

export const useUploadPhoto = (deps) => {
    const {
        isUploading,
        formItem,
        loadInventory,
        showToast
    } = deps;

    const generateFilename = (kode) => {
        return `IMG_${kode}_${Date.now()}.jpg`;
    };

    const savePhoto = async (base64, kode) => {
        const filename = generateFilename(kode);
        const url = await uploadToDrive(base64, filename);
        await updatePhoto(kode, url);
        return url;
    };

    const uploadPhoto = async (file, kode) => {
        if (!file) {
            throw new Error("File kosong");
        }
        const base64 = await compressImage(file);
        return await savePhoto(base64, kode);
    };

    const uploadBase64Photo = async (base64, kode) => {
        if (!base64) {
            throw new Error("Gambar kosong");
        }
        return await savePhoto(base64, kode);
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        isUploading.value = true;

        try {
            const targetKode = formItem.value.kode;
            const url = await uploadPhoto(file, targetKode);

            formItem.value.foto = url;

            if (deps.inventory && deps.inventory.value) {
                const item = deps.inventory.value.find(i => i.kode === targetKode);
                if (item) {
                    item.foto = url;
                }
            }

            if (deps.isServerMode && deps.isServerMode.value && deps.serverResults) {
                const serverItem = deps.serverResults.value.find(i => i.kode === targetKode);
                if (serverItem) {
                    serverItem.foto = url;
                }
            }

            await loadInventory(true);
            showToast("Foto berhasil diunggah", "success");
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            isUploading.value = false;
            event.target.value = "";
        }
    };

    return {
        uploadPhoto,
        uploadBase64Photo,
        handleFileUpload
    };
};
