const UAParser = window.UAParser;

export const getDeviceInfo = () => {
    if (!UAParser) {
        return "Unknown Device";
    }

    const parser = new UAParser();

    const result = parser.getResult();

    const browser =
        result.browser.name || "Unknown Browser";

    const os =
        result.os.name || "Unknown OS";

    const device =
        result.device.model || "PC/Laptop";

    return `${browser} on ${os} (${device})`;
};