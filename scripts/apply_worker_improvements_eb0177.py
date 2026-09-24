"""
Apply Worker Improvements for EB-0177:
1. Physical PDF chunk slicing and blank page filtering in pdf_splitter.py
2. Sliced PDF upload to Supabase Storage in worker.py
3. Deterministic Partner Tax + Gross Amount + Date Window fallback in db.py
"""

import os
import re
import shutil

WORKER_DIR = r"D:\ThinkAI\Visibill\worker"

def patch_pdf_splitter():
    path = os.path.join(WORKER_DIR, "pdf_splitter.py")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update InvoiceChunk dataclass
    old_dataclass = '''@dataclass
class InvoiceChunk:
    """A single invoice extracted from a multi-page PDF."""
    chunk_index: int           # 0-based index within the upload
    page_numbers: list[int]    # 1-based page numbers
    ocr_text: str              # Extracted text for this invoice
    hint: str = ""             # Brief description (e.g. invoice number)'''

    new_dataclass = '''@dataclass
class InvoiceChunk:
    """A single invoice extracted from a multi-page PDF."""
    chunk_index: int           # 0-based index within the upload
    page_numbers: list[int]    # 1-based page numbers
    ocr_text: str              # Extracted text for this invoice
    hint: str = ""             # Brief description (e.g. invoice number)
    pdf_bytes: Optional[bytes] = None  # Sliced PDF bytes containing only this chunk\'s pages'''

    if old_dataclass in content:
        content = content.replace(old_dataclass, new_dataclass)
        print("Patched InvoiceChunk dataclass.")
    else:
        print("InvoiceChunk already patched or not found.")

    # 2. Add _is_page_blank and _slice_pdf_bytes helpers
    helpers_code = '''

def _is_page_blank(text: str) -> bool:
    """
    Check if a page\'s text is essentially empty (whitespace, punctuation, < 15 chars).
    Used to omit accidental blank pages scanned from multi-feed scanners (Decision D-1).
    """
    if not text:
        return True
    cleaned = re.sub(r'[\\s\\-_.,;:/\\\\|~`!@#$%^&*()=+\\[\\]{}<>?"\\\']+', '', text)
    return len(cleaned) < 15


def _slice_pdf_bytes(pdf_bytes: bytes, page_indices: list[int]) -> Optional[bytes]:
    """
    Extract specified 0-based page indices from pdf_bytes into a new standalone PDF.
    Uses PyMuPDF (fitz).
    """
    if not pdf_bytes or not page_indices:
        return None
    try:
        import fitz
        src_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        new_doc = fitz.open()
        for idx in page_indices:
            if 0 <= idx < len(src_doc):
                new_doc.insert_pdf(src_doc, from_page=idx, to_page=idx)
        out_bytes = new_doc.tobytes(deflate=True, garbage=3)
        new_doc.close()
        src_doc.close()
        return out_bytes
    except Exception as e:
        logger.warning("pdf_chunk_slice_failed", error=str(e), pages=page_indices)
        return None
'''

    if "_slice_pdf_bytes" not in content:
        # Insert after _is_page_unreadable
        marker = "def _is_page_unreadable(text: str) -> bool:"
        idx = content.find(marker)
        if idx != -1:
            end_of_func = content.find("return False", idx)
            end_of_func = content.find("\n", end_of_func) + 1
            content = content[:end_of_func] + helpers_code + content[end_of_func:]
            print("Added _is_page_blank and _slice_pdf_bytes.")
        else:
            print("Could not find _is_page_unreadable marker.")

    # 3. Update _build_split_result signature and implementation
    old_build = '''def _build_split_result(
    page_texts: list[str],
    total_pages: int,
    filename: str,
    min_pages_for_split: int,
    is_scanned: bool = False,
) -> SplitResult:
    """Build SplitResult from page texts (shared by sync and async paths)."""

    # For small PDFs, don't split
    if total_pages < min_pages_for_split:
        full_text = "\\n\\n".join(page_texts)
        return SplitResult(
            total_pages=total_pages,
            chunks=[
                InvoiceChunk(
                    chunk_index=0,
                    page_numbers=list(range(1, total_pages + 1)),
                    ocr_text=full_text,
                    hint=_extract_invoice_hint(full_text),
                )
            ],
            is_multi_invoice=False,
            is_scanned=is_scanned,
        )

    # Group pages into invoices
    groups = _group_pages_into_invoices(page_texts)

    # Build chunks
    chunks: list[InvoiceChunk] = []
    for idx, page_indices in enumerate(groups):
        combined_text = "\\n\\n".join(page_texts[i] for i in page_indices)
        page_numbers = [i + 1 for i in page_indices]
        hint = _extract_invoice_hint(page_texts[page_indices[0]])

        chunks.append(InvoiceChunk(
            chunk_index=idx,
            page_numbers=page_numbers,
            ocr_text=combined_text,
            hint=hint,
        ))'''

    new_build = '''def _build_split_result(
    page_texts: list[str],
    total_pages: int,
    filename: str,
    min_pages_for_split: int,
    is_scanned: bool = False,
    pdf_bytes: Optional[bytes] = None,
) -> SplitResult:
    """Build SplitResult from page texts (shared by sync and async paths)."""

    # For small PDFs, don't split
    if total_pages < min_pages_for_split:
        full_text = "\\n\\n".join(page_texts)
        return SplitResult(
            total_pages=total_pages,
            chunks=[
                InvoiceChunk(
                    chunk_index=0,
                    page_numbers=list(range(1, total_pages + 1)),
                    ocr_text=full_text,
                    hint=_extract_invoice_hint(full_text),
                    pdf_bytes=pdf_bytes,
                )
            ],
            is_multi_invoice=False,
            is_scanned=is_scanned,
        )

    # Group pages into invoices
    groups = _group_pages_into_invoices(page_texts)

    # Build chunks
    chunks: list[InvoiceChunk] = []
    for idx, page_indices in enumerate(groups):
        combined_text = "\\n\\n".join(page_texts[i] for i in page_indices)

        # Decision D-1: Filter out completely blank/empty pages from the chunk slice
        # if the chunk contains other non-blank pages
        non_blank_indices = [i for i in page_indices if not _is_page_blank(page_texts[i])]
        effective_indices = non_blank_indices if non_blank_indices else page_indices

        page_numbers = [i + 1 for i in effective_indices]
        hint = _extract_invoice_hint(page_texts[effective_indices[0]])

        sub_bytes = None
        if pdf_bytes:
            sub_bytes = _slice_pdf_bytes(pdf_bytes, effective_indices)

        chunks.append(InvoiceChunk(
            chunk_index=idx,
            page_numbers=page_numbers,
            ocr_text=combined_text,
            hint=hint,
            pdf_bytes=sub_bytes,
        ))'''

    if old_build in content:
        content = content.replace(old_build, new_build)
        print("Patched _build_split_result.")
    else:
        print("_build_split_result already patched or not found.")

    # 4. Pass pdf_bytes in split_pdf_into_invoices and split_pdf_bytes_async
    old_sync = '''    return _build_split_result(
        page_texts, total_pages, filename, min_pages_for_split
    )'''
    new_sync = '''    pdf_bytes = None
    try:
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
    except Exception:
        pass
    return _build_split_result(
        page_texts, total_pages, filename, min_pages_for_split, pdf_bytes=pdf_bytes
    )'''
    if old_sync in content:
        content = content.replace(old_sync, new_sync)
        print("Patched split_pdf_into_invoices.")

    old_async_scanned = '''        return _build_split_result(
            page_texts, total_pages, filename, min_pages_for_split,
            is_scanned=True,
        )'''
    new_async_scanned = '''        return _build_split_result(
            page_texts, total_pages, filename, min_pages_for_split,
            is_scanned=True,
            pdf_bytes=pdf_bytes,
        )'''
    if old_async_scanned in content:
        content = content.replace(old_async_scanned, new_async_scanned)
        print("Patched split_pdf_bytes_async scanned branch.")

    old_async_digital = '''    # Digital PDF — use extracted text directly
    doc.close()
    return _build_split_result(
        page_texts, total_pages, filename, min_pages_for_split,
        is_scanned=False,
    )'''
    new_async_digital = '''    # Digital PDF — use extracted text directly
    doc.close()
    return _build_split_result(
        page_texts, total_pages, filename, min_pages_for_split,
        is_scanned=False,
        pdf_bytes=pdf_bytes,
    )'''
    if old_async_digital in content:
        content = content.replace(old_async_digital, new_async_digital)
        print("Patched split_pdf_bytes_async digital branch.")

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("pdf_splitter.py updated successfully.")


