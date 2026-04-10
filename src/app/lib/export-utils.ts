import jsPDF from "jspdf";

// ============================================
// CSV Export
// ============================================

export function exportToCSV(
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const escape = (val: string | number) => {
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvContent = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");

  // BOM for proper Cyrillic in Excel
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

// ============================================
// PDF Export (text-based, no html2canvas)
// ============================================

export function exportToPDF(
  title: string,
  content: string,
  filename: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Title
  doc.setFontSize(16);
  doc.text(title, 15, 20);

  // Date
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`MarketPlan | ${new Date().toLocaleDateString("ru-RU")}`, 15, 27);

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 30, 195, 30);

  // Body text
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);

  // Clean markdown symbols for plain PDF
  const cleanText = content
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, "").replace(/```/g, ""))
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");

  const lines = doc.splitTextToSize(cleanText, 175);
  let y = 36;
  const pageHeight = 280;

  for (const line of lines) {
    if (y > pageHeight) {
      doc.addPage();
      y = 15;
    }
    doc.text(line, 15, y);
    y += 5;
  }

  doc.save(`${filename}.pdf`);
}

// ============================================
// Table PDF Export
// ============================================

export function exportTableToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text(title, 15, 15);

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`MarketPlan | ${new Date().toLocaleDateString("ru-RU")}`, 15, 21);

  doc.setDrawColor(200, 200, 200);
  doc.line(15, 23, 282, 23);

  const colW = Math.min(40, (282 - 15) / headers.length);
  let y = 28;

  // Header row
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.setFillColor(245, 245, 245);
  doc.rect(15, y - 3, colW * headers.length, 6, "F");

  headers.forEach((h, i) => {
    doc.text(String(h).slice(0, 20), 16 + i * colW, y);
  });

  y += 7;
  doc.setTextColor(40, 40, 40);

  for (const row of rows) {
    if (y > 190) {
      doc.addPage();
      y = 15;
    }
    row.forEach((cell, i) => {
      doc.text(String(cell).slice(0, 25), 16 + i * colW, y);
    });
    y += 5;
  }

  doc.save(`${filename}.pdf`);
}

// ============================================
// Helpers
// ============================================

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
