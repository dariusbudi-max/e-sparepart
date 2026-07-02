import { compressImage } from "../utils/imageUtils.js";
import { uploadToDrive } from "../services/driveService.js";
import { addPhoto, fetchPhotos } from "../services/inventoryPhotoService.js";

export const useUploadPhoto = (deps) => {
    const { isUploading, formItem, showToast, loadInventory } = deps;

    const generateFilename = (kode) => `IMG_${kode}_${Date.now()}.jpg`;

    const refreshPhotoList = async (kode) => {
        const latest = await fetchPhotos(kode);
        formItem.value.photos = latest;
        formItem.value.selectedPhoto = latest.find(p => p.is_cover) || latest[0] || null;
        return latest;
    };

    const uploadBase64 = async (base64, kode) => {
        const filename = generateFilename(kode);
        return await uploadToDrive(base64, filename);
    };

    const uploadFile = async (file, kode) => {
        const base64 = await compressImage(file);
        return await uploadBase64(base64, kode);
    };

    const saveUploadedPhoto = async ({ file = null, base64 = null }) => {
        if (isUploading.value) return;
        isUploading.value = true;

        try {
            const kode = formItem.value.kode;
            if (!kode) throw new Error("Barang harus disimpan terlebih dahulu.");

            let driveFile = null;

            if (file) {
                driveFile = await uploadFile(file, kode);
            } else if (base64) {
                driveFile = await uploadBase64(base64, kode);
            }

            if (!driveFile) {
                throw new Error("Tidak ada gambar untuk diupload");
            }

            await addPhoto(kode, driveFile.url, driveFile.fileId);
            const latest = await refreshPhotoList(kode);
            showToast("Foto berhasil ditambahkan", "success");
            return latest;
        } catch (err) {
            showToast(err.message, "error");
            throw err;
        } finally {
            isUploading.value = false;
        }
    };

    const readFilePreview = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    return {
        saveUploadedPhoto,
        readFilePreview,
        refreshPhotoList
    };
};