def patch_worker():
    path = os.path.join(WORKER_DIR, "worker.py")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    old_upsert = '''                invoice_id = await upsert_invoice(
                    invoice_data=invoice_row,
                    upload_id=upload_id,
                    user_id=user_id,
                    company_id=company_id,
                    file_url=file_url,
                    chunk_index=chunk.chunk_index,
                )'''

    new_upsert = '''                # Upload sliced chunk PDF to Supabase Storage if available (Decision D-2)
                chunk_file_url = file_url
                if getattr(chunk, "pdf_bytes", None):
                    try:
                        storage_path = f"{user_id}/{upload_id}-chunk-{chunk.chunk_index + 1}.pdf"
                        uploaded_url = await upload_pdf_to_storage(chunk.pdf_bytes, storage_path)
                        if uploaded_url:
                            chunk_file_url = uploaded_url
                            chunk_log.info(
                                "chunk_pdf_sliced_and_uploaded",
                                storage_path=storage_path,
                                pages=chunk.page_numbers,
                            )
                    except Exception as storage_err:
                        chunk_log.warning(
                            "chunk_pdf_upload_failed_fallback_to_original",
                            error=str(storage_err),
                        )

                invoice_id = await upsert_invoice(
                    invoice_data=invoice_row,
                    upload_id=upload_id,
                    user_id=user_id,
                    company_id=company_id,
                    file_url=chunk_file_url,
                    chunk_index=chunk.chunk_index,
                )'''

    if old_upsert in content:
        content = content.replace(old_upsert, new_upsert)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("worker.py updated successfully.")
    else:
        print("worker.py already patched or not found.")


