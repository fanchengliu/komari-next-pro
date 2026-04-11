interface UserAgentInfo {
  device: string;
  browser: string;
  version: string;
}

export class UserAgentHelper {
  static parse(userAgent: string = navigator.userAgent): UserAgentInfo {
    const ua = userAgent.toLowerCase();

    // Detect device/OS
    let device = "Unknown";
    if (ua.includes("windows nt")) {
      device = "Windows";
    } else if (ua.includes("mac os x")) {
      device = "macOS";
    } else if (ua.includes("android")) {
      device = "Android";
    } else if (ua.includes("iphone") || ua.includes("ipad")) {
      device = "iOS";
    } else if (ua.includes("linux")) {
      device = "Linux";
    }

    // Detect browser and version
    let browser = "Unknown";
    let version = "0.0.0";

    if (ua.includes("edg/")) {
      browser = "Edge";
      const match = ua.match(/edg\/(\d+\.\d+\.\d+)/);
      version = match ? match[1] : version;
    } else if (ua.includes("chrome/")) {
      browser = "Chrome";
      const match = ua.match(/chrome\/(\d+\.\d+\.\d+)/);
      version = match ? match[1] : version;
    } else if (ua.includes("firefox/")) {
      browser = "Firefox";
      const match = ua.match(/firefox\/(\d+\.\d+)/);
      version = match ? match[1] : version;
    } else if (ua.includes("safari/") && !ua.includes("chrome")) {
      browser = "Safari";
      const match = ua.match(/version\/(\d+\.\d+)/);
      version = match ? match[1] : version;
    }

    return { device, browser, version };
  }

  static format(userAgent?: string): string {
    const { device, browser, version } = this.parse(userAgent);
    return `${device} ${browser}/${version}`;
  }
}
