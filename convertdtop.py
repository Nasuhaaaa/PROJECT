import sys
import os
from docx2pdf import convert

def docx_to_pdf(docx_file, pdf_file=None):
    if not pdf_file:
        pdf_file = os.path.splitext(docx_file)[0] + '.pdf'

    convert(docx_file, pdf_file)
    print(f"Converted {docx_file} to {pdf_file}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python convert_docx_to_pdf.py input.docx [output.pdf]")
    else:
        docx_to_pdf(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
