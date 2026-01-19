const parsePercent = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value === null || value.trim() === "") {
    return fallback;
  }

  const num = Number(value);

  if (Number.isNaN(num) || num < 0 || num > 100) {
    console.warn(
      `[COMMISSION_CONFIG] Invalid percentage value "${value}", using fallback ${fallback}%`,
    );
    return fallback;
  }

  return num;
};


export const COMMISSION_CONFIG = {
  // % added to user as H12homes processing fee
  PLATFORM_FEE_PERCENT: parsePercent(process.env.PLATFORM_FEE_PERCENT, 10),

  // agent / company split (internal)
  AGENT_SHARE_PERCENT: parsePercent(process.env.AGENT_SHARE_PERCENT, 70),
  COMPANY_SHARE_PERCENT: parsePercent(process.env.COMPANY_SHARE_PERCENT, 30),
};
