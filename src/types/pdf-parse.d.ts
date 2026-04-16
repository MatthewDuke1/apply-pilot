declare module "pdf-parse" {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    text: string;
  }
  function pdf(dataBuffer: Buffer): Promise<PDFData>;
  export = pdf;
}
