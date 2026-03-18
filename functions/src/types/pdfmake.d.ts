/**
 * Minimal type declarations for pdfmake v0.3.x.
 * Only the types needed by EX3 report generation are declared here.
 *
 * Author: built_by_Beck
 */

declare module 'pdfmake' {
  export type Alignment = 'left' | 'center' | 'right' | 'justify';
  export type MarginValue = [number, number, number, number] | [number, number] | number;

  export interface Style {
    fontSize?: number;
    bold?: boolean;
    italics?: boolean;
    color?: string;
    fillColor?: string;
    alignment?: Alignment;
    margin?: MarginValue;
    lineHeight?: number;
    font?: string;
  }

  export interface ContentText {
    text: string | ContentElement[];
    style?: string | string[];
    bold?: boolean;
    italics?: boolean;
    fontSize?: number;
    color?: string;
    fillColor?: string;
    alignment?: Alignment;
    margin?: MarginValue;
    lineHeight?: number;
  }

  export interface ContentStack {
    stack: ContentElement[];
    style?: string | string[];
    margin?: MarginValue;
  }

  export interface ContentColumns {
    columns: ContentElement[];
    style?: string | string[];
    margin?: MarginValue;
  }

  export interface TableNode {
    table: {
      headerRows?: number;
      widths?: (string | number)[];
      body: ContentCell[][];
    };
    layout?: string;
    style?: string | string[];
    margin?: MarginValue;
  }

  export interface CanvasLine {
    type: 'line';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    lineWidth?: number;
    lineColor?: string;
  }

  export interface ContentCanvas {
    canvas: CanvasLine[];
    margin?: MarginValue;
  }

  export type ContentCell = string | ContentText | ContentStack | ContentColumns | TableNode;
  export type ContentElement = ContentCell | ContentCanvas;

  export interface DocumentDefinition {
    content: ContentElement[];
    styles?: Record<string, Style>;
    defaultStyle?: Style;
    pageMargins?: [number, number, number, number];
    footer?: (currentPage: number, pageCount: number) => ContentElement;
    header?: (currentPage: number, pageCount: number) => ContentElement;
  }

  export interface FontEntry {
    normal?: string;
    bold?: string;
    italics?: string;
    bolditalics?: string;
  }

  /** Represents the result of pdfmake.createPdf() — v0.3.x OutputDocument */
  export interface OutputDocument {
    getBuffer(): Promise<Buffer>;
    getBase64(): Promise<string>;
    getDataUrl(): Promise<string>;
  }

  /** pdfmake v0.3.x default export class */
  export default class PdfMake {
    addFonts(fonts: Record<string, FontEntry>): void;
    setFonts(fonts: Record<string, FontEntry>): void;
    createPdf(docDefinition: DocumentDefinition): OutputDocument;
  }
}
