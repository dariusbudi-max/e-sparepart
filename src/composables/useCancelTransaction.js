const { ref } = Vue;
import { cancelTransaksi } from "../services/transactionService.js";

export function useCancelTransaction({ refreshHistory, refreshInventory, showToast }) {
	const cancellingId = ref(null);

	const isVoided = (tx) => {
		if (!tx) return false;
		return tx.isVoided === true || String(tx.ket || "").toUpperCase().includes("[DIBATALKAN]");
	};

	const handleCancelTx = async (tx) => {
		const targetId = tx.rowId;
		if (!targetId || isVoided(tx) || cancellingId.value === targetId) return;
		if (!confirm(`Batalkan transaksi ${tx.nama || tx.kode}?`)) return;

		cancellingId.value = targetId;
		try {
			await cancelTransaksi(targetId);
			showToast("Transaksi berhasil dibatalkan", "success");
			await Promise.all([refreshHistory?.(), refreshInventory?.()]);
		} catch (e) {
			showToast(e.message, "error");
		} finally {
			cancellingId.value = null;
		}
	};

	return { cancellingId, isVoided, handleCancelTx };
}