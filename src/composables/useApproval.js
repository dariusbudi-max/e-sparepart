import { approveReservasiService, rejectReservasiService } from "../services/reservasiService.js";
import { PERMISSION } from "../constants/permissions.js";

const { ref } = Vue;

export function useApproval({
    showToast,
    userData,
    can,
    loadReservasiList,
    getReservasiByDocService,
    loadReservasiApproval,
    buatPreviewBarcodeReservasi,
    refreshReservasiPreview,
    showReservasiPreviewModal,
    selectedReservasi
}) {
    const isApprovingReservasi = ref(false);
    const isRejectingReservasi = ref(false);

    const getNextApprovalLevel = (item) => {
        if (!item) return null;
        const currentLevel = item.approval_level == null ? 0 : Number(item.approval_level);
        if (!Number.isFinite(currentLevel) || currentLevel >= 3) return null;
        return currentLevel + 1;
    };

    const getApprovePermission = (level) => {
        switch (Number(level)) {
            case 1: return PERMISSION.APPROVE_RESERVASI_L1;
            case 2: return PERMISSION.APPROVE_RESERVASI_L2;
            case 3: return PERMISSION.APPROVE_RESERVASI_L3;
            default: return null;
        }
    };

    const getRejectPermission = (level) => {
        switch (Number(level)) {
            case 1: return PERMISSION.REJECT_RESERVASI_L1;
            case 2: return PERMISSION.REJECT_RESERVASI_L2;
            case 3: return PERMISSION.REJECT_RESERVASI_L3;
            default: return null;
        }
    };

    const canApproveReservasi = (item) => {
        if (!item) return false;
        const status = String(item.status || "").trim().toUpperCase();
        if (status !== "PENDING") return false;

        const level = getNextApprovalLevel(item);
        if (!level) return false;

        const permission = getApprovePermission(level);
        if (!permission) return false;

        return Boolean(can(permission));
    };

    const canRejectReservasi = (item) => {
        if (!item) return false;
        const status = String(item.status || "").trim().toUpperCase();
        if (status !== "PENDING") return false;

        const level = getNextApprovalLevel(item);
        if (!level) return false;

        const permission = getRejectPermission(level);
        if (!permission) return false;

        return Boolean(can(permission));
    };

    const approveReservasi = async (item) => {
        if (isApprovingReservasi.value) return;

        if (!canApproveReservasi(item)) {
            showToast("Anda tidak memiliki hak untuk approve reservasi ini.", "error");
            return;
        }

        const level = getNextApprovalLevel(item);
        if (!level) {
            showToast("Level approval sudah selesai.", "warning");
            return;
        }

        const noDoc = String(item.no_doc || "").trim().toUpperCase();
        if (!item.id || !noDoc) {
            showToast("Data reservasi tidak valid.", "error");
            return;
        }

        const username = String(userData.value?.username || userData.value?.nama || "SYSTEM").trim();
        const confirmed = window.confirm(`Approve BPSC ${noDoc} sebagai Approval Level ${level}?`);
        if (!confirmed) return;

        isApprovingReservasi.value = true;

        try {
            await approveReservasiService(item.id, noDoc, username, level);
            showToast(`BPSC ${noDoc} berhasil di-approve pada Level ${level}.`, "success");
            await loadReservasiList({ reset: true });
        } catch (error) {
            console.error("Gagal approve reservasi:", error);
            showToast(error?.message || "Gagal melakukan approval reservasi.", "error");
        } finally {
            isApprovingReservasi.value = false;
        }
    };

    const rejectReservasi = async (item) => {
        if (isRejectingReservasi.value) return;

        if (!item) {
            showToast("Data reservasi tidak valid.", "error");
            return;
        }

        if (!canRejectReservasi(item)) {
            showToast("Anda tidak memiliki hak untuk membatalkan reservasi ini.", "error");
            return;
        }

        const level = getNextApprovalLevel(item);
        if (!level) {
            showToast("Level approval sudah selesai atau tidak tersedia.", "warning");
            return;
        }

        const reservasiId = String(item.id || "").trim();
        const noDoc = String(item.no_doc || "").trim().toUpperCase();

        if (!reservasiId || !noDoc) {
            showToast("Data reservasi tidak valid.", "error");
            return;
        }

        const status = String(item.status || "").trim().toUpperCase();
        if (status !== "PENDING") {
            showToast(`BPSC ${noDoc} tidak dapat dibatalkan. Status: ${status}`, "warning");
            return;
        }

        const username = String(userData.value?.username || userData.value?.nama || "SYSTEM").trim();
        const reason = window.prompt(`Alasan pembatalan BPSC ${noDoc}:`);
        if (reason === null) return;

        const cleanReason = String(reason).trim();
        if (!cleanReason) {
            showToast("Alasan pembatalan wajib diisi.", "warning");
            return;
        }

        const confirmed = window.confirm(
            `Batalkan BPSC ${noDoc}?\n\n` +
            `Approval saat ini: Level ${level}/3\n` +
            `Alasan: ${cleanReason}\n\n` +
            `BPSC akan berubah menjadi CANCELLED.`
        );
        if (!confirmed) return;

        isRejectingReservasi.value = true;

        try {
            await rejectReservasiService(reservasiId, noDoc, username, level, cleanReason);
            showToast(`BPSC ${noDoc} berhasil dibatalkan.`, "success");
            await loadReservasiList({ reset: true });
            if (showReservasiPreviewModal.value) {
                await refreshReservasiPreview(noDoc);
            }
        } catch (error) {
            console.error("Gagal membatalkan reservasi:", error);
            showToast(error?.message || "Gagal melakukan pembatalan reservasi.", "error");
        } finally {
            isRejectingReservasi.value = false;
        }
    };

    return {
        isApprovingReservasi,
        isRejectingReservasi,
        getNextApprovalLevel,
        getApprovePermission,
        getRejectPermission,
        canApproveReservasi,
        canRejectReservasi,
        approveReservasi,
        rejectReservasi
    };
}