const { ref, unref } = Vue;
import { parseCSV } from "../utils/csvParser.js";
import { validateRows } from "../utils/validator.js";

export const useImportTx = (inventoryRef, onSubmit) => {
    const preview = ref([]);
    const loading = ref(false);

    const handlePaste = async (text) => {
        if (loading.value) return;

        loading.value = true;

        try {
            const currentInv = unref(inventoryRef.inventory) || [];

            if (!currentInv.length) {
                throw new Error("Inventory belum selesai dimuat");
            }

            const parsed = parseCSV(text);
            preview.value = await validateRows(parsed, currentInv);
        } finally {
            loading.value = false;
        }
    };

    const handleFile = async (file) => {
        const text = await file.text();
        await handlePaste(text);
    };

    const reset = () => { preview.value = []; };

    const submit = async () => {
        if (loading.value) return;
        const currentInv = unref(inventoryRef.inventory) || [];
        const revalidated = await validateRows(preview.value, currentInv);

        if (revalidated.some(r => !r.valid)) {
            preview.value = revalidated;
            throw new Error("Terdapat data tidak valid");
        }

        loading.value = true;
        try {
            await onSubmit(revalidated);
            reset();
        } finally {
            loading.value = false;
        }
    };

    return { preview, handlePaste, handleFile, submit, loading, reset };
};