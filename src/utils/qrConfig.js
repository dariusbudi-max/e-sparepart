export const qrLabelSizes = {
    "30x30": {
        name: "30 x 30 mm",
        width: 30,
        height: 30
    }
};

export function getQrLabelSize(key = "30x30") {
    return qrLabelSizes[key] || qrLabelSizes["30x30"];
}

export function getQrConfig() {
    return {
        width: 300,
        margin: 0,
        errorCorrectionLevel: "M",
        color: {
            dark: "#000000",
            light: "#FFFFFF"
        }
    };
}

export function getQrA4Layout() {
    const label = getQrLabelSize();
    const pageWidth = 210;
    const pageHeight = 297;
    const gapX = 1;
    const gapY = 1;
    const columns = Math.floor(pageWidth / (label.width + gapX));
    const rows = Math.floor(pageHeight / (label.height + gapY));

    return {
        columns,
        rows,
        perPage: columns * rows,
        gapX,
        gapY,
        pageWidth,
        pageHeight,
        labelWidth: label.width,
        labelHeight: label.height
    };
}