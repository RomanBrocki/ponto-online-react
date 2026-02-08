import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  formatMinutes,
  formatSignedMinutes,
  weekendDayLabel,
  type ReportValidation,
} from "./reportRules";

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
const TABLE_START_Y = 30;
const TABLE_PANEL_PADDING_X = 2;
const TABLE_CONTENT_WIDTH = 160;

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
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;
  const tableMarginLeft = (pageWidth - TABLE_CONTENT_WIDTH) / 2;
  const tableMarginRight = tableMarginLeft;
  const tablePanelX = tableMarginLeft - TABLE_PANEL_PADDING_X;
  const tablePanelWidth = TABLE_CONTENT_WIDTH + TABLE_PANEL_PADDING_X * 2;
  const contentWidth = tablePanelWidth - TABLE_PANEL_PADDING_X * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Relatório Mensal de Ponto", centerX, 12, { align: "center" });
  doc.setFont("helvetica", "normal");

  doc.setFontSize(8);
  doc.text(`Empregada: ${empregada}`, PAGE_MARGIN, 18);
  doc.text(`Período: ${monthLabel(month)}`, PAGE_MARGIN, 22);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, PAGE_MARGIN, 26);

  autoTable(doc, {
    startY: TABLE_START_Y,
    head: [[
      "Data",
      "Dia",
      "Entrada",
      "Saída Almoço",
      "Retorno Almoço",
      "Saída",
      "Observação",
      "Horas",
      "Saldo",
    ]],
    body: report.days.map((day) => [
      formatDateBrShort(day.date),
      day.weekday,
      day.entrada ?? "-",
      day.saida_almoco ?? "-",
      day.volta_almoco ?? "-",
      day.saida_final ?? "-",
      day.status === "fim_semana" ? weekendDayLabel(day.date) : (day.observacao ?? "-"),
      day.workedMinutes === null ? "-" : formatMinutes(day.workedMinutes),
      formatSignedMinutes(day.saldoMinutes),
    ]),
    styles: {
      fontSize: 6.8,
      cellPadding: 0.6,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [20, 25, 35],
      textColor: [229, 231, 235],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 13 },
      1: { cellWidth: 10 },
      2: { cellWidth: 15 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 14 },
      6: { cellWidth: 32 },
      7: { cellWidth: 18, halign: "right", font: "courier" },
      8: { cellWidth: 18, halign: "right", font: "courier" },
    },
    margin: {
      top: TABLE_START_Y,
      left: tableMarginLeft,
      right: tableMarginRight,
      bottom: PAGE_MARGIN,
    },
    tableWidth: TABLE_CONTENT_WIDTH,
    pageBreak: "avoid",
    rowPageBreak: "avoid",
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
  const tableTop = TABLE_START_Y - 2;
  const tableBottom = (finalY ?? 40) + 2;
  const tableHeight = tableBottom - tableTop;
  drawPanel(doc, tablePanelX, tableTop, tablePanelWidth, tableHeight, false);

  const gapAfterTable = 10;
  const summaryTitleHeight = 6;
  const summaryCardsHeight = 24;
  const summaryBlockHeight = summaryTitleHeight + summaryCardsHeight + 3;
  const gapBeforeSignature = 12;
  const signatureBlockHeight = 16;
  let summaryBlockTop = tableBottom + gapAfterTable;

  if (
    summaryBlockTop + summaryBlockHeight + gapBeforeSignature + signatureBlockHeight >
    pageHeight - PAGE_MARGIN
  ) {
    doc.addPage();
    summaryBlockTop = PAGE_MARGIN + 10;
  }

  drawPanel(
    doc,
    tablePanelX,
    summaryBlockTop,
    tablePanelWidth,
    summaryBlockHeight,
    false,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Resumo mensal", centerX, summaryBlockTop + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");

  const cardsTop = summaryBlockTop + summaryTitleHeight + 1;
  const cardsGap = 6;
  const cardWidth = (contentWidth - cardsGap) / 2;
  const leftCardX = tableMarginLeft;
  const rightCardX = leftCardX + cardWidth + cardsGap;

  drawPanel(doc, leftCardX, cardsTop, cardWidth, summaryCardsHeight, true);
  drawPanel(doc, rightCardX, cardsTop, cardWidth, summaryCardsHeight, true);

  doc.setFontSize(8);
  doc.text(`Dias trabalhados: ${report.summary.diasTrabalhados}`, leftCardX + 2.5, cardsTop + 5);
  doc.text(`Faltas: ${report.summary.faltas}`, leftCardX + 2.5, cardsTop + 10);
  doc.text(`Feriados: ${report.summary.feriados}`, leftCardX + 2.5, cardsTop + 15);
  doc.text(
    `Dispensas justificadas: ${report.summary.dispensas}`,
    leftCardX + 2.5,
    cardsTop + 20,
  );

  doc.text(
    `Horas extras: ${formatMinutes(report.summary.horasExtras)}`,
    rightCardX + 2.5,
    cardsTop + 5,
  );
  doc.text(
    `Horas negativas: ${formatMinutes(report.summary.horasNegativas)}`,
    rightCardX + 2.5,
    cardsTop + 10,
  );
  doc.text(
    `Balanço final: ${formatSignedMinutes(report.summary.balancoFinal)}`,
    rightCardX + 2.5,
    cardsTop + 15,
  );

  const signatureY = summaryBlockTop + summaryBlockHeight + gapBeforeSignature;
  const signatureLineWidth = 46;
  const signatureGap = 10;
  const signatureTotalWidth = signatureLineWidth * 2 + signatureGap;
  const leftLineStart = centerX - signatureTotalWidth / 2;
  const leftLineEnd = leftLineStart + signatureLineWidth;
  const rightLineStart = leftLineEnd + signatureGap;
  const rightLineEnd = rightLineStart + signatureLineWidth;
  const lineY = signatureY;

  doc.line(leftLineStart, lineY, leftLineEnd, lineY);
  doc.line(rightLineStart, lineY, rightLineEnd, lineY);
  doc.text("Data", (leftLineStart + leftLineEnd) / 2, lineY + 4, { align: "center" });
  doc.text("Assinatura da empregada", (rightLineStart + rightLineEnd) / 2, lineY + 4, {
    align: "center",
  });

  doc.save(`relatorio-ponto-${slugify(empregada)}-${month}.pdf`);
}

function drawPanel(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  withFill: boolean,
) {
  doc.setDrawColor(184, 194, 208);
  if (withFill) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, width, height, 2, 2, "FD");
    return;
  }
  doc.roundedRect(x, y, width, height, 2, 2, "S");
}

function monthLabel(month: string) {
  const [yearString, monthString] = month.split("-");
  const year = Number(yearString);
  const monthIndex = Number(monthString) - 1;
  const label = MONTH_NAMES[monthIndex] ?? month;
  return `${label}/${year}`;
}

function formatDateBrShort(dateKey: string) {
  const [, month, day] = dateKey.split("-").map(Number);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
