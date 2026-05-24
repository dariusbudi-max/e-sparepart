const UAParser = window.UAParser;

export const getDeviceInfo = () => {
    if (!UAParser) {
        return {
            deviceId: getDeviceId(),
            deviceName: "Unknown Device"
        };
    }

    const parser = new UAParser();
    const result = parser.getResult();

    const browser =
        result.browser.name || "Unknown Browser";

    const os =
        result.os.name || "Unknown OS";

    const device =
        result.device.model || "PC/Laptop";

    return {
        deviceId: getDeviceId(),
        deviceName: `${browser} on ${os} (${device})`
    };
};

const getDeviceId = () => {
    let deviceId = localStorage.getItem("wms_device_id");

    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("wms_device_id", deviceId);
    }

    return deviceId;
};