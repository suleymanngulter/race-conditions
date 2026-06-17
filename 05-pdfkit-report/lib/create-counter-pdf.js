const PDFDocument = require("pdfkit");

function createCounterPdf(n) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(48).text(`${n}. pdf`, 50, 300, { align: "center", width: 495 });
    doc.end();
  });
}

module.exports = { createCounterPdf };