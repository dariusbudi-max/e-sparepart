export const labelSizes = {
    "40x20": {
        name: "40 x 20 mm",
        width: 40,
        height: 20
    },
    "50x30": {
        name: "50 x 30 mm",
        width: 50,
        height: 30
    },
    "60x40": {
        name: "60 x 40 mm",
        width: 60,
        height: 40
    },
    "75x25": {
        name: "75 x 25 mm (Box)",
        width: 75,
        height: 25
    },
    "80x50": {
        name: "80 x 50 mm",
        width: 80,
        height: 50
    }
};

export function getLabelSize(key = "60x40") {
    return labelSizes[key] || labelSizes["60x40"];
}

export function getBarcodeConfig(labelKey = "40x20") {
    switch (labelKey) {
        case "40x20":
            return {
                format: "CODE128",
                width: 1,
                height: 18,
                displayValue: true,
                fontSize: 10,
                fontOptions: "bold",
                margin: 2,
                textMargin: 2,
                background: "#fff",
                lineColor: "#000"
            };
        case "50x30":
            return {
                format: "CODE128",
                width: 1.5,
                height: 25,
                displayValue: true,
                fontSize: 11,
                fontOptions: "bold",
                margin: 2,
                textMargin: 2,
                background: "#fff",
                lineColor: "#000"
            };
        case "60x40":
            return {
                format: "CODE128",
                width: 2,
                height: 35,
                displayValue: true,
                fontSize: 11,
                fontOptions: "bold",
                margin: 2,
                textMargin: 2,
                background: "#fff",
                lineColor: "#000"
            };
        case "75x25":
            return {
                format: "CODE128",
                width: 2,
                height: 20,
                displayValue: true,
                fontSize: 10,
                fontOptions: "bold",
                margin: 2,
                textMargin: 1,
                background: "#fff",
                lineColor: "#000"
            };
        case "80x50":
            return {
                format: "CODE128",
                width: 2.5,
                height: 45,
                displayValue: true,
                fontSize: 12,
                fontOptions: "bold",
                margin: 2,
                textMargin: 2,
                background: "#fff",
                lineColor: "#000"
            };
        default:
            return getBarcodeConfig("40x20");
    }
}

export function getA4Layout(labelKey = "60x40") {
    const label = getLabelSize(labelKey);

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