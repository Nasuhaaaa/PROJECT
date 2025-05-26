import sys
import os
from pdf2docx import Converter

def pdf_to_docx(pdf_file, docx_file=None):
    if not docx_file:
        docx_file = os.path.splitext(pdf_file)[0] + '.docx'  # same name, .docx extension

    cv = Converter(pdf_file)
    cv.convert(docx_file)
    cv.close()
    print(f"Conversion successful: {docx_file}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python convert.py input.pdf [output.docx]")
    else:
        pdf_to_docx(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