def patch_db():
    path = os.path.join(WORKER_DIR, "db.py")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    old_suffix_end = '''                    logger.info("nav_crosscheck_suffix_match_found", extracted=invoice_num, matched_nav=cand_num, gross=cand_gross)
                    invoice_row["bizonylatsorszam"] = cand_num
                    return cand

        return None'''

    new_suffix_end = '''                    logger.info("nav_crosscheck_suffix_match_found", extracted=invoice_num, matched_nav=cand_num, gross=cand_gross)
                    invoice_row["bizonylatsorszam"] = cand_num
                    return cand

        # 4. Deterministic Partner Tax + Gross Amount + Date Window Fallback (Decision D-3)
        # When invoice_number was misread by OCR (e.g. '1069' instead of '2026/106')
        # or when OCR generated a fallback hash (e.g. 'OCR-1ad4a169'), but partner
        # tax ID and exact gross amount match a unique NAV invoice in the period.
        direction = invoice_row.get("invoice_direction")
        sub_elado_tax = re.sub(r'\\D', '', (invoice_row.get("elado_vat_id") or "")[:8])
        sub_vevo_tax = re.sub(r'\\D', '', (invoice_row.get("vevo_vat_id") or "")[:8])
        sub_gross = invoice_row.get("brutto_vegosszeg") if invoice_row.get("brutto_vegosszeg") is not None else invoice_row.get("brutto_osszeg")
        sub_curr = (invoice_row.get("penznem") or invoice_row.get("currency") or "HUF").upper()
        sub_issue_date = (invoice_row.get("kibocsatas_datuma") or "")[:10]

        partner_tax = sub_elado_tax if direction != "OUTBOUND" else sub_vevo_tax
        if not partner_tax and (sub_elado_tax or sub_vevo_tax):
            partner_tax = sub_elado_tax or sub_vevo_tax

        if partner_tax and len(partner_tax) == 8 and sub_gross is not None:
            try:
                sg = float(sub_gross)
                if abs(sg) > 0:
                    tax_col = "supplier_tax_number" if direction != "OUTBOUND" else "customer_tax_number"
                    tax_res = (
                        client.table("nav_invoices")
                        .select("invoice_number, invoice_direction, supplier_name, supplier_tax_number, customer_name, customer_tax_number, invoice_gross_amount, currency, invoice_issue_date")
                        .eq("company_id", company_id)
                        .ilike(tax_col, f"{partner_tax}%")
                        .limit(20)
                        .execute()
                    )

                    if tax_res.data:
                        matched_candidates = []
                        for cand in tax_res.data:
                            cand_curr = (cand.get("currency") or "HUF").upper()
                            if sub_curr != cand_curr:
                                continue
                            cand_gross = cand.get("invoice_gross_amount")
                            if cand_gross is None:
                                continue
                            cg = float(cand_gross)
                            diff = abs(sg - cg)
                            max_diff = max(5.0, abs(cg) * 0.005)
                            if diff > max_diff:
                                continue

                            # Date check: within +/- 7 days if dates available
                            cand_issue_date = (cand.get("invoice_issue_date") or "")[:10]
                            if sub_issue_date and cand_issue_date:
                                try:
                                    d1 = datetime.strptime(sub_issue_date, "%Y-%m-%d").date()
                                    d2 = datetime.strptime(cand_issue_date, "%Y-%m-%d").date()
                                    if abs((d1 - d2).days) > 7:
                                        continue
                                except Exception:
                                    pass

                            matched_candidates.append(cand)

                        # Decision D-3: Exactly ONE match ensures 100% deterministic safety
                        if len(matched_candidates) == 1:
                            cand = matched_candidates[0]
                            cand_num = cand.get("invoice_number", "")
                            logger.info(
                                "nav_crosscheck_tax_gross_fallback_match_applied",
                                extracted_number=invoice_num,
                                matched_nav_number=cand_num,
                                partner_tax=partner_tax,
                                gross=sub_gross,
                            )
                            invoice_row["bizonylatsorszam"] = cand_num
                            if cand.get("supplier_name") and direction != "OUTBOUND":
                                invoice_row["elado_nev"] = cand.get("supplier_name")
                            elif cand.get("customer_name") and direction == "OUTBOUND":
                                invoice_row["vevo_nev"] = cand.get("customer_name")
                            return cand
            except (ValueError, TypeError):
                pass

        return None'''

    if old_suffix_end in content:
        content = content.replace(old_suffix_end, new_suffix_end)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("db.py updated successfully.")
    else:
        print("db.py already patched or not found.")


if __name__ == "__main__":
    patch_pdf_splitter()
    patch_worker()
    patch_db()
