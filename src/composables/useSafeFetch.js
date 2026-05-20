export function useSafeFetch(showToast) {
	const safeFetch = async ({ fn, fallback = null, label = "data", silent = false }) => {
		try {
			const result = await fn();
			return result ?? fallback;
		} catch (err) {
			console.error(`❌ Error ${label}:`, err);
			if (!silent && showToast) showToast(`Gagal load ${label}`, "error");
			return fallback;
		}
	};
	return { safeFetch };
}