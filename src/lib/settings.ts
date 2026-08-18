import { db, type ChildContract } from "../db";
import { SURREY_TERMS_ALL, type TermBlock } from "../data/surrey";

export interface Business {
  name: string;
  tagline: string;
  ownerName?: string;
  ofstedReg?: string;
  email?: string;
  phone?: string;
  bankName?: string;
  sortCode?: string;
  accountNo?: string;
  paymentNote?: string;
}

export const DEFAULT_BUSINESS: Business = {
  name: "J.S. Nannies",
  tagline: "Childminding Services",
};

export async function getBusiness(): Promise<Business> {
  const s = await db.settings.get("business");
  return { ...DEFAULT_BUSINESS, ...((s?.value as Business) ?? {}) };
}

export async function setBusiness(b: Business): Promise<void> {
  await db.settings.put({ key: "business", value: b });
}

export async function getTermBlocks(): Promise<TermBlock[]> {
  const s = await db.settings.get("termBlocks");
  const v = s?.value as TermBlock[] | undefined;
  return v && v.length > 0 ? v : SURREY_TERMS_ALL;
}

export async function setTermBlocks(blocks: TermBlock[]): Promise<void> {
  await db.settings.put({ key: "termBlocks", value: blocks });
}

// ---- Child colours (leaf green is reserved for funding) ----
export const CHILD_COLOURS = [
  "#E8A13A", // marigold
  "#5C93C4", // sky
  "#9A6FB5", // plum
  "#E07856", // coral
  "#3FA3A0", // teal
  "#C25A88", // berry
  "#8A9A4B", // moss
  "#6B7B8C", // slate
];

export function nextColour(existing: ChildContract[]): string {
  const used = new Set(existing.map((c) => c.color));
  return CHILD_COLOURS.find((c) => !used.has(c)) ?? CHILD_COLOURS[existing.length % CHILD_COLOURS.length];
}

export function childColour(c: ChildContract, index: number): string {
  return c.color ?? CHILD_COLOURS[index % CHILD_COLOURS.length];
}
