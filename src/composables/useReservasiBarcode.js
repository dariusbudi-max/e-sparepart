const { nextTick } = Vue;

export function useReservasiBarcode({ docNumber, paginatedItems, showReservasiModal }) {
	const BARCODE_CONFIG = {
		format: "CODE128",
		width: 3,
		height: 150,
		displayValue: false,
		margin: 0,
		background: "#ffffff",
		lineColor: "#000000"
	};

	const renderReservasiBarcode = async () => {
		await nextTick();
		const noDoc = String(docNumber.value || "").trim().toUpperCase();
		const pages = paginatedItems.value || [];

		document.querySelectorAll('[id^="reservasi-barcode-svg-"]').forEach((svg) => {
			svg.innerHTML = "";
		});

		if (!noDoc || !pages.length) return;

		pages.forEach((_, pageIdx) => {
			const svg = document.getElementById(`reservasi-barcode-svg-${pageIdx}`);
			if (!svg) return;

			try {
				JsBarcode(svg, noDoc, BARCODE_CONFIG);
			} catch (error) {
				console.error(`Gagal render barcode halaman ${pageIdx + 1}:`, error);
			}
		});
	};

	const createBarcodeCanvas = async (noDoc) => {
		const scale = 4;
		const width = 800;
		const barcodeHeight = 180;
		const textHeight = 60;
		const paddingTop = 35;
		const paddingBottom = 30;
		const horizontalPadding = 50;

		const canvas = document.createElement("canvas");
		canvas.width = width * scale;
		canvas.height = (paddingTop + barcodeHeight + textHeight + paddingBottom) * scale;

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Canvas context tidak tersedia.");
		}

		ctx.imageSmoothingEnabled = false;
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		JsBarcode(svg, noDoc, BARCODE_CONFIG);

		const serializer = new XMLSerializer();
		const svgString = `<?xml version="1.0" encoding="UTF-8"?>` + serializer.serializeToString(svg);
		const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
		const svgUrl = URL.createObjectURL(blob);

		try {
			const img = new Image();
			await new Promise((resolve, reject) => {
				img.onload = resolve;
				img.onerror = () => {
					reject(new Error("Gagal memuat SVG barcode."));
				};
				img.src = svgUrl;
			});

			const availableWidth = width - (horizontalPadding * 2);
			const ratio = Math.min(availableWidth / img.width, barcodeHeight / img.height);
			const drawWidth = img.width * ratio;
			const drawHeight = img.height * ratio;
			const x = (width - drawWidth) / 2;
			const y = paddingTop + (barcodeHeight - drawHeight) / 2;

			ctx.save();
			ctx.scale(scale, scale);
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(img, x, y, drawWidth, drawHeight);

			ctx.fillStyle = "#000000";
			ctx.font = "bold 26px Arial";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(noDoc, width / 2, paddingTop + barcodeHeight + textHeight / 2);
			ctx.restore();

			return canvas;
		} finally {
			URL.revokeObjectURL(svgUrl);
		}
	};

	const downloadReservasiBarcode = async (noDocParam = null, showToast = () => { }) => {
		let noDoc = "";

		if (typeof noDocParam === "string") {
			noDoc = noDocParam;
		} else if (noDocParam && typeof noDocParam === "object" && noDocParam?.header?.no_doc) {
			noDoc = noDocParam.header.no_doc;
		} else {
			noDoc = docNumber?.value || "";
		}

		noDoc = String(noDoc).trim().toUpperCase();

		if (!noDoc || noDoc === "[OBJECT POINTEREVENT]") {
			showToast("Nomor dokumen BPSC tidak tersedia.", "error");
			return false;
		}

		try {
			const canvas = await createBarcodeCanvas(noDoc);
			const pngBlob = await new Promise((resolve) => {
				canvas.toBlob(resolve, "image/png");
			});

			if (!pngBlob) {
				throw new Error("Gagal membuat gambar PNG barcode.");
			}

			const downloadUrl = URL.createObjectURL(pngBlob);
			const a = document.createElement("a");
			a.href = downloadUrl;
			a.download = `BARCODE_${noDoc.replace(/[^A-Z0-9_-]/gi, "_")}.png`;
			a.style.display = "none";
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);

			setTimeout(() => {
				URL.revokeObjectURL(downloadUrl);
			}, 1500);

			showToast(`Barcode ${noDoc} berhasil diunduh.`, "success");
			return true;
		} catch (error) {
			console.error("Gagal download barcode:", error);
			showToast(error?.message || "Gagal mengunduh barcode.", "error");
			return false;
		}
	};

	return {
		renderReservasiBarcode,
		downloadReservasiBarcode
	};
}