/** Embed a JPEG as a one-page PDF. No extra dependency. */
export function jpegToPdf(jpeg: Uint8Array, width: number, height: number): Buffer {
  const pageW = width;
  const pageH = height;
  const chunks: Buffer[] = [];
  let pos = 0;
  const push = (data: string | Uint8Array) => {
    const buf = typeof data === "string" ? Buffer.from(data, "latin1") : Buffer.from(data);
    chunks.push(buf);
    pos += buf.length;
  };

  const xref: number[] = [];
  const obj = (n: number, body: string) => {
    xref[n] = pos;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);

  xref[4] = pos;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push("\nendstream\nendobj\n");

  const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}endstream`);

  const xrefStart = pos;
  let table = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) table += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);
  return Buffer.concat(chunks);
}
