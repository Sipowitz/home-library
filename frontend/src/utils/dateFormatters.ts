import { format, formatDistanceToNow } from "date-fns";

import type { DateFormat, Preferences, TimeFormat } from "../types/preferences";

const DATE_FORMAT_MAP: Record<DateFormat, string> = {
  "DD/MM/YYYY": "dd/MM/yyyy",

  "MM/DD/YYYY": "MM/dd/yyyy",

  "YYYY-MM-DD": "yyyy-MM-dd",
};

const TIME_FORMAT_MAP: Record<TimeFormat, string> = {
  "24h": "HH:mm",

  "12h": "hh:mm a",
};

// -------------------
// ⚙️ FALLBACKS
// -------------------

const DEFAULT_PREFERENCES: Pick<Preferences, "date_format" | "time_format"> = {
  date_format: "DD/MM/YYYY",

  time_format: "24h",
};

// -------------------
// 🧱 INTERNAL
// -------------------

function parseDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function getPreferences(preferences: Preferences | null | undefined) {
  return preferences ?? DEFAULT_PREFERENCES;
}

function getDatePattern(preferences: Preferences | null | undefined) {
  const prefs = getPreferences(preferences);

  return DATE_FORMAT_MAP[prefs.date_format];
}

function getTimePattern(preferences: Preferences | null | undefined) {
  const prefs = getPreferences(preferences);

  return TIME_FORMAT_MAP[prefs.time_format];
}

// -------------------
// 📅 DATE
// -------------------

export function formatDate(
  value: string | Date | null | undefined,
  preferences?: Preferences | null,
) {
  if (!value) {
    return "";
  }

  const date = parseDate(value);

  return format(date, getDatePattern(preferences));
}

// -------------------
// 🕒 TIME
// -------------------

export function formatTime(
  value: string | Date | null | undefined,
  preferences?: Preferences | null,
) {
  if (!value) {
    return "";
  }

  const date = parseDate(value);

  return format(date, getTimePattern(preferences));
}

// -------------------
// 📅🕒 DATETIME
// -------------------

export function formatDateTime(
  value: string | Date | null | undefined,
  preferences?: Preferences | null,
) {
  if (!value) {
    return "";
  }

  const date = parseDate(value);

  return format(
    date,
    `${getDatePattern(preferences)} ${getTimePattern(preferences)}`,
  );
}

// -------------------
// ⏱️ RELATIVE
// -------------------

export function formatRelativeTime(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  const date = parseDate(value);

  return formatDistanceToNow(date, {
    addSuffix: true,
  });
}

// -------------------
// 📁 FILE TIMESTAMP
// -------------------

export function formatFileTimestamp(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  const date = parseDate(value);

  return format(date, "yyyy-MM-dd-HHmm");
}
