import { useState } from "react";
import type { ChildContract } from "../db";
import type { DetailedLine } from "../engine/monthInvoice";
import { formatPence } from "../engine/invoice";
import { monthLabel } from "../lib/dates";
import { buildInvoicePdf, invoiceFileName, invoiceNumber } from "../lib/invoicePdf";
import type { Business } from "../lib/invoiceHtml";

/**
 * Share sheet (Mail, Messages, WhatsApp, Save to Files), a direct download
 * fallback, and an email draft. iOS can't attach a file via mailto:, so the
 * email button opens a pre-written draft and the PDF is attached from the
 * share sheet — the flow is spelled out rather than silently failing.
 */
export function InvoiceActions({
  child,
  period,
  lines,
  total,
  business,
  version,
}: {
  child: ChildContract;
  period: string;
  lines: DetailedLine[];
  total: number;
  business: Business;
  version: number;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const fileName = invoiceFileName(child, period);
  const label = monthLabel(`${period}-01`);

  async function makeFile(): Promise<File> {
    const blob = await buildInvoicePdf(child, period, lines, total, business, version);
    return new File([blob], fileName, { type: "application/pdf" });
  }

  async function share() {
    setBusy("share");
    setNote("");
    try {
      const file = await makeFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice — ${label}`,
          text: `${child.name} — childcare invoice for ${label}. Total due ${formatPence(total)}.`,
        });
      } else {
        download(file);
        setNote("Saved to your downloads.");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote("Couldn't share that — try Save PDF instead.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setNote("");
    try {
      download(await makeFile());
      setNote("PDF saved.");
    } catch {
      setNote("Couldn't create the PDF.");
    } finally {
      setBusy(null);
    }
  }

  function email() {
    const to = child.payer?.email ?? "";
    const subject = `Invoice ${invoiceNumber(child, period, version)} — ${label}`;
    const body =
      `Hi${child.payer?.name ? ` ${child.payer.name.split(" ")[0]}` : ""},\n\n` +
      `Please find the childcare invoice for ${child.name} covering ${label}.\n\n` +
      `Total due: ${formatPence(total)}\n\n` +
      (child.payer?.tfcReference
        ? `If you're paying through Tax-Free Childcare, the reference is ${child.payer.tfcReference}.\n\n`
        : "") +
      `Many thanks,\n${business.ownerName ?? business.name}`;
    location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    setNote("Draft opened — use Share → Mail to attach the PDF itself.");
  }

  return (
    <>
      <button className="btn-primary" onClick={share} disabled={busy !== null}>
        {busy === "share" ? "Preparing…" : "Share PDF"}
      </button>
      <div className="field-row">
        <button className="btn-quiet" onClick={email} disabled={busy !== null}>
          Email parent
        </button>
        <button className="btn-quiet" onClick={save} disabled={busy !== null}>
          {busy === "save" ? "Saving…" : "Save PDF"}
        </button>
        <button className="btn-quiet" onClick={() => window.print()} disabled={busy !== null}>
          Print
        </button>
      </div>
      {note && <p className="hint">{note}</p>}
    </>
  );
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
