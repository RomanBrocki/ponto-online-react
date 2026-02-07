import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMinutes, statusLabel, type ReportValidation } from "./reportRules";

type GenerateMonthlyPdfParams = {
  report: ReportValidation;
  month: string;
  empregada: string;
};

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const PAGE_MARGIN = 12;

export function generateMonthlyPdfReport({
  report,
  month,
  empregada,
}: GenerateMonthlyPdfParams) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  doc.setFontSize(12);
  doc.text("Relatório Mensal de Ponto", centerX, 12, { align: "center" });

  doc.setFontSize(8);
  doc.text(`Empregada: ${empregada}`, PAGE_MARGIN, 18);
  doc.text(`Período: ${monthLabel(month)}`, PAGE_MARGIN, 22);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, PAGE_MARGIN, 26);

  autoTable(doc, {
    startY: 30,
    head: [["Data", "Dia", "St", "Ent", "S.Alm", "V.Alm", "Sai", "Obs", "Horas", "Saldo"]],
    body: report.days.map((day) => [
      formatDateBr(day.date),
      day.weekday,
      statusLabel(day.status),
      day.entrada ?? "-",
      day.saida_almoco ?? "-",
      day.volta_almoco ?? "-",
      day.saida_final ?? "-",
      day.status === "fim_semana" ? "Fim de Semana" : (day.observacao ?? "-"),
      day.workedMinutes === null ? "-" : formatMinutes(day.workedMinutes),
      formatMinutes(day.saldoMinutes),
    ]),
    styles: {
      fontSize: 5.7,
      cellPadding: 0.45,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [20, 25, 35],
      textColor: [229, 231, 235],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 19 },
      1: { cellWidth: 11 },
      2: { cellWidth: 15 },
      3: { cellWidth: 14 },
      4: { cellWidth: 14 },
      5: { cellWidth: 14 },
      6: { cellWidth: 14 },
      7: { cellWidth: 53 },
      8: { cellWidth: 16 },
      9: { cellWidth: 16 },
    },
    margin: { top: 30, left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN },
    tableWidth: contentWidth,
    pageBreak: "avoid",
    rowPageBreak: "avoid",
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
  const summaryY = Math.max((finalY ?? 40) + 5, 242);

  const rightColumnX = pageWidth / 2 + 4;

  doc.setFontSize(8);
  doc.text("Resumo mensal", PAGE_MARGIN, summaryY);
  doc.text(`Faltas: ${report.summary.faltas}`, PAGE_MARGIN, summaryY + 5);
  doc.text(`Feriados: ${report.summary.feriados}`, PAGE_MARGIN, summaryY + 10);
  doc.text(`Dispensas justificadas: ${report.summary.dispensas}`, PAGE_MARGIN, summaryY + 15);

  doc.text(`Horas extras: ${formatMinutes(report.summary.horasExtras)}`, rightColumnX, summaryY + 5);
  doc.text(`Horas negativas: ${formatMinutes(report.summary.horasNegativas)}`, rightColumnX, summaryY + 10);
  doc.text(`Balanço final: ${formatMinutes(report.summary.balancoFinal)}`, rightColumnX, summaryY + 15);

  doc.save(`relatorio-ponto-${slugify(empregada)}-${month}.pdf`);
}

function monthLabel(month: string) {
  const [yearString, monthString] = month.split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;
  const label = MONTH_NAMES[monthIndex] ?? month;
  return `${label}/${year}`;
}

function formatDateBr(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
